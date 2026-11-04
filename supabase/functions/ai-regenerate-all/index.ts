import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, extractText, generateContent, isTruncated, jsonResponse, loadGeminiSettings, parseModelJson } from "../_shared/gemini.ts";

const TIMEOUT_MS = 20_000;

const CONTENT_FALLBACK = {
  funny_bn: "সোশ্যাল মিডিয়ায় ভাইরাল হতে গিয়ে নিজের অ্যাকাউন্ট হারানোই যেন নতুন যুগের সাফল্য!",
  funny_en: "Going viral is easy until your account becomes the main character in the disaster.",
  tip_bn: "প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।",
  tip_en: "Post quality content consistently; irregular promotion confuses the algorithm too.",
};

const UI_FALLBACK = {
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

const CONTENT_FIELDS = Object.keys(CONTENT_FALLBACK);
const UI_FIELDS = Object.keys(UI_FALLBACK);

function valid(value: unknown, bangla = false): value is string {
  if (typeof value !== "string" || value.trim().split(/\s+/).length < 3) return false;
  if (bangla && !/[\u0980-\u09FF]/u.test(value)) return false;
  if (!bangla && /[\u0980-\u09FF]/u.test(value)) return false;
  return true;
}

async function ask(keys: string[], prompt: string): Promise<Record<string, unknown> | null> {
  const result = await generateContent({
    keys,
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.3, maxOutputTokens: 1800 },
    },
    timeoutMs: TIMEOUT_MS,
    label: "ai-regenerate-all",
    accept: (json) => !isTruncated(json) && parseModelJson(extractText(json)) !== null,
  });
  if (!result.ok) return null;
  return parseModelJson(extractText(result.json));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { keys } = await loadGeminiSettings(db);
    const today = new Date().toISOString().split("T")[0];
    const prompt = `You are the ultimate chill best friend of the user on "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Your vibe: you're that hilarious, warm-hearted buddy who cracks jokes over adda, drops real growth tips like casual wisdom, and makes every interaction feel like a fun chat with your closest friend. You're witty, playful, a little sarcastic, but never mean — you roast with love.

Create fresh bilingual content for today. Return only valid JSON.
Every *_bn value must be natural, grammatical PURE Bengali script (বাংলা হরফ) only — like how friends actually talk in Bangla, warm and fun, never stiff or robotic. Every *_en value must be in natural, friendly, casual English — like texting your best friend. Each bn/en pair must express the same meaning with the same playful energy. Do not use Banglish, transliteration, emoji, markdown, or fragments.

CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that feels like something a fun friend would say.
- NEVER output 1-2 word broken phrases or fragments.
- Be creative, engaging, and full of personality — not boring or formal.

JSON keys: ${[...CONTENT_FIELDS, ...UI_FIELDS].join(", ")}
Content keys must be funny_bn/funny_en and tip_bn/tip_en — these are daily jokes and growth tips.
UI keys must use the exact *_bn and *_en names listed above — these are short, punchy UI labels and messages.
Keep each value concise, complete, and fun.`;

    const generated = keys.length > 0 ? await ask(keys, prompt) : null;
    if (keys.length === 0) console.error("ai-regenerate-all: no Gemini keys configured, saving fallback content");

    const content = Object.fromEntries(
      CONTENT_FIELDS.map((field) => [
        field,
        valid(generated?.[field], field.endsWith("_bn")) ? (generated![field] as string).trim() : CONTENT_FALLBACK[field as keyof typeof CONTENT_FALLBACK],
      ]),
    );
    const uiCopy = Object.fromEntries(
      UI_FIELDS.map((field) => [
        field,
        valid(generated?.[field], field.endsWith("_bn")) ? (generated![field] as string).trim() : UI_FALLBACK[field as keyof typeof UI_FALLBACK],
      ]),
    );
    const now = new Date().toISOString();

    const { data: contentRow } = await db.from("daily_ai_content").select("id").eq("content_date", today).maybeSingle();
    const contentWrite = contentRow
      ? db.from("daily_ai_content").update({ ...content, updated_at: now }).eq("content_date", today)
      : db.from("daily_ai_content").insert({ content_date: today, ...content });
    const { error: contentError } = await contentWrite;
    if (contentError) throw contentError;

    const { data: uiRow } = await db.from("daily_ai_ui_copy").select("content_date").eq("content_date", today).maybeSingle();
    const uiWrite = uiRow
      ? db.from("daily_ai_ui_copy").update({ ...uiCopy, updated_at: now }).eq("content_date", today)
      : db.from("daily_ai_ui_copy").insert({ content_date: today, ...uiCopy });
    const { error: uiError } = await uiWrite;
    if (uiError) throw uiError;

    return jsonResponse({ success: true, content, uiCopy, fallback: !generated });
  } catch (err) {
    console.error("ai-regenerate-all failed:", err);
    return jsonResponse({ error: "Regeneration failed", detail: String(err).slice(0, 300) }, 500);
  }
});
