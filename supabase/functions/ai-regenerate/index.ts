import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
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

async function generateItem(allKeys: string[], desc: string, maxChars: number, currentValue: string, field: string, bangla: boolean): Promise<string | null> {
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

  for (const key of allKeys) {
    for (const model of MODELS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 1.5, maxOutputTokens: 512 },
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`ai-regenerate: ${field} model ${model} key failed (${res.status}): ${errBody.slice(0, 200)}`);
          continue;
        }
        const data = await res.json();
        if (data?.candidates?.[0]?.finishReason === "MAX_TOKENS") continue;
        const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
        if (!text) continue;
        const validated = validate(text, bangla, maxChars);
        if (validated) return validated;
        console.error(`ai-regenerate: ${field} validation failed for: ${text.slice(0, 100)}`);
      } catch (err) {
        console.error(`ai-regenerate: ${field} model ${model} error:`, err);
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
    if (rowError) {
      console.error(`ai-regenerate: select error for ${table}:`, rowError);
    }

    const currentValue = row ? (row as Record<string, string>)[field] || "" : "";
    const allKeys = await getKeys(db);

    if (allKeys.length === 0) {
      const fallbackValue = itemDef.fallback;
      if (row) {
        await db.from(table).update({ [field]: fallbackValue, updated_at: new Date().toISOString() }).eq("content_date", today);
      } else {
        await db.from(table).insert({ content_date: today, [field]: fallbackValue });
      }
      return response({ field, newValue: fallbackValue, table, fallback: true, warning: "No API keys configured — saved fallback content" });
    }

    const newValue = await generateItem(allKeys, itemDef.desc, itemDef.maxChars, currentValue, field, itemDef.bangla);
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
        // Row may have been created by another process — try update instead
        const retry = await db.from(table).update({ [field]: finalValue, updated_at: now }).eq("content_date", today);
        updateError = retry.error;
      }
    }

    if (updateError) {
      console.error(`ai-regenerate: DB update error for ${table}.${field}:`, updateError);
      return response({ field, newValue: finalValue, table, fallback: usedFallback, warning: "DB update failed" });
    }

    // Verify the write by reading back
    const { data: verifyRow } = await db.from(table).select(field).eq("content_date", today).maybeSingle();
    const dbValue = verifyRow ? (verifyRow as Record<string, string>)[field] : null;

    return response({
      field,
      newValue: dbValue || finalValue,
      table,
      fallback: usedFallback,
      ...(usedFallback ? { warning: "AI generation failed — saved static fallback content instead" } : {}),
    });
  } catch (err) {
    console.error("ai-regenerate error:", err);
    return response({ error: "Regeneration failed" }, 500);
  }
});
