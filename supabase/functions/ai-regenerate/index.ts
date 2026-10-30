import { createClient } from "npm:@supabase/supabase-js@2";
// Per-item AI content regeneration endpoint for admin panel

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
const TIMEOUT_MS = 30_000;

// Bengali text uses ~3x more tokens than English per character.
// Give ample room so Gemini never truncates mid-sentence.

function isTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Ends with hanging comma — almost certainly cut mid-sentence
  if (/[,،]$/u.test(trimmed)) return true;
  // Ends with a Bengali incomplete conjunction or hanging particle
  if(/[\u0985-\u09B9]$/u.test(trimmed) && /\b[\u0995\u09A6\u09A8\u09A4\u09B0\u09B8]$/u.test(trimmed)) return true;
  // Ends with "..." or a cut-off indicator
  if(/\.\.\.$/u.test(trimmed)) return true;
  // Ends with a word fragment (single trailing Bengali consonant with no vowel sound)
  const last3 = trimmed.slice(-3);
  if(/[\u0995-\u09B9]$/u.test(last3) && !/[\u09BE-\u09CC\u09D7\.\!\?\u0964\u0965]$/u.test(trimmed)) {
    // Only flag if it doesn't end with a terminal punctuation or Bengali daari
    if(!/[\.\!\?\u0964\u0965]$/u.test(trimmed)) return true;
  }
  return false;
}

function isCompleteSentence(text: string, minWords: number = 4): boolean {
  const trimmed = text.trim();
  if (trimmed.split(/\s+/).length < minWords) return false;
  if (isTruncated(trimmed)) return false;
  return true;
}

// ---- Table: daily_ai_content ----
const CONTENT_ITEMS: Record<string, { desc: string; maxChars: number; fallback: string }> = {
  funny_bn: {
    desc: "A witty, sarcastic 1-line funny truth about social media, freelancing, or micro-tasks in PURE Bengali script (বাংলা হরফ), NOT Banglish. Casual best-friend tone.",
    maxChars: 120,
    fallback: "সোশ্যাল মিডিয়ায় ভাইরাল হতে গিয়ে নিজের অ্যাকাউন্ট হ্যাক খাওয়া — এটাই আসল ফ্রিল্যান্সিং সাফল্য!",
  },
  funny_en: {
    desc: "The same funny line in witty, engaging English. Casual best-friend tone.",
    maxChars: 100,
    fallback: "Going viral is easy — just post something embarrassing and watch your career disappear!",
  },
  tip_bn: {
    desc: "A practical, actionable social media growth tip in PURE Bengali script (বাংলা হরফ), NOT Banglish. With a funny sarcastic twist.",
    maxChars: 150,
    fallback: "প্রতিদিন পোস্ট করো, কিন্তু কপি-পেস্ট করলে ফলোয়ার শুধু আয়নায় দেখবে — আসল কন্টেন্ট দাও!",
  },
  tip_en: {
    desc: "The same tip in witty English with a sarcastic twist.",
    maxChars: 120,
    fallback: "Post daily, but if you copy-paste, your followers will only exist in your mirror. Be original!",
  },
};

// ---- Table: daily_ai_ui_copy ----
const UI_COPY_ITEMS: Record<string, { desc: string; maxChars: number; fallback: string }> = {
  tasks_header: { desc: "Funny header for the tasks page in BANGLISH.", maxChars: 80, fallback: "Kaj er palla ora kore, apni boshe chaye khao moshay!" },
  loading_tasks: { desc: "Funny loading message for the tasks page in BANGLISH.", maxChars: 70, fallback: "Kaj ane barita hocche moshay, ektu dhoyro doro!" },
  category_empty: { desc: "Funny message when no tasks in a category in BANGLISH.", maxChars: 80, fallback: "Ekhon kaj nai mama, cha-biskut khaiya asho!" },
  your_tasks_first: { desc: "Funny label for user's own tasks shown first in BANGLISH.", maxChars: 60, fallback: "Apnar kaj sobar upore, rajar moto bosun!" },
  video_tutorial_header: { desc: "Funny header for video tutorial section in BANGLISH.", maxChars: 90, fallback: "Shob parbo bhabe bose theko na, ektukhani tutorial dekhe ashbe?" },
  video_panel_subtitle: { desc: "Funny subtitle under the video tutorial in BANGLISH.", maxChars: 90, fallback: "Dui minit video, baki jiboner jonno kaj shikhe nao!" },
  daily_tip: { desc: "Funny practical social media growth tip in BANGLISH.", maxChars: 120, fallback: "Ajker tippony: Chat-e ghumash na, kaj shesh kore baki ghumum." },
  dashboard_alert: { desc: "Funny alert reminding to do check-in in BANGLISH.", maxChars: 90, fallback: "Arey moshay! Check-in kore coins nibe na? Koshto kore kamaiben!" },
  task_available: { desc: "Funny message when a new task is available in BANGLISH.", maxChars: 80, fallback: "Arey moshay! Kaj apnar jonno opekkha korche, ektu haat chalao!" },
  watch_tutorial: { desc: "Funny call-to-action to watch a tutorial in BANGLISH.", maxChars: 90, fallback: "Shob parbo bhabe bose theko na, bolo to ektukhani tutorial ta dekhe ashbe?" },
};

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

