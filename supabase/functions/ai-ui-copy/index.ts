import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, extractText, generateContent, isTruncated as isTruncatedJson, jsonResponse, loadGeminiSettings, parseModelJson } from "../_shared/gemini.ts";

const TIMEOUT_MS = 20_000;

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
  dashboard_alert_en: "Complete today’s check-in because small habits create meaningful results.",
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

const PROMPT = `You are the ultimate chill best friend of the user on "Lumora IT", a Bangladeshi micro-task and SMM app.
Your vibe: you're that hilarious, warm-hearted buddy who cracks jokes over adda, drops real growth tips like casual wisdom, and makes every interaction feel like a fun chat with your closest friend. You're witty, playful, a little sarcastic, but never mean — you roast with love.

Generate 20 short UI copy lines as bilingual pairs. Every *_bn value MUST be in PURE Bengali script (বাংলা হরফ) only — like how friends actually talk in Bangla, warm and fun, never stiff or robotic. NEVER use Banglish or transliteration. Every *_en value MUST be in natural, friendly, casual English — like texting your best friend. Each bn/en pair must express the same meaning with the same playful energy.

CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that feels like something a fun friend would say.
- NEVER output 1-2 word broken phrases or fragments.
- Be creative, engaging, and full of personality — not boring or formal.
- Do NOT use Banglish, emoji, markdown, or code fences.

Return ONLY valid JSON, no markdown, no code fences. Format:
{
  "tasks_header_bn": "fun, friendly complete header in Bengali script, max 100 chars",
  "tasks_header_en": "same header in casual friendly English, max 90 chars",
  "loading_tasks_bn": "fun loading message in Bengali script, max 80 chars",
  "loading_tasks_en": "same loading message in casual English, max 80 chars",
  "category_empty_bn": "fun empty message in Bengali script, max 90 chars",
  "category_empty_en": "same empty message in casual English, max 90 chars",
  "your_tasks_first_bn": "fun label in Bengali script, max 80 chars",
  "your_tasks_first_en": "same label in casual English, max 80 chars",
  "video_tutorial_header_bn": "fun header in Bengali script, max 100 chars",
  "video_tutorial_header_en": "same header in casual English, max 100 chars",
  "video_panel_subtitle_bn": "fun subtitle in Bengali script, max 100 chars",
  "video_panel_subtitle_en": "same subtitle in casual English, max 100 chars",
  "daily_tip_bn": "fun growth tip in Bengali script, max 130 chars",
  "daily_tip_en": "same tip in casual English, max 130 chars",
  "dashboard_alert_bn": "fun alert in Bengali script, max 100 chars",
  "dashboard_alert_en": "same alert in casual English, max 100 chars",
  "task_available_bn": "fun message in Bengali script, max 90 chars",
  "task_available_en": "same message in casual English, max 90 chars",
  "watch_tutorial_bn": "fun CTA in Bengali script, max 100 chars",
  "watch_tutorial_en": "same CTA in casual English, max 100 chars"
}

No emoji.`;

async function generateUICopy(keys: string[]): Promise<Record<string, string> | null> {
  if (keys.length === 0) return null;
  const result = await generateContent({
    keys,
    body: {
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: { temperature: 1.4, maxOutputTokens: 1800 },
    },
    timeoutMs: TIMEOUT_MS,
    label: "ai-ui-copy",
    accept: (json) => !isTruncatedJson(json) && parseModelJson(extractText(json)) !== null,
  });
  if (!result.ok) return null;
  const parsed = parseModelJson(extractText(result.json)) ?? {};
  const output: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = typeof parsed[field] === "string" ? (parsed[field] as string).trim() : "";
    output[field] = value && value.split(/\s+/).length >= 3 && !isTruncated(value) ? value : FALLBACK[field];
  }
  return output;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await db.from("daily_ai_ui_copy").select("*").eq("content_date", today).maybeSingle();
    if (existing) return jsonResponse(existing);

    const { keys } = await loadGeminiSettings(db);
    if (keys.length === 0) console.error("ai-ui-copy: no Gemini keys configured, saving fallback copy");
    const content = (await generateUICopy(keys)) ?? FALLBACK;

    const { data, error } = await db.from("daily_ai_ui_copy").insert({ content_date: today, ...content }).select("*").single();
    if (error) {
      console.error("ai-ui-copy: insert failed:", error);
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
