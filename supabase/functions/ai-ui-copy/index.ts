import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
const TIMEOUT_MS = 12_000;

const FALLBACK: Record<string, string> = {
  tasks_header_bn: "কাজের তালিকা প্রস্তুত আছে, এবার একটু পরিশ্রম করলে উপার্জনও হবে।",
  tasks_header_en: "Your task list is ready; a little effort can turn it into real earnings.",
  loading_tasks_bn: "কাজগুলো আসছে, একটু অপেক্ষা করুন; ধৈর্যও এক ধরনের দক্ষতা।",
  loading_tasks_en: "Your tasks are loading; patience is a useful skill too.",
  category_empty_bn: "এই বিভাগে এখন কোনো কাজ নেই; অন্য বিভাগটি দেখে নিন।",
  category_empty_en: "There are no tasks in this category right now; try another one.",
  your_tasks_first_bn: "আপনার কাজগুলো সবার আগে দেখানো হচ্ছে, যাতে সুযোগ হাতছাড়া না হয়।",
  your_tasks_first_en: "Your tasks appear first so you never miss an opportunity.",
  video_tutorial_header_bn: "কাজ শুরু করার আগে ছোট টিউটোরিয়ালটি দেখে নিন।",
  video_tutorial_header_en: "Watch the short tutorial before you start the task.",
  video_panel_subtitle_bn: "দুই মিনিটের নির্দেশনা আপনার কাজটি সঠিকভাবে শেষ করতে সাহায্য করবে।",
  video_panel_subtitle_en: "A two-minute guide can help you complete the task correctly.",
  daily_tip_bn: "প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।",
  daily_tip_en: "Post quality content consistently; irregular promotion confuses the algorithm too.",
  dashboard_alert_bn: "আজকের চেক-ইনটি সম্পন্ন করুন, কারণ ছোট অভ্যাসই বড় ফল তৈরি করে।",
  dashboard_alert_en: "Complete today's check-in because small habits create meaningful results.",
  task_available_bn: "আপনার জন্য নতুন কাজ অপেক্ষা করছে; সুযোগটি কাজে লাগান।",
  task_available_en: "A new task is waiting for you; make the opportunity count.",
  watch_tutorial_bn: "টিউটোরিয়ালটি দেখে কাজটি আরও আত্মবিশ্বাসের সঙ্গে শুরু করুন।",
  watch_tutorial_en: "Watch the tutorial and start the task with confidence.",
};

const FIELDS = Object.keys(FALLBACK);

function isTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/[,،]$/u.test(trimmed)) return true;
  if (/\.\.\.$/u.test(trimmed)) return true;
  if (!/[.!?\u0964\u0965]$/u.test(trimmed) && /[\u0995-\u09B9]$/u.test(trimmed)) return true;
  return false;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getAllKeys(db: any): Promise<string[]> {
  const { data } = await db.from("app_settings").select("gemini_api_keys").eq("id", 1).maybeSingle();
  const stored = Array.isArray(data?.gemini_api_keys) ? data.gemini_api_keys.filter(Boolean) : [];
  const env = Deno.env.get("GEMINI_API_KEY");
  return env && !stored.includes(env) ? [...stored, env] : stored;
}

async function generateUICopy(db: any): Promise<Record<string, string> | null> {
  const allKeys = await getAllKeys(db);
  if (allKeys.length === 0) return null;

  const prompt = `You are the witty, sarcastic, funny assistant for "Lumora IT", a Bangladeshi micro-task and SMM app.
Generate 20 short UI copy lines as bilingual pairs. Every *_bn value MUST be in PURE Bengali script (বাংলা হরফ) only — NEVER Banglish or transliteration. Every *_en value MUST be in professional natural English only. Each bn/en pair must express the same meaning.

CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that expresses a full thought.
- NEVER output 1-2 word broken phrases or fragments.
- Do NOT use Banglish, emoji, markdown, or code fences.

Return ONLY valid JSON, no markdown, no code fences. Format:
{
  "tasks_header_bn": "funny complete header in Bengali script, max 100 chars",
  "tasks_header_en": "same header in English, max 90 chars",
  "loading_tasks_bn": "funny loading message in Bengali script, max 80 chars",
  "loading_tasks_en": "same loading message in English, max 80 chars",
  "category_empty_bn": "funny empty message in Bengali script, max 90 chars",
  "category_empty_en": "same empty message in English, max 90 chars",
  "your_tasks_first_bn": "funny label in Bengali script, max 80 chars",
  "your_tasks_first_en": "same label in English, max 80 chars",
  "video_tutorial_header_bn": "funny header in Bengali script, max 100 chars",
  "video_tutorial_header_en": "same header in English, max 100 chars",
  "video_panel_subtitle_bn": "funny subtitle in Bengali script, max 100 chars",
  "video_panel_subtitle_en": "same subtitle in English, max 100 chars",
  "daily_tip_bn": "funny tip in Bengali script, max 130 chars",
  "daily_tip_en": "same tip in English, max 130 chars",
  "dashboard_alert_bn": "funny alert in Bengali script, max 100 chars",
  "dashboard_alert_en": "same alert in English, max 100 chars",
  "task_available_bn": "funny message in Bengali script, max 90 chars",
  "task_available_en": "same message in English, max 90 chars",
  "watch_tutorial_bn": "funny CTA in Bengali script, max 100 chars",
  "watch_tutorial_en": "same CTA in English, max 100 chars"
}

No emoji.`;

  for (const key of allKeys) {
    for (const model of MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1.4, maxOutputTokens: 1800 } }),
          signal: controller.signal,
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") continue;
        const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
        if (!text) continue;
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const result: Record<string, string> = {};
        for (const field of FIELDS) {
          const val = typeof parsed[field] === "string" ? parsed[field].trim() : "";
          if (val && val.split(/\s+/).length >= 3 && !isTruncated(val)) {
            result[field] = val;
          } else {
            result[field] = FALLBACK[field];
          }
        }
        return result;
      } catch {
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await db.from("daily_ai_ui_copy").select("*").eq("content_date", today).maybeSingle();
    if (existing) return jsonResponse(existing);

    const aiResult = await generateUICopy(db);
    const content = aiResult ?? FALLBACK;

    const { data, error } = await db.from("daily_ai_ui_copy").insert({ content_date: today, ...content }).select("*").single();
    if (error) {
      const { data: fallback } = await db.from("daily_ai_ui_copy").select("*").eq("content_date", today).maybeSingle();
      if (fallback) return jsonResponse(fallback);
      return jsonResponse(content);
    }
    return jsonResponse(data);
  } catch (err) {
    console.error("ai-ui-copy error:", err);
    return jsonResponse({ ...FALLBACK, error: String(err).slice(0, 200) }, 500);
  }
});
