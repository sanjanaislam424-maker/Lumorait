export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiSettings {
  keys: string[];
  activeIndex: number;
  systemPrompt: string | null;
}

export interface GeminiFailure {
  status: number | null;
  message: string;
}

export type GeminiCallResult =
  | { ok: true; json: any; model: string; keyIndex: number }
  | { ok: false; failure: GeminiFailure };

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function loadGeminiSettings(db: any): Promise<GeminiSettings> {
  const { data, error } = await db
    .from("app_settings")
    .select("gemini_api_keys, ai_system_prompt, ai_active_key_index")
    .eq("id", 1)
    .maybeSingle();
  if (error) console.error("gemini: could not load app_settings:", error);

  const stored: string[] = Array.isArray(data?.gemini_api_keys)
    ? data.gemini_api_keys.map((k: unknown) => String(k ?? "").trim()).filter(Boolean)
    : [];
  const env = Deno.env.get("GEMINI_API_KEY")?.trim();
  const keys = env && !stored.includes(env) ? [...stored, env] : stored;

  return {
    keys,
    activeIndex: Number.isInteger(data?.ai_active_key_index) ? data.ai_active_key_index : 0,
    systemPrompt:
      typeof data?.ai_system_prompt === "string" && data.ai_system_prompt.trim() ? data.ai_system_prompt : null,
  };
}

export function extractText(json: any): string {
  return json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}

export function isTruncated(json: any): boolean {
  return json?.candidates?.[0]?.finishReason === "MAX_TOKENS";
}

export function parseModelJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function summarizeError(raw: string): string {
  try {
    const message = JSON.parse(raw)?.error?.message;
    if (typeof message === "string") return message.slice(0, 300);
  } catch {
    // not JSON; fall through to raw snippet
  }
  return raw.slice(0, 300);
}

async function postGenerateContent(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: true; json: any } | { ok: false; failure: GeminiFailure }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      return { ok: false, failure: { status: res.status, message: summarizeError(raw) } };
    }
    return { ok: true, json: await res.json() };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "AbortError";
    return {
      ok: false,
      failure: { status: null, message: timedOut ? `timed out after ${timeoutMs}ms` : String(err).slice(0, 300) },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateContent(opts: {
  keys: string[];
  startIndex?: number;
  body: Record<string, unknown>;
  timeoutMs: number;
  label: string;
  accept?: (json: any) => boolean;
}): Promise<GeminiCallResult> {
  let last: GeminiFailure = { status: null, message: "No API keys configured" };
  const start = opts.startIndex ?? 0;
  for (let attempt = 0; attempt < opts.keys.length; attempt++) {
    const keyIndex = (start + attempt) % opts.keys.length;
    for (const model of GEMINI_MODELS) {
      const result = await postGenerateContent(model, opts.keys[keyIndex], opts.body, opts.timeoutMs);
      if (result.ok && (!opts.accept || opts.accept(result.json))) {
        return { ok: true, json: result.json, model, keyIndex };
      }
      last = result.ok ? { status: null, message: "reply rejected by validation" } : result.failure;
      console.error(`${opts.label}: ${model} key#${keyIndex} failed (${last.status ?? "no status"}): ${last.message}`);
    }
  }
  return { ok: false, failure: last };
}

export async function streamGenerateContent(opts: {
  keys: string[];
  startIndex: number;
  body: Record<string, unknown>;
  timeoutMs: number;
  label: string;
}): Promise<
  | { ok: true; body: ReadableStream<Uint8Array>; keyIndex: number; model: string }
  | { ok: false; failure: GeminiFailure }
> {
  let last: GeminiFailure = { status: null, message: "No API keys configured" };
  for (let attempt = 0; attempt < opts.keys.length; attempt++) {
    const keyIndex = (opts.startIndex + attempt) % opts.keys.length;
    for (const model of GEMINI_MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
      try {
        const res = await fetch(`${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": opts.keys[keyIndex] },
          body: JSON.stringify(opts.body),
          signal: controller.signal,
        });
        if (res.ok && res.body) return { ok: true, body: res.body, keyIndex, model };
        const raw = await res.text().catch(() => "");
        last = { status: res.status, message: summarizeError(raw) };
      } catch (err) {
        const timedOut = err instanceof DOMException && err.name === "AbortError";
        last = {
          status: null,
          message: timedOut ? `timed out after ${opts.timeoutMs}ms` : String(err).slice(0, 300),
        };
      } finally {
        clearTimeout(timer);
      }
      console.error(`${opts.label}: ${model} key#${keyIndex} failed (${last.status ?? "no status"}): ${last.message}`);
    }
  }
  return { ok: false, failure: last };
}

export async function* readGeminiStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ text: string; usage: GeminiUsage | null }> {
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
        const text = extractText(data);
        const usage: GeminiUsage | null = data?.usageMetadata ?? null;
        if (text || usage) yield { text, usage };
      } catch (err) {
        console.error("gemini: could not parse stream line:", err);
      }
    }
  }
}
