import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
const TIMEOUT_MS = 12_000;

const CONTENT_ITEMS: Record<string, { desc: string; maxChars: number; fallback: string }> = {
  funny_bn: {
    desc: "A witty, sarcastic 1-line funny truth about social media, freelancing, or micro-tasks in PURE Bengali script (বাংলা হরফ), NOT Banglish. Casual best-friend tone.",
    maxChars: 120,
    fallback: "সোশ্যাল মিডিয়ায় ভাইরাল হতে গিয়ে নিজের অ্যাকাউন্ট হারানোই যেন নতুন যুগের সাফল্য!",
  },
  funny_en: {
    desc: "The same funny line in witty, engaging English. Casual best-friend tone.",
    maxChars: 100,
    fallback: "Going viral is easy until your account becomes the main character in the disaster.",
  },
  tip_bn: {
    desc: "A practical, actionable social media growth tip in PURE Bengali script (বাংলা হরফ), NOT Banglish. With a funny sarcastic twist.",
    maxChars: 150,
    fallback: "প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।",
  },
  tip_en: {
    desc: "The same tip in witty English with a sarcastic twist.",
    maxChars: 120,
    fallback: "Post quality content consistently; irregular promotion confuses the algorithm too.",
  },
};

const UI_ITEMS: Record<string, { desc: string; maxChars: number; fallback: string }> = {
  tasks_header_bn: { desc: "Funny header for the tasks page in PURE Bengali script.", maxChars: 100, fallback: "কাজের তালিকা প্রস্তুত আছে, এবার একটু পরিশ্রম করলে উপার্জনও হবে।" },
  tasks_header_en: { desc: "Funny header for the tasks page in professional English.", maxChars: 90, fallback: "Your task list is ready; a little effort can turn it into real earnings." },
  loading_tasks_bn: { desc: "Funny loading message in PURE Bengali script.", maxChars: 80, fallback: "কাজগুলো আসছে, একটু অপেক্ষা করুন; ধৈর্যও এক ধরনের দক্ষতা।" },
  loading_tasks_en: { desc: "Funny loading message in professional English.", maxChars: 80, fallback: "Your tasks are loading; patience is a useful skill too." },
  category_empty_bn: { desc: "Funny message when no tasks in a category in PURE Bengali script.", maxChars: 90, fallback: "এই বিভাগে এখন কোনো কাজ নেই; অন্য বিভাগটি দেখে নিন।" },
  category_empty_en: { desc: "Funny message when no tasks in a category in professional English.", maxChars: 90, fallback: "There are no tasks in this category right now; try another one." },
  your_tasks_first_bn: { desc: "Funny label for user's own tasks in PURE Bengali script.", maxChars: 80, fallback: "আপনার কাজগুলো সবার আগে দেখানো হচ্ছে, যাতে সুযোগ হাতছাড়া না হয়।" },
  your_tasks_first_en: { desc: "Funny label for user's own tasks in professional English.", maxChars: 80, fallback: "Your tasks appear first so you never miss an opportunity." },
  video_tutorial_header_bn: { desc: "Funny header for video tutorial section in PURE Bengali script.", maxChars: 100, fallback: "কাজ শুরু করার আগে ছোট টিউটোরিয়ালটি দেখে নিন।" },
  video_tutorial_header_en: { desc: "Funny header for video tutorial section in professional English.", maxChars: 100, fallback: "Watch the short tutorial before you start the task." },
  video_panel_subtitle_bn: { desc: "Funny subtitle under the video tutorial in PURE Bengali script.", maxChars: 100, fallback: "দুই মিনিটের নির্দেশনা আপনার কাজটি সঠিকভাবে শেষ করতে সাহায্য করবে।" },
  video_panel_subtitle_en: { desc: "Funny subtitle under the video tutorial in professional English.", maxChars: 100, fallback: "A two-minute guide can help you complete the task correctly." },
  daily_tip_bn: { desc: "Funny practical social media growth tip in PURE Bengali script.", maxChars: 130, fallback: "প্রতিদিন নির্দিষ্ট সময়ে মানসম্মত পোস্ট করুন; অনিয়মিত প্রচারে অ্যালগরিদমও বিভ্রান্ত হয়।" },
  daily_tip_en: { desc: "Funny practical social media growth tip in professional English.", maxChars: 130, fallback: "Post quality content consistently; irregular promotion confuses the algorithm too." },
  dashboard_alert_bn: { desc: "Funny alert reminding to do check-in in PURE Bengali script.", maxChars: 100, fallback: "আজকের চেক-ইনটি সম্পন্ন করুন, কারণ ছোট অভ্যাসই বড় ফল তৈরি করে।" },
  dashboard_alert_en: { desc: "Funny alert reminding to do check-in in professional English.", maxChars: 100, fallback: "Complete today's check-in because small habits create meaningful results." },
  task_available_bn: { desc: "Funny message when a new task is available in PURE Bengali script.", maxChars: 90, fallback: "আপনার জন্য নতুন কাজ অপেক্ষা করছে; সুযোগটি কাজে লাগান।" },
  task_available_en: { desc: "Funny message when a new task is available in professional English.", maxChars: 90, fallback: "A new task is waiting for you; make the opportunity count." },
  watch_tutorial_bn: { desc: "Funny call-to-action to watch a tutorial in PURE Bengali script.", maxChars: 100, fallback: "টিউটোরিয়ালটি দেখে কাজটি আরও আত্মবিশ্বাসের সঙ্গে শুরু করুন।" },
  watch_tutorial_en: { desc: "Funny call-to-action to watch a tutorial in professional English.", maxChars: 100, fallback: "Watch the tutorial and start the task with confidence." },
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getKeys(db: any): Promise<string[]> {
  const { data } = await db.from("app_settings").select("gemini_api_keys").eq("id", 1).maybeSingle();
  const stored = Array.isArray(data?.gemini_api_keys) ? data.gemini_api_keys.filter(Boolean) : [];
  const env = Deno.env.get("GEMINI_API_KEY");
  return env && !stored.includes(env) ? [...stored, env] : stored;
}

function isValid(text: string, bangla: boolean): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.split(/\s+/).length < 4) return false;
  if (bangla && !/[\u0980-\u09FF]/u.test(trimmed)) return false;
  if (!bangla && /[\u0980-\u09FF]/u.test(trimmed)) return false;
  return /[.!?।]$/u.test(trimmed);
}

