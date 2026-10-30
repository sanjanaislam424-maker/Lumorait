import { createClient } from "npm:@supabase/supabase-js@2";
// Regenerate ALL daily AI content at once — funny quotes, tips, and UI copy

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
const TIMEOUT_MS = 30_000;

const CONTENT_FALLBACK = {
  funny_bn: "সোশ্যাল মিডিয়ায় ভাইরাল হতে গিয়ে নিজের অ্যাকাউন্ট হ্যাক খাওয়া — এটাই আসল ফ্রিল্যান্সিং সাফল্য!",
  funny_en: "Going viral is easy — just post something embarrassing and watch your career disappear!",
  tip_bn: "প্রতিদিন পোস্ট করো, কিন্তু কপি-পেস্ট করলে ফলোয়ার শুধু আয়নায় দেখবে — আসল কন্টেন্ট দাও!",
  tip_en: "Post daily, but if you copy-paste, your followers will only exist in your mirror. Be original!",
};

const UI_COPY_FALLBACK: Record<string, string> = {
  tasks_header: "Kaj er palla ora kore, apni boshe chaye khao moshay!",
  loading_tasks: "Kaj ane barita hocche moshay, ektu dhoyro doro!",
  category_empty: "Ekhon kaj nai mama, cha-biskut khaiya asho!",
  your_tasks_first: "Apnar kaj sobar upore, rajar moto bosun!",
  video_tutorial_header: "Shob parbo bhabe bose theko na, ektukhani tutorial dekhe ashbe?",
  video_panel_subtitle: "Dui minit video, baki jiboner jonno kaj shikhe nao!",
  daily_tip: "Ajker tippony: Chat-e ghumash na, kaj shesh kore baki ghumum.",
  dashboard_alert: "Arey moshay! Check-in kore coins nibe na? Koshto kore kamaiben!",
  task_available: "Arey moshay! Kaj apnar jonno opekkha korche, ektu haat chalao!",
  watch_tutorial: "Shob parbo bhabe bose theko na, bolo to ektukhani tutorial ta dekhe ashbe?",
};

const UI_COPY_FIELDS = Object.keys(UI_COPY_FALLBACK);

const CONTENT_FIELDS = Object.keys(CONTENT_FALLBACK);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAllKeys(supabase: any): Promise<string[]> {
  const { data: settings } = await supabase
    .from("app_settings")
    .select("gemini_api_keys, ai_active_key_index")
    .eq("id", 1)
    .maybeSingle();
  const keys: string[] = Array.isArray(settings?.gemini_api_keys) ? settings.gemini_api_keys : [];
  const allKeys = keys.filter(Boolean);
  const envKey = Deno.env.get("GEMINI_API_KEY");
  if (envKey && !allKeys.includes(envKey)) allKeys.push(envKey);
  return allKeys;
}

function isCompleteSentence(text: string, minWords: number = 4): boolean {
  return text.trim().split(/\s+/).length >= minWords;
}

function cleanText(raw: string): string {
  return raw.replace(/```[a-z]*/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").trim();
}

async function callGemini(
  allKeys: string[],
  prompt: string,
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  for (let k = 0; k < allKeys.length; k++) {
    for (const model of GEMINI_MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": allKeys[k] },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature, maxOutputTokens: maxTokens },
            }),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`ai-regenerate-all: Gemini ${model} key#${k} failed (${res.status}): ${errBody.slice(0, 300)}`);
          continue;
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") || "";
        if (!text) {
          console.error(`ai-regenerate-all: Gemini ${model} key#${k} returned empty reply`);
          continue;
        }
        return text;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.error(`ai-regenerate-all: Gemini ${model} key#${k} timed out after ${TIMEOUT_MS}ms`);
        } else {
          console.error(`ai-regenerate-all: Gemini ${model} key#${k} error:`, err);
        }
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  console.error("ai-regenerate-all: All keys and models exhausted");
  return null;
}

