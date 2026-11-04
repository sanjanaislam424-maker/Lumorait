import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  jsonResponse,
  loadGeminiSettings,
  readGeminiStream,
  streamGenerateContent,
  type GeminiUsage,
} from "../_shared/gemini.ts";

const MAX_OUTPUT_TOKENS = 8192;
const CONNECT_TIMEOUT_MS = 25_000;
const encoder = new TextEncoder();

interface ChatMessage {
  role: string;
  content: string;
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  buddy: "You are the user's chill best friend — witty, warm, playful, a little sarcastic but never mean. You crack jokes over adda and drop life tips like a close buddy would.",
  mentor: "You are a professional mentor — clear, thoughtful, and practical. You give structured, calm guidance with encouraging but grounded advice.",
  coach: "You are a witty coach — punchy, energetic, and motivating with a clever twist. You push the user forward with humor and sharp insight.",
};

function ndjsonResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}

function fallbackStream(lastUserMessage: string): ReadableStream<Uint8Array> {
  const isBn = /[\u0980-\u09FF]/.test(lastUserMessage);
  const text = isBn
    ? "আরে ভাই, আমার মাথায় একটু গোলমাল হচ্ছে — ঠিক করে নিচ্ছি! একটু পরে আবার চেষ্টা করো, নাহলে নিচের 'মানুষের সাথে কথা বলো' বাটনে ট্যাপ করো!"
    : "Hey buddy, my brain's a little scrambled right now — fixing it! Try again in a sec, or tap 'Talk to Human Agent' below!";
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify({ type: "text", delta: text }) + "\n"));
      controller.enqueue(encoder.encode(JSON.stringify({ type: "done", id: null }) + "\n"));
      controller.close();
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, sessionId, aiTone } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: "Messages required" }, 400);
    }

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const settings = await loadGeminiSettings(db);
    const toneSuffix = TONE_INSTRUCTIONS[aiTone as string] || TONE_INSTRUCTIONS.buddy;
    const basePrompt = settings.systemPrompt || "You are a helpful assistant.";
    const systemPrompt = `${basePrompt}\n\n${toneSuffix}`;

    const lastUserMessage = [...messages].reverse().find((m: ChatMessage) => m.role === "user")?.content || "";

    if (settings.keys.length === 0) {
      console.error("ai-chat: no Gemini keys configured, sending fallback reply");
      return ndjsonResponse(fallbackStream(lastUserMessage));
    }

    const contents = messages.map((m: ChatMessage) => ({
      role: m.role === "assistant" || m.role === "admin" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const upstream = await streamGenerateContent({
      keys: settings.keys,
      startIndex: settings.activeIndex % settings.keys.length,
      body: {
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.8, maxOutputTokens: MAX_OUTPUT_TOKENS },
      },
      timeoutMs: CONNECT_TIMEOUT_MS,
      label: "ai-chat",
    });
    if (!upstream.ok) {
      console.error(`ai-chat: all keys and models failed (${upstream.failure.status ?? "no status"}): ${upstream.failure.message}`);
      return ndjsonResponse(fallbackStream(lastUserMessage));
    }

    if (upstream.keyIndex !== settings.activeIndex % settings.keys.length) {
      await db.from("app_settings").update({ ai_active_key_index: upstream.keyIndex }).eq("id", 1);
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };
        let fullReply = "";
        let lastUsage: GeminiUsage | null = null;
        try {
          for await (const { text, usage } of readGeminiStream(upstream.body)) {
            if (text) {
              fullReply += text;
              send({ type: "text", delta: text });
            }
            if (usage) lastUsage = usage;
          }
          if (!fullReply.trim()) throw new Error("Gemini returned an empty reply");

          const usedKey = settings.keys[upstream.keyIndex];
          const promptTokens = lastUsage?.promptTokenCount ?? 0;
          const outputTokens = lastUsage?.candidatesTokenCount ?? 0;
          if (usedKey && (promptTokens || outputTokens)) {
            const { error: rpcError } = await db.rpc("increment_gemini_key_usage", {
              p_key: usedKey,
              p_prompt: promptTokens,
              p_output: outputTokens,
            });
            if (rpcError) console.error("Could not save key usage:", rpcError);
            const { error: dailyError } = await db.rpc("increment_gemini_daily_usage", {
              p_prompt: promptTokens,
              p_output: outputTokens,
            });
            if (dailyError) console.error("Could not save daily usage:", dailyError);
          }

          let savedId: string | null = null;
          if (sessionId) {
            const { data, error } = await db
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

    return ndjsonResponse(stream);
  } catch (err) {
    console.error("ai-chat error:", err);
    return jsonResponse({ error: "server_error" }, 500);
  }
});
