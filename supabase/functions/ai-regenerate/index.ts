import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, extractText, generateContent, isTruncated, jsonResponse, loadGeminiSettings } from "../_shared/gemini.ts";

const TIMEOUT_MS = 15_000;

const CONTENT_ITEMS: Record<string, { desc: string; maxChars: number; fallback: string; bangla: boolean }> = {
  funny_bn: {
    desc: "A witty, sarcastic 1-line funny truth about social media, freelancing, or micro-tasks",
    maxChars: 120,
    fallback: "সোশ্যাল মিডিয়ায় ভাইরাল হতে গিয়ে নিজের অ্যাকাউন্ট হারানোই যেন নতুন যুগের সাফল্য!",
    bangla: true,
  },
  funny_en: {
    desc: "A witty, sarcastic 1-line funny truth about social media, freelancing, or micro-tasks",
    maxChars: 100,
    fallback: "Going viral is easy until your account becomes the main character in the disaster.",
    bangla: false,
  },
  tip_bn: {
    desc: "A practical, actionable social media growth tip with a funny sarcastic twist",
    maxChars: 150,
    fallback: "প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।",
    bangla: true,
  },
  tip_en: {
    desc: "A practical, actionable social media growth tip with a funny sarcastic twist",
    maxChars: 120,
    fallback: "Post quality content consistently; irregular promotion confuses the algorithm too.",
    bangla: false,
  },
};