async function generateItem(allKeys: string[], desc: string, maxChars: number, currentValue: string): Promise<string | null> {
  const prompt = `You are the witty, sarcastic, hilarious AI assistant for "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Generate ONE replacement line of content. Be extremely funny, witty, and sarcastic.

Description: ${desc}
Max ${maxChars} characters.

CRITICAL QUALITY RULES:
- The output MUST be a COMPLETE, grammatically correct sentence that expresses a full thought.
- NEVER output 1-2 word broken phrases or contextless fragments.
- If the description says PURE Bengali script, the output MUST be in Bengali script (বাংলা হরফ) only, NOT Banglish or transliteration.
- If the description says English, the output MUST be in natural English only.

Current value (do NOT repeat this, generate something completely different):
"${currentValue}"

Return ONLY the raw text string — no JSON, no markdown, no code fences, no quotes around it. Just the text.`;

  for (const key of allKeys) {
    for (const model of MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1.5, maxOutputTokens: 512 } }),
          signal: controller.signal,
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") continue;
        const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
        if (!text) continue;
        const cleaned = text.replace(/```[a-z]*/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").trim();
        if (!cleaned || cleaned.split(/\s+/).length < 4) continue;
        return cleaned.slice(0, maxChars + 20);
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
  if (req.method !== "POST") return response({ error: "POST only" }, 405);

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const table = body.table;
    const field = body.field;

    if (!table || !field) return response({ error: "Missing 'table' or 'field'" }, 400);

    let itemDef: { desc: string; maxChars: number; fallback: string } | undefined;
    if (table === "daily_ai_content") {
      itemDef = CONTENT_ITEMS[field];
    } else if (table === "daily_ai_ui_copy") {
      itemDef = UI_ITEMS[field];
    } else {
      return response({ error: "Invalid table" }, 400);
    }
    if (!itemDef) return response({ error: `Invalid field '${field}'` }, 400);

    const today = new Date().toISOString().split("T")[0];
    const { data: row } = await db.from(table).select("*").eq("content_date", today).maybeSingle();

    if (!row) {
      return response({ field, newValue: itemDef.fallback, table, fallback: true, warning: "No content for today yet — saved fallback content" });
    }

    const currentValue = (row as Record<string, string>)[field] || "";
    const allKeys = await getKeys(db);

    if (allKeys.length === 0) {
      await db.from(table).update({ [field]: itemDef.fallback, updated_at: new Date().toISOString() }).eq("content_date", today);
      return response({ field, newValue: itemDef.fallback, table, fallback: true, warning: "No API keys configured — saved fallback content" });
    }

    const newValue = await generateItem(allKeys, itemDef.desc, itemDef.maxChars, currentValue);
    const finalValue = newValue || itemDef.fallback;
    const usedFallback = newValue === null;

    const { error: updateError } = await db.from(table).update({ [field]: finalValue, updated_at: new Date().toISOString() }).eq("content_date", today);
    if (updateError) {
      return response({ field, newValue: finalValue, table, fallback: usedFallback, warning: "DB update failed" });
    }

    return response({
      field,
      newValue: finalValue,
      table,
      fallback: usedFallback,
      ...(usedFallback ? { warning: "AI generation failed — saved static fallback content instead" } : {}),
    });
  } catch (err) {
    console.error("ai-regenerate error:", err);
    return response({ error: "Regeneration failed" }, 500);
  }
});
