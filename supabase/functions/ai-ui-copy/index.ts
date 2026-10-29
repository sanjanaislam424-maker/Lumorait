import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

async function generateUICopy(): Promise<Record<string, string> | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("gemini_api_keys, ai_active_key_index")
      .eq("id", 1)
      .maybeSingle();
    const keys: string[] = Array.isArray(settings?.gemini_api_keys) ? settings.gemini_api_keys : [];
    if (keys.length > 0) {
      const idx = settings?.ai_active_key_index ?? 0;
      apiKey = keys[idx % keys.length];
    }
  }
  if (!apiKey) return null;

  const prompt = `You are the witty, sarcastic, funny assistant for "Lumora IT", a Bangladeshi micro-task and SMM app.
Generate 10 short UI copy lines in BANGLISH (Bangla written in English script mixed with Bangla words — casual, best-friend tone, hilarious, sarcastic).

Return ONLY valid JSON, no markdown, no code fences. Format:
{
  "tasks_header": "funny header for the tasks page, max 80 chars",
  "loading_tasks": "funny loading message, max 70 chars",
  "category_empty": "funny message when no tasks in a category, max 80 chars",
  "your_tasks_first": "funny label for user's own tasks shown first, max 60 chars",
  "video_tutorial_header": "funny header for video tutorial section, max 90 chars",
  "video_panel_subtitle": "funny subtitle under the video tutorial, max 90 chars",
  "daily_tip": "funny practical social media growth tip, max 120 chars",
  "dashboard_alert": "funny alert reminding to do check-in, max 90 chars",
  "task_available": "funny message when a new task is available, max 80 chars",
  "watch_tutorial": "funny call-to-action to watch a tutorial, max 90 chars"
}

Examples of the tone:
- "Shob parbo bhabe bose theko na, bolo to ektukhani tutorial ta dekhe ashbe?"
- "Arey moshay! Kaj apnar jonno opekkha korche, ektu haat chalao!"
- "Ajker tippony: Chat-e ghumash na, kaj shesh kore baki ghumum."

Be creative, fresh, and different each time. No emoji.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.5, maxOutputTokens: 800 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const result: Record<string, string> = {};
    for (const field of FIELDS) {
      result[field] = typeof parsed[field] === "string" && parsed[field].trim() ? parsed[field].trim() : FALLBACK[field];
    }
    return result;
  } catch {
    return null;
  }
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
      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await generateUICopy();
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
      const { data: fallback } = await supabase
        .from("daily_ai_ui_copy")
        .select("*")
        .eq("content_date", today)
        .maybeSingle();
      if (fallback) {
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ...FALLBACK, error: String(err).slice(0, 200) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
