import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"];

interface ChatMessage {
  role: string;
  content: string;
}

interface KeyTestResult {
  ok: boolean;
  status?: "valid" | "rate_limited" | "quota_exceeded" | "invalid_key" | "server_error" | "empty";
  message: string;
  model?: string;
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null;
}

function classifyError(status: number, errorBody: string): KeyTestResult {
  const body = errorBody.toLowerCase();
  if (status === 400 && body.includes("api key not valid")) {
    return { ok: false, status: "invalid_key", message: "Invalid API key" };
  }
  if (status === 403 || body.includes("permission") || body.includes("forbidden")) {
    if (body.includes("quota") || body.includes("limit") || body.includes("exceeded")) {
      return { ok: false, status: "quota_exceeded", message: "Today's limit exceeded" };
    }
    return { ok: false, status: "invalid_key", message: "Key not authorized" };
  }
  if (status === 429 || body.includes("rate") || body.includes("resource") || body.includes("exhausted")) {
    return { ok: false, status: "rate_limited", message: "Rate limited — try again shortly" };
  }
  if (body.includes("quota") || body.includes("limit") || body.includes("exceeded") || body.includes("billing")) {
    return { ok: false, status: "quota_exceeded", message: "Today's limit exceeded" };
  }
  return { ok: false, status: "server_error", message: `Error ${status}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, apiKey, systemPrompt, testAll } = await req.json();
    if (!apiKey || typeof apiKey !== "string") {
      return new Response(JSON.stringify({ error: "apiKey required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = systemPrompt || "You are a helpful assistant.";
    const contents = messages.map((m: ChatMessage) => ({
      role: m.role === "assistant" || m.role === "admin" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let lastResult: KeyTestResult | null = null;

    try {
      for (const model of GEMINI_MODELS) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents,
              systemInstruction: { parts: [{ text: prompt }] },
              generationConfig: { temperature: 0.8, maxOutputTokens: 256 },
            }),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const errorBody = await res.text();
          const classified = classifyError(res.status, errorBody);
          lastResult = classified;
          if (classified.status === "invalid_key" || classified.status === "quota_exceeded") {
            break;
          }
          continue;
        }
        const json = await res.json();
        const text: string = json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") || "";
        const usage = json?.usageMetadata || null;
        const finishReason = json?.candidates?.[0]?.finishReason || null;
        if (text) {
          const tokens = usage?.totalTokenCount ?? 0;
          return new Response(JSON.stringify({
            ok: true,
            status: "valid",
            message: testAll ? "Valid" : `Valid${tokens ? ` (${tokens} tokens)` : ""} — ${model}`,
            model,
            usage,
            finishReason,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        lastResult = { ok: false, status: "empty", message: "Empty reply from model" };
      }
    } finally {
      clearTimeout(timer);
    }

    const result = lastResult || { ok: false, status: "server_error" as const, message: "All models failed" };
    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, status: "server_error", message: String(err).slice(0, 300) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
