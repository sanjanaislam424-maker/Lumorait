import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"];
const MAX_OUTPUT_TOKENS = 8192;
const CONNECT_TIMEOUT_MS = 20_000;
const encoder = new TextEncoder();

interface ChatMessage {
  role: string;
  content: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requestGeminiStream(
  model: string,
  apiKey: string,
  systemPrompt: string,
  contents: unknown[],
): Promise<ReadableStream<Uint8Array> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.8, maxOutputTokens: MAX_OUTPUT_TOKENS },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok || !res.body) {
      console.error(`Gemini ${model} failed (${res.status}): ${await res.text()}`);
      return null;
    }
    return res.body;
  } catch (err) {
    console.error(`Gemini ${model} request error:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function openGeminiStream(
  keys: string[],
  startIndex: number,
  systemPrompt: string,
  contents: unknown[],
): Promise<{ body: ReadableStream<Uint8Array>; keyIndex: number } | null> {
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = (startIndex + attempt) % keys.length;
    for (const model of GEMINI_MODELS) {
      const body = await requestGeminiStream(model, keys[keyIndex], systemPrompt, contents);
      if (body) return { body, keyIndex };
    }
  }
  return null;
}

async function* geminiTextDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const data = JSON.parse(line.slice(5));
        const text: string | undefined = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("");
        if (text) yield text;
      } catch (err) {
        console.error("Could not parse Gemini stream line:", err);
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, sessionId } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "Messages required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("app_settings")
      .select("gemini_api_keys, ai_system_prompt, ai_active_key_index")
      .eq("id", 1)
      .maybeSingle();

    const apiKeys: string[] = Array.isArray(settings?.gemini_api_keys) ? settings.gemini_api_keys : [];
    const systemPrompt: string = settings?.ai_system_prompt || "You are a helpful assistant.";
    const activeIndex: number = settings?.ai_active_key_index ?? 0;

    const allKeys = apiKeys.filter(Boolean);
    const envKey = Deno.env.get("GEMINI_API_KEY");
    if (envKey && !allKeys.includes(envKey)) allKeys.push(envKey);

    if (allKeys.length === 0) {
      console.error("ai-chat: no Gemini keys configured");
      return jsonResponse({ error: "no_keys" }, 503);
    }

    const contents = messages.map((m: ChatMessage) => ({
      role: m.role === "assistant" || m.role === "admin" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const upstream = await openGeminiStream(allKeys, activeIndex % allKeys.length, systemPrompt, contents);
    if (!upstream) {
      return jsonResponse({ error: "upstream_unavailable" }, 503);
    }

    if (upstream.keyIndex !== activeIndex % allKeys.length) {
      await supabase.from("app_settings").update({ ai_active_key_index: upstream.keyIndex }).eq("id", 1);
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };
        let fullReply = "";
        try {
          for await (const delta of geminiTextDeltas(upstream.body)) {
            fullReply += delta;
            send({ type: "text", delta });
          }
          if (!fullReply.trim()) throw new Error("Gemini returned an empty reply");

          let savedId: string | null = null;
          if (sessionId) {
            const { data, error } = await supabase
              .from("chat_messages")
              .insert({ session_id: sessionId, role: "assistant", content: fullReply })
              .select("id")
              .maybeSingle();
            if (error) console.error("Could not save assistant reply:", error);
            savedId = data?.id ?? null;
          }
          send({ type: "done", id: savedId });
        } catch (err) {
          console.error("ai-chat stream failed:", err);
          send({ type: "error", message: "stream_failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
});