const UI_ITEMS: Record<string, { desc: string; maxChars: number; fallback: string; bangla: boolean }> = {
  tasks_header_bn: { desc: "Funny header for the tasks page", maxChars: 100, fallback: "কাজের তালিকা প্রস্তুত আছে, এবার একটু পরিশ্রম করলে উপার্জনও হবে।", bangla: true },
  tasks_header_en: { desc: "Funny header for the tasks page", maxChars: 90, fallback: "Your task list is ready; a little effort can turn it into real earnings.", bangla: false },
  loading_tasks_bn: { desc: "Funny loading message for the tasks page", maxChars: 80, fallback: "কাজগুলো আসছে, একটু অপেক্ষা করুন; ধৈর্যও এক ধরনের দক্ষতা।", bangla: true },
  loading_tasks_en: { desc: "Funny loading message for the tasks page", maxChars: 80, fallback: "Your tasks are loading; patience is a useful skill too.", bangla: false },
  category_empty_bn: { desc: "Funny message when no tasks exist in a category", maxChars: 90, fallback: "এই বিভাগে এখন কোনো কাজ নেই; অন্য বিভাগটি দেখে নিন।", bangla: true },
  category_empty_en: { desc: "Funny message when no tasks exist in a category", maxChars: 90, fallback: "There are no tasks in this category right now; try another one.", bangla: false },
  your_tasks_first_bn: { desc: "Funny label explaining user's own tasks appear first", maxChars: 80, fallback: "আপনার কাজগুলো সবার আগে দেখানো হচ্ছে, যাতে সুযোগ হাতছাড়া না হয়।", bangla: true },
  your_tasks_first_en: { desc: "Funny label explaining user's own tasks appear first", maxChars: 80, fallback: "Your tasks appear first so you never miss an opportunity.", bangla: false },
  video_tutorial_header_bn: { desc: "Funny header for the video tutorial section", maxChars: 100, fallback: "কাজ শুরু করার আগে ছোট টিউটোরিয়ালটি দেখে নিন।", bangla: true },
  video_tutorial_header_en: { desc: "Funny header for the video tutorial section", maxChars: 100, fallback: "Watch the short tutorial before you start the task.", bangla: false },
  video_panel_subtitle_bn: { desc: "Funny subtitle under the video tutorial", maxChars: 100, fallback: "দুই মিনিটের নির্দেশনা আপনার কাজটি সঠিকভাবে শেষ করতে সাহায্য করবে।", bangla: true },
  video_panel_subtitle_en: { desc: "Funny subtitle under the video tutorial", maxChars: 100, fallback: "A two-minute guide can help you complete the task correctly.", bangla: false },
  daily_tip_bn: { desc: "Funny practical social media growth tip", maxChars: 130, fallback: "প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।", bangla: true },
  daily_tip_en: { desc: "Funny practical social media growth tip", maxChars: 130, fallback: "Post quality content consistently; irregular promotion confuses the algorithm too.", bangla: false },
  dashboard_alert_bn: { desc: "Funny alert reminding user to do daily check-in", maxChars: 100, fallback: "আজকের চেক-ইনটি সম্পন্ন করুন, কারণ ছোট অভ্যাসই বড় ফল তৈরি করে।", bangla: true },
  dashboard_alert_en: { desc: "Funny alert reminding user to do daily check-in", maxChars: 100, fallback: "Complete today's check-in because small habits create meaningful results.", bangla: false },
  task_available_bn: { desc: "Funny message announcing a new task is available", maxChars: 90, fallback: "আপনার জন্য নতুন কাজ অপেক্ষা করছে; সুযোগটি কাজে লাগান।", bangla: true },
  task_available_en: { desc: "Funny message announcing a new task is available", maxChars: 90, fallback: "A new task is waiting for you; make the opportunity count.", bangla: false },
  watch_tutorial_bn: { desc: "Funny call-to-action to watch a tutorial", maxChars: 100, fallback: "টিউটোরিয়ালটি দেখে কাজটি আরও আত্মবিশ্বাসের সঙ্গে শুরু করুন।", bangla: true },
  watch_tutorial_en: { desc: "Funny call-to-action to watch a tutorial", maxChars: 100, fallback: "Watch the tutorial and start the task with confidence.", bangla: false },
  box_btn_task_bn: { desc: "Funny witty button text for the P2P task option on the Mystery Box screen — invites the user to complete a task to earn another box", maxChars: 80, fallback: "টাস্ক পূরণ করে আরেকটি বক্স ফাটান", bangla: true },
  box_btn_task_en: { desc: "Funny witty button text for the P2P task option on the Mystery Box screen — invites the user to complete a task to earn another box", maxChars: 70, fallback: "Blast another box by doing a task!", bangla: false },
  box_btn_ad_bn: { desc: "Funny witty button text for the rewarded video option on the Mystery Box screen — invites the user to watch an ad to earn another box", maxChars: 80, fallback: "অ্যাড দেখে আরেকটি বক্স ফাটান", bangla: true },
  box_btn_ad_en: { desc: "Funny witty button text for the rewarded video option on the Mystery Box screen — invites the user to watch an ad to earn another box", maxChars: 70, fallback: "Blast another box by watching an ad!", bangla: false },
};

function cleanText(text: string): string {
  return text
    .replace(/```[a-z]*/g, "")
    .replace(/```/g, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();
}

function validate(text: string, bangla: boolean, maxChars: number): string | null {
  const cleaned = cleanText(text);
  if (!cleaned) return null;
  if (cleaned.split(/\s+/).length < 3) return null;
  if (bangla && !/[\u0980-\u09FF]/u.test(cleaned)) return null;
  if (!bangla && /[\u0980-\u09FF]/u.test(cleaned)) return null;
  if (cleaned.length > maxChars + 30) return cleaned.slice(0, maxChars);
  return cleaned;
}

async function generateItem(keys: string[], desc: string, maxChars: number, currentValue: string, field: string, bangla: boolean): Promise<string | null> {
  const langInstruction = bangla
    ? "The output MUST be in PURE Bengali script (বাংলা হরফ) only. NEVER use Banglish, transliteration, or Latin script."
    : "The output MUST be in natural, professional English only. NEVER use Bengali script or non-English characters.";

  const prompt = `You are the ultimate chill best friend of the user on "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Your vibe: you're that hilarious, warm-hearted buddy who cracks jokes over adda, drops real growth tips like casual wisdom, and makes every interaction feel like a fun chat with your closest friend. You're witty, playful, a little sarcastic, but never mean — you roast with love.

Generate ONE replacement line of content. Be extremely funny, witty, and full of personality. Talk like a friend, not a robot.

Task: ${desc}
${langInstruction}
Max ${maxChars} characters. The output MUST be a COMPLETE, grammatically correct sentence that feels like something a fun friend would say.

Current value (do NOT repeat or paraphrase this — generate something completely different):
"${currentValue}"

Return ONLY the raw text string — no JSON, no markdown, no code fences, no quotes. Just the text itself.`;

  const result = await generateContent({
    keys,
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.5, maxOutputTokens: 8192 },
    },
    timeoutMs: TIMEOUT_MS,
    label: `ai-regenerate ${field}`,
    accept: (json) => !isTruncated(json) && validate(extractText(json), bangla, maxChars) !== null,
  });
  if (!result.ok) return null;
  return validate(extractText(result.json), bangla, maxChars);
}