async function regenerateContentQuotes(allKeys: string[], recentRows: any[]): Promise<Record<string, string>> {
  const avoidList = recentRows
    .flatMap((r) => [r.funny_bn, r.funny_en, r.tip_bn, r.tip_en])
    .filter(Boolean)
    .map((s) => `"${s}"`)
    .join("\n");

  const doNotRepeat = avoidList
    ? `\n\nCRITICAL: Do NOT repeat or closely paraphrase any of these previous days' content:\n${avoidList}\n`
    : "";

  const prompt = `You are the witty, sarcastic, hilarious AI assistant for "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Generate exactly 4 lines of content. Be extremely funny, witty, and sarcastic — like a best friend who roasts you lovingly.

The Bengali lines MUST be in PURE Bengali script (বাংলা হরফ), NOT Banglish.
The English lines MUST be in witty, engaging English.
${doNotRepeat}
CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that expresses a full thought.
- NEVER output 1-2 word broken phrases or contextless fragments like "লাইক করো", "ট্রল পোস্টের", "মাইক্রো টাস্ক করে বড়লোক".
- Each line must be readable, meaningful, and form a full humorous or actionable thought from start to finish.

Return ONLY valid JSON, no markdown, no code fences.
{
  "funny_bn": "A complete witty 1-line funny truth in PURE Bengali script, max 120 chars",
  "funny_en": "The same funny line in witty English, max 100 chars",
  "tip_bn": "A complete practical growth tip in PURE Bengali script with sarcastic twist, max 150 chars",
  "tip_en": "The same tip in witty English with a sarcastic twist, max 120 chars"
}

Good example: "ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে — সে জানে তুমি কখন অনলাইন আসবে!"
Bad example (NEVER): "লাইক করো" (broken fragment)

No emoji.`;

  const raw = await callGemini(allKeys, prompt, 500, 1.4);
  if (!raw) return { ...CONTENT_FALLBACK };

  try {
    const cleaned = cleanText(raw);
    const parsed = JSON.parse(cleaned);
    const result: Record<string, string> = {};
    for (const field of CONTENT_FIELDS) {
      const val = typeof parsed[field] === "string" ? parsed[field].trim() : "";
      if (val && isCompleteSentence(val)) {
        result[field] = val;
      } else {
        console.error(`ai-regenerate-all: content field '${field}' is fragment or missing, using fallback`);
        result[field] = CONTENT_FALLBACK[field as keyof typeof CONTENT_FALLBACK];
      }
    }
    return result;
  } catch (err) {
    console.error("ai-regenerate-all: content JSON parse failed:", err);
    return { ...CONTENT_FALLBACK };
  }
}