async function regenerateItem(
  allKeys: string[],
  desc: string,
  maxChars: number,
  currentValue: string,
): Promise<string | null> {
  const prompt = `You are the witty, sarcastic, hilarious AI assistant for "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Generate ONE replacement line of content. Be extremely funny, witty, and sarcastic.

Description: ${desc}
Max ${maxChars} characters.

CRITICAL QUALITY RULES:
- The output MUST be a COMPLETE, grammatically correct sentence that expresses a full thought.
- NEVER output 1-2 word broken phrases or contextless fragments like "লাইক করো", "ট্রল পোস্টের", "মাইক্রো টাস্ক করে বড়লোক".
- The sentence must be readable, meaningful, and form a full humorous or actionable thought from start to finish.
- A good sentence has a subject, a verb, and a clear punchline or takeaway.

Current value (do NOT repeat this, generate something completely different):
"${currentValue}"

Good example: "ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে — সে জানে তুমি কখন অনলাইন আসবে!"
Bad example (NEVER do this): "লাইক করো" (broken fragment, no context)

Return ONLY the raw text string — no JSON, no markdown, no code fences, no quotes around it. Just the text.`;

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
              generationConfig: { temperature: 1.6, maxOutputTokens: 1024 },
            }),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`ai-regenerate: Gemini ${model} key#${k} failed (${res.status}): ${errBody.slice(0, 300)}`);
          continue;
        }
        const data = await res.json();
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === "MAX_TOKENS") {
          console.error(`ai-regenerate: Gemini ${model} key#${k} hit MAX_TOKENS (output truncated by token limit)`);
          continue;
        }
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") || "";
        if (!text) {
          console.error(`ai-regenerate: Gemini ${model} key#${k} returned empty reply`);
          continue;
        }
        const cleaned = text.replace(/```[a-z]*/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").trim();
        if (!cleaned) {
          console.error(`ai-regenerate: Gemini ${model} key#${k} text cleaned to empty`);
          continue;
        }
        if (isTruncated(cleaned)) {
          console.error(`ai-regenerate: Gemini ${model} key#${k} returned truncated text: "${cleaned.slice(-40)}"`);
          continue;
        }
        const wordCount = cleaned.split(/\s+/).length;
        if (wordCount < 4) {
          console.error(`ai-regenerate: Gemini ${model} key#${k} returned fragment (${wordCount} words): "${cleaned}"`);
          continue;
        }
        return cleaned.slice(0, maxChars + 20);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.error(`ai-regenerate: Gemini ${model} key#${k} timed out after ${TIMEOUT_MS}ms`);
        } else {
          console.error(`ai-regenerate: Gemini ${model} key#${k} error:`, err);
        }
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  console.error("ai-regenerate: All keys and models exhausted");
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  let table = "";
  let field = "";
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    table = body.table;
    field = body.field;

    if (!table || !field) {
      return jsonResponse({ error: "Missing 'table' or 'field'" }, 400);
    }

    // Validate table and field
    let itemDef: { desc: string; maxChars: number; fallback: string } | undefined;
    if (table === "daily_ai_content") {
      itemDef = CONTENT_ITEMS[field];
    } else if (table === "daily_ai_ui_copy") {
      itemDef = UI_COPY_ITEMS[field];
    } else {
      return jsonResponse({ error: "Invalid table" }, 400);
    }

    if (!itemDef) {
      return jsonResponse({ error: `Invalid field '${field}' for table '${table}'` }, 400);
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: row, error: rowError } = await supabase
      .from(table)
      .select("*")
      .eq("content_date", today)
      .maybeSingle();

    if (rowError) {
      console.error(`ai-regenerate: could not fetch today's row from ${table}:`, rowError);
      return jsonResponse({ error: "Database read failed" }, 500);
    }

    if (!row) {
      return jsonResponse({ error: "No content row for today" }, 404);
    }

    const currentValue = (row as Record<string, string>)[field] || "";

    const allKeys = await getAllKeys(supabase);
    if (allKeys.length === 0) {
      console.error("ai-regenerate: no Gemini API keys configured");
      // Return fallback content instead of crashing
      return jsonResponse({
        field,
        newValue: itemDef.fallback,
        table,
        fallback: true,
        warning: "No API keys configured — using static fallback",
      });
    }

    const newValue = await regenerateItem(allKeys, itemDef.desc, itemDef.maxChars, currentValue);

    const finalValue = newValue || itemDef.fallback;
    const usedFallback = newValue === null;

    if (usedFallback) {
      console.warn(`ai-regenerate: AI generation failed for ${table}.${field}, using fallback content`);
    }

    // Update the database row with service role (bypasses RLS)
    const { error: updateError } = await supabase
      .from(table)
      .update({ [field]: finalValue, updated_at: new Date().toISOString() })
      .eq("content_date", today);

    if (updateError) {
      console.error(`ai-regenerate: DB update failed for ${table}.${field}:`, updateError);
      return jsonResponse({
        field,
        newValue: finalValue,
        table,
        fallback: usedFallback,
        warning: usedFallback ? "AI failed, used fallback — but DB update failed too" : "DB update failed",
      }, 500);
    }

    return jsonResponse({
      field,
      newValue: finalValue,
      table,
      fallback: usedFallback,
      ...(usedFallback ? { warning: "AI generation failed — saved static fallback content instead" } : {}),
    });
  } catch (err) {
    console.error("ai-regenerate: unhandled error:", err);
    return jsonResponse({ error: `Server error: ${String(err).slice(0, 200)}` }, 500);
  }
});
