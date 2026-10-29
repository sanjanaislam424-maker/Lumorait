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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, apiKey, systemPrompt } = await req.json();
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
    let lastStatus = 0;
    let lastError = "";
    let body: string | null = null;

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
        lastStatus = res.status;
        if (!res.ok) {
          lastError = await res.text();
          continue;
        }
        const json = await res.json();
        const text: string = json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") || "";
        const usage = json?.usageMetadata || null;
        const finishReason = json?.candidates?.[0]?.finishReason || null;
        if (text) {
          return new Response(JSON.stringify({
            ok: true,
            reply: text.slice(0, 500),
            model,
            usage,
            finishReason,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        lastError = "Empty reply from model";
      }
    } finally {
      clearTimeout(timer);
    }

    return new Response(JSON.stringify({
      ok: false,
      status: lastStatus,
      error: lastError.slice(0, 300),
    }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err).slice(0, 300) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
