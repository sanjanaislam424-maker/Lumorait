import { createClient } from "npm:@supabase/supabase-js@2";
// Per-item AI content regeneration endpoint for admin panel

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---- Table: daily_ai_content ----
// Fields: funny_bn, funny_en, tip_bn, tip_en
const CONTENT_ITEMS: Record<string, { desc: string; maxChars: number }> = {
  funny_bn: { desc: "A witty, sarcastic 1-line funny truth about social media, freelancing, or micro-tasks in PURE Bengali script (বাংলা হরফ), NOT Banglish. Casual best-friend tone.", maxChars: 120 },
  funny_en: { desc: "The same funny line in witty, engaging English. Casual best-friend tone.", maxChars: 100 },
  tip_bn: { desc: "A practical, actionable social media growth tip in PURE Bengali script (বাংলা হরফ), NOT Banglish. With a funny sarcastic twist.", maxChars: 150 },
  tip_en: { desc: "The same tip in witty English with a sarcastic twist.", maxChars: 120 },
};

// ---- Table: daily_ai_ui_copy ----
// Banglish UI copy fields
const UI_COPY_ITEMS: Record<string, { desc: string; maxChars: number }> = {
  tasks_header: { desc: "Funny header for the tasks page in BANGLISH (Bangla in English script). Casual, sarcastic, best-friend tone.", maxChars: 80 },
  loading_tasks: { desc: "Funny loading message for the tasks page in BANGLISH.", maxChars: 70 },
  category_empty: { desc: "Funny message when no tasks in a category in BANGLISH.", maxChars: 80 },
  your_tasks_first: { desc: "Funny label for user's own tasks shown first in BANGLISH.", maxChars: 60 },
  video_tutorial_header: { desc: "Funny header for video tutorial section in BANGLISH.", maxChars: 90 },
  video_panel_subtitle: { desc: "Funny subtitle under the video tutorial in BANGLISH.", maxChars: 90 },
  daily_tip: { desc: "Funny practical social media growth tip in BANGLISH.", maxChars: 120 },
  dashboard_alert: { desc: "Funny alert reminding to do check-in in BANGLISH.", maxChars: 90 },
  task_available: { desc: "Funny message when a new task is available in BANGLISH.", maxChars: 80 },
  watch_tutorial: { desc: "Funny call-to-action to watch a tutorial in BANGLISH.", maxChars: 90 },
};

async function getApiKey(supabase: any): Promise<string | null> {
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
  return apiKey;
}

async function regenerateItem(
  apiKey: string,
  tableName: string,
  fieldName: string,
  desc: string,
  maxChars: number,
  currentValue: string,
): Promise<string | null> {
  const prompt = `You are the witty, sarcastic, hilarious AI assistant for "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Generate ONE replacement line of content. Be extremely funny, witty, and sarcastic.

Description: ${desc}
Max ${maxChars} characters.

Current value (do NOT repeat this, generate something completely different):
"${currentValue}"

Return ONLY the raw text string — no JSON, no markdown, no code fences, no quotes around it. Just the text.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.6, maxOutputTokens: 200 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const cleaned = text.replace(/```[a-z]*/g, "").replace(/```/g, "").replace(/^["']|["']$/g, "").trim();
    if (!cleaned || cleaned.length > maxChars + 20) return null;
    return cleaned;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { table, field } = body as { table: string; field: string };

    if (!table || !field) {
      return new Response(JSON.stringify({ error: "Missing 'table' or 'field'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate table and field
    let itemDef: { desc: string; maxChars: number } | undefined;
    if (table === "daily_ai_content") {
      itemDef = CONTENT_ITEMS[field];
    } else if (table === "daily_ai_ui_copy") {
      itemDef = UI_COPY_ITEMS[field];
    } else {
      return new Response(JSON.stringify({ error: "Invalid table" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!itemDef) {
      return new Response(JSON.stringify({ error: `Invalid field '${field}' for table '${table}'` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Fetch current row
    const { data: row } = await supabase
      .from(table)
      .select("*")
      .eq("content_date", today)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ error: "No content row for today" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentValue = (row as Record<string, string>)[field] || "";

    const apiKey = await getApiKey(supabase);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "No Gemini API key configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newValue = await regenerateItem(apiKey, table, field, itemDef.desc, itemDef.maxChars, currentValue);
    if (!newValue) {
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the database row
    const { error: updateError } = await supabase
      .from(table)
      .update({ [field]: newValue, updated_at: new Date().toISOString() })
      .eq("content_date", today);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ field, newValue, table }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err).slice(0, 200) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
