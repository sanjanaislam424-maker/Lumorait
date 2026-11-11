import { corsHeaders, extractText, generateContent, jsonResponse, type GeminiFailure } from "../_shared/gemini.ts";

const TIMEOUT_MS = 20_000;

type KeyStatus = "valid" | "rate_limited" | "quota_exceeded" | "invalid_key" | "timeout" | "server_error" | "empty";

interface KeyTestResult {
  ok: boolean;
  status: KeyStatus;
  message: string;
  model?: string;
  usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | null;
}

function classifyFailure({ status, message }: GeminiFailure): KeyTestResult {
  const text = message.toLowerCase();
  if (status === null && text.startsWith("timed out")) {
    return { ok: false, status: "timeout", message: "Request timed out" };
  }
  if (status === null) {
    return { ok: false, status: "server_error", message: "Network error reaching Gemini" };
  }
  if (status === 400 && text.includes("api key not valid")) {
    return { ok: false, status: "invalid_key", message: "API key not valid — check the key was copied in full" };
  }
  if (status === 401) {
    return { ok: false, status: "invalid_key", message: "Key rejected by Gemini (401) — generate a new key in AI Studio" };
  }
  if (status === 403) {
    if (text.includes("quota") || text.includes("limit") || text.includes("exceeded")) {
      return { ok: false, status: "quota_exceeded", message: "Today's limit exceeded" };
    }
    return { ok: false, status: "invalid_key", message: "Key not authorized — enable the Generative Language API for this key's project" };
  }
  if (status === 404) {
    return { ok: false, status: "invalid_key", message: "Model not found for this key — the app's model list may need updating" };
  }
  if (status === 429 || text.includes("rate") || text.includes("exhausted")) {
    return { ok: false, status: "rate_limited", message: "Rate limited — try again shortly" };
  }
  if (text.includes("quota") || text.includes("billing")) {
    return { ok: false, status: "quota_exceeded", message: "Today's limit exceeded" };
  }
  return { ok: false, status: "server_error", message: `Gemini error ${status}: ${message.slice(0, 120)}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, apiKey, testAll } = await req.json();
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return jsonResponse({ ok: false, status: "invalid_key", message: "No API key provided" }, 400);
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ ok: false, status: "server_error", message: "No test message provided" }, 400);
    }

    const result = await generateContent({
      keys: [apiKey.trim()],
      body: {
        contents: messages.map((m: { role: string; content: string }) => ({
          role: m.role === "assistant" || m.role === "admin" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.8, maxOutputTokens: 8192 },
      },
      timeoutMs: TIMEOUT_MS,
      label: "ai-test-key",
      accept: (json) => extractText(json).trim().length > 0,
    });

    if (!result.ok) {
      const failed = classifyFailure(result.failure);
      return jsonResponse(failed, 200);
    }

    const usage = result.json?.usageMetadata ?? null;
    const tokens = usage?.totalTokenCount ?? 0;
    const keyResult: KeyTestResult = {
      ok: true,
      status: "valid",
      message: testAll ? "Valid" : `Valid${tokens ? ` (${tokens} tokens)` : ""} — ${result.model}`,
      model: result.model,
      usage,
    };
    return jsonResponse(keyResult, 200);
  } catch (err) {
    console.error("ai-test-key error:", err);
    return jsonResponse({ ok: false, status: "server_error", message: "Server error while testing key" }, 500);
  }
});