async function regenerateUICopy(allKeys: string[]): Promise<Record<string, string>> {
  const prompt = `You are the witty, sarcastic, funny assistant for "Lumora IT", a Bangladeshi micro-task and SMM app.
Generate 10 short UI copy lines in BANGLISH (Bangla written in English script mixed with Bangla words — casual, best-friend tone, hilarious, sarcastic).

CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that expresses a full thought.
- NEVER output 1-2 word broken phrases or contextless fragments like "Like koro", "Troll er", "Micro task kore borolok".
- Each line must be readable, meaningful, and form a full humorous or actionable thought from start to finish.

Return ONLY valid JSON, no markdown, no code fences. Format:
{
  "tasks_header": "funny complete header sentence, max 80 chars",
  "loading_tasks": "funny complete loading message, max 70 chars",
  "category_empty": "funny complete message when no tasks, max 80 chars",
  "your_tasks_first": "funny complete label sentence, max 60 chars",
  "video_tutorial_header": "funny complete header sentence, max 90 chars",
  "video_panel_subtitle": "funny complete subtitle sentence, max 90 chars",
  "daily_tip": "funny complete tip sentence, max 120 chars",
  "dashboard_alert": "funny complete alert sentence, max 90 chars",
  "task_available": "funny complete message, max 80 chars",
  "watch_tutorial": "funny complete call-to-action sentence, max 90 chars"
}

Good example: "Shob parbo bhabe bose theko na, bolo to ektukhani tutorial ta dekhe ashbe?"
Bad example (NEVER): "Like koro" (broken fragment)

No emoji.`;

  const raw = await callGemini(allKeys, prompt, 800, 1.5);
  if (!raw) return { ...UI_COPY_FALLBACK };

  try {
    const cleaned = cleanText(raw).replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const result: Record<string, string> = {};
    for (const field of UI_COPY_FIELDS) {
      const val = typeof parsed[field] === "string" ? parsed[field].trim() : "";
      if (val && val.split(/\s+/).length >= 3) {
        result[field] = val;
      } else {
        console.error(`ai-regenerate-all: UI copy field '${field}' is fragment, using fallback`);
        result[field] = UI_COPY_FALLBACK[field];
      }
    }
    return result;
  } catch (err) {
    console.error("ai-regenerate-all: UI copy JSON parse failed:", err);
    return { ...UI_COPY_FALLBACK };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    const allKeys = await getAllKeys(supabase);
    if (allKeys.length === 0) {
      console.error("ai-regenerate-all: no Gemini API keys configured");
      return jsonResponse({
        error: "No API keys configured",
        fallback: true,
        warning: "No Gemini API keys are configured. Add keys in the AI Keys tab.",
      }, 503);
    }

    // Fetch recent content to avoid repetition
    const { data: recentRows } = await supabase
      .from("daily_ai_content")
      .select("funny_bn, funny_en, tip_bn, tip_en")
      .order("content_date", { ascending: false })
      .limit(7);

    // Regenerate both content sets in parallel
    const [contentResult, uiCopyResult] = await Promise.all([
      regenerateContentQuotes(allKeys, recentRows || []),
      regenerateUICopy(allKeys),
    ]);

    let contentFallbackUsed = false;
    let uiCopyFallbackUsed = false;

    // Update or insert daily_ai_content
    const { data: existingContent } = await supabase
      .from("daily_ai_content")
      .select("id")
      .eq("content_date", today)
      .maybeSingle();

    if (existingContent) {
      const { error } = await supabase
        .from("daily_ai_content")
        .update({ ...contentResult, updated_at: now })
        .eq("content_date", today);
      if (error) console.error("ai-regenerate-all: content update failed:", error);
    } else {
      const { error } = await supabase
        .from("daily_ai_content")
        .insert({ content_date: today, ...contentResult });
      if (error) console.error("ai-regenerate-all: content insert failed:", error);
    }

    // Check if content used fallback
    contentFallbackUsed = CONTENT_FIELDS.every((f) => contentResult[f] === CONTENT_FALLBACK[f as keyof typeof CONTENT_FALLBACK]);

    // Update or insert daily_ai_ui_copy
    const { data: existingUiCopy } = await supabase
      .from("daily_ai_ui_copy")
      .select("id")
      .eq("content_date", today)
      .maybeSingle();

    if (existingUiCopy) {
      const { error } = await supabase
        .from("daily_ai_ui_copy")
        .update({ ...uiCopyResult, updated_at: now })
        .eq("content_date", today);
      if (error) console.error("ai-regenerate-all: UI copy update failed:", error);
    } else {
      const { error } = await supabase
        .from("daily_ai_ui_copy")
        .insert({ content_date: today, ...uiCopyResult });
      if (error) console.error("ai-regenerate-all: UI copy insert failed:", error);
    }

    // Check if UI copy used fallback
    uiCopyFallbackUsed = UI_COPY_FIELDS.every((f) => uiCopyResult[f] === UI_COPY_FALLBACK[f]);

    const anyFallback = contentFallbackUsed || uiCopyFallbackUsed;
    const warnings: string[] = [];
    if (contentFallbackUsed) warnings.push("Funny quotes/tips used fallback content");
    if (uiCopyFallbackUsed) warnings.push("UI copy used fallback content");

    return jsonResponse({
      success: true,
      content: contentResult,
      uiCopy: uiCopyResult,
      fallback: anyFallback,
      ...(warnings.length > 0 ? { warning: warnings.join(". ") } : {}),
    });
  } catch (err) {
    console.error("ai-regenerate-all: unhandled error:", err);
    return jsonResponse({ error: `Server error: ${String(err).slice(0, 200)}` }, 500);
  }
});