function response(body: unknown, status = 200): Response {
  return jsonResponse(body, status);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "POST only" }, 405);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const table = body.table;
    const field = body.field;

    if (!table || !field) return response({ error: "Missing 'table' or 'field'" }, 400);

    let itemDef: { desc: string; maxChars: number; fallback: string; bangla: boolean } | undefined;
    if (table === "daily_ai_content") {
      itemDef = CONTENT_ITEMS[field];
    } else if (table === "daily_ai_ui_copy") {
      itemDef = UI_ITEMS[field];
    } else {
      return response({ error: "Invalid table" }, 400);
    }
    if (!itemDef) return response({ error: `Invalid field '${field}'` }, 400);

    const today = new Date().toISOString().split("T")[0];
    const { data: row, error: rowError } = await db.from(table).select("*").eq("content_date", today).maybeSingle();
    if (rowError) console.error(`ai-regenerate: select error for ${table}:`, rowError);

    const currentValue = row ? (row as Record<string, string>)[field] || "" : "";
    const { keys } = await loadGeminiSettings(db);

    const newValue = keys.length > 0
      ? await generateItem(keys, itemDef.desc, itemDef.maxChars, currentValue, field, itemDef.bangla)
      : null;
    if (keys.length === 0) console.error("ai-regenerate: no Gemini keys configured, saving fallback content");
    const finalValue = newValue || itemDef.fallback;
    const usedFallback = newValue === null;
    const now = new Date().toISOString();

    let updateError = null;
    if (row) {
      const result = await db.from(table).update({ [field]: finalValue, updated_at: now }).eq("content_date", today);
      updateError = result.error;
    } else {
      const result = await db.from(table).insert({ content_date: today, [field]: finalValue });
      updateError = result.error;
      if (updateError) {
        const retry = await db.from(table).update({ [field]: finalValue, updated_at: now }).eq("content_date", today);
        updateError = retry.error;
      }
    }

    if (updateError) {
      console.error(`ai-regenerate: DB update error for ${table}.${field}:`, updateError);
      return response({ field, newValue: finalValue, table, fallback: usedFallback, warning: "DB update failed" });
    }

    const { data: verifyRow } = await db.from(table).select(field).eq("content_date", today).maybeSingle();
    const dbValue = verifyRow ? (verifyRow as Record<string, string>)[field] : null;

    return response({
      field,
      newValue: dbValue || finalValue,
      table,
      fallback: usedFallback,
      ...(usedFallback ? { warning: keys.length === 0 ? "No API keys configured — saved fallback content" : "AI generation failed — saved static fallback content instead" } : {}),
    });
  } catch (err) {
    console.error("ai-regenerate error:", err);
    return response({ error: "Regeneration failed", detail: String(err).slice(0, 300) }, 500);
  }
});
