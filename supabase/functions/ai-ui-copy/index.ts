import { createClient } from "npm:@supabase/supabase-js@2";
// AI-driven dynamic UI copy generator for Lumora IT

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
const TIMEOUT_MS = 30_000;

const FALLBACK: Record<string, string> = {
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

const FIELDS = [
  "tasks_header", "loading_tasks", "category_empty", "your_tasks_first",
  "video_tutorial_header", "video_panel_subtitle", "daily_tip",
  "dashboard_alert", "task_available", "watch_tutorial",
];

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

async function generateUICopy(supabase: any): Promise<Record<string, string> | null> {
  const allKeys = await getAllKeys(supabase);
  if (allKeys.length === 0) {
    console.error("ai-ui-copy: no Gemini API keys configured");
    return null;
  }

  const prompt = `You are the witty, sarcastic, funny assistant for "Lumora IT", a Bangladeshi micro-task and SMM app.
Generate 10 short UI copy lines in BANGLISH (Bangla written in English script mixed with Bangla words — casual, best-friend tone, hilarious, sarcastic).

CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that expresses a full thought.
- NEVER output 1-2 word broken phrases or contextless fragments like "Like koro", "Troll er", "Micro task kore borolok".
- Each line must be readable, meaningful, and form a full humorous or actionable thought from start to finish.
- A good sentence has a subject, a verb, and a clear punchline or takeaway.

Return ONLY valid JSON, no markdown, no code fences. Format:
{
  "tasks_header": "funny complete header sentence for the tasks page, max 80 chars",
  "loading_tasks": "funny complete loading message sentence, max 70 chars",
  "category_empty": "funny complete message when no tasks in a category, max 80 chars",
  "your_tasks_first": "funny complete label sentence for user's own tasks shown first, max 60 chars",
  "video_tutorial_header": "funny complete header sentence for video tutorial section, max 90 chars",
  "video_panel_subtitle": "funny complete subtitle sentence under the video tutorial, max 90 chars",
  "daily_tip": "funny complete practical social media growth tip sentence, max 120 chars",
  "dashboard_alert": "funny complete alert sentence reminding to do check-in, max 90 chars",
  "task_available": "funny complete message when a new task is available, max 80 chars",
  "watch_tutorial": "funny complete call-to-action sentence to watch a tutorial, max 90 chars"
}

Good examples (complete sentences):
- "Shob parbo bhabe bose theko na, bolo to ektukhani tutorial ta dekhe ashbe?"
- "Arey moshay! Kaj apnar jonno opekkha korche, ektu haat chalao!"
- "Ajker tippony: Chat-e ghumash na, kaj shesh kore baki ghumum."

BAD examples (NEVER do this — these are broken fragments):
- "Like koro" (too short, no context)
- "Troll er" (not a sentence)
- "Micro task kore borolok" (incomplete thought)

Be creative, fresh, and different each time. No emoji.`;

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
              generationConfig: { temperature: 1.5, maxOutputTokens: 800 },
            }),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`ai-ui-copy: Gemini ${model} key#${k} failed (${res.status}): ${errBody.slice(0, 300)}`);
          continue;
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") || "";
        if (!text) {
          console.error(`ai-ui-copy: Gemini ${model} key#${k} returned empty reply`);
          continue;
        }
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        const result: Record<string, string> = {};
        let allValid = true;
        for (const field of FIELDS) {
          const val = typeof parsed[field] === "string" ? parsed[field].trim() : "";
          if (val && val.split(/\s+/).length >= 3) {
            result[field] = val;
          } else {
            console.error(`ai-ui-copy: field '${field}' returned fragment: "${val}" — using fallback`);
            result[field] = FALLBACK[field];
            allValid = false;
          }
        }
        return result;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.error(`ai-ui-copy: Gemini ${model} key#${k} timed out after ${TIMEOUT_MS}ms`);
        } else if (err instanceof SyntaxError) {
          console.error(`ai-ui-copy: Gemini ${model} key#${k} returned invalid JSON:`, err);
        } else {
          console.error(`ai-ui-copy: Gemini ${model} key#${k} error:`, err);
        }
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  console.error("ai-ui-copy: All keys and models exhausted, using static fallback");
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];

    const { data: existing } = await supabase
      .from("daily_ai_ui_copy")
      .select("*")
      .eq("content_date", today)
      .maybeSingle();

    if (existing) {
      return jsonResponse(existing);
    }

    const aiResult = await generateUICopy(supabase);
    const content = aiResult ?? FALLBACK;

    const insertRow = {
      content_date: today,
      ...content,
    };

    const { data, error } = await supabase
      .from("daily_ai_ui_copy")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      console.error("ai-ui-copy: insert failed, trying re-read:", error);
      const { data: fallback } = await supabase
        .from("daily_ai_ui_copy")
        .select("*")
        .eq("content_date", today)
        .maybeSingle();
      if (fallback) {
        return jsonResponse(fallback);
      }
      return jsonResponse(content);
    }

    return jsonResponse(data);
  } catch (err) {
    console.error("ai-ui-copy: unhandled error:", err);
    return jsonResponse({ ...FALLBACK, error: String(err).slice(0, 200) }, 500);
  }
});
