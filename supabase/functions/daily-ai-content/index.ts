import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FALLBACK_FUNNY_BN = [
  "ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে — সে জানে তুমি কখন অনলাইন আসবে!",
  "ভাইরাল হওয়ার আগে একটা জিনিস লাগে — তোমার কনটেন্ট নাকি তোমার হিম্মত?",
  "ফ্রিল্যান্সিং মানে স্বাধীনতা? হ্যাঁ, ক্লায়েন্ট না দিলে ঘুমানোর স্বাধীনতা!",
  "মাইক্রো-টাস্ক করে কোটিপতি হওয়া যায় না, কিন্তু না করলে চা-ও বানানো যায় না!",
  "ইউটিউবে সাবস্ক্রাইব বাটন চাপলে মানুষ চলে যায়, কিন্তু ভিডিও দেখে না — অ্যালগরিদমের বিচার!",
];
const FALLBACK_FUNNY_EN = [
  "Facebook's algorithm knows your ex better than you — it knows when you'll come online!",
  "Going viral takes one thing: is it your content or your courage?",
  "Freelancing means freedom? Yes, freedom to sleep when no client gives work!",
  "Micro-tasks won't make you a millionaire, but without them you can't even make tea!",
  "On YouTube people click subscribe but don't watch — the algorithm's verdict!",
];
const FALLBACK_TIP_BN = [
  "ফেসবুক পেজ রিচ বাড়াতে প্রতিদিন নির্দিষ্ট সময়ে পোস্ট করো — সকাল ৯টা ও রাত ৮টা সেরা সময়!",
  "ইউটিউব শর্টস আপলোড করার সেরা সময় বিকেল ৫টা থেকে রাত ৯টা — অ্যালগরিদম তখন সবচেয়ে সক্রিয়!",
  "টাস্ক কমপ্লিট করার প্রমাণে সবসময় ভালো মানের স্ক্রিনশট দাও — অ্যাপ্রুভ পাওয়ার সম্ভাবনা ৩x বাড়ে!",
  "ভিডিও কনটেন্টের প্রথম ৩ সেকেন্ডে হুক রাখো — নাহলে দর্শক স্ক্রল করে চলে যাবে!",
];
const FALLBACK_TIP_EN = [
  "Post on Facebook at 9 AM and 8 PM daily for peak reach!",
  "Best time to upload YouTube Shorts is 5-9 PM — algorithm is most active!",
  "High-quality screenshots as task proof triple your approval chances!",
  "Hook viewers in the first 3 seconds of video content — or they scroll away!",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
const TIMEOUT_MS = 30_000;

async function getAllKeys(supabaseClient: any): Promise<string[]> {
  const { data: settings } = await supabaseClient
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

function isCompleteSentence(text: string, minWords: number = 4): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < minWords) return false;
  return true;
}

async function generateWithAI(
  supabaseClient: any,
  recentFunnyBn: string[], recentFunnyEn: string[], recentTipBn: string[], recentTipEn: string[],
): Promise<{ funny_bn: string; funny_en: string; tip_bn: string; tip_en: string } | null> {
  const allKeys = await getAllKeys(supabaseClient);
  if (allKeys.length === 0) {
    console.error("daily-ai-content: no Gemini API keys configured");
    return null;
  }

  const avoidList = [
    ...recentFunnyBn.map((s) => `"${s}"`),
    ...recentFunnyEn.map((s) => `"${s}"`),
    ...recentTipBn.map((s) => `"${s}"`),
    ...recentTipEn.map((s) => `"${s}"`),
  ].join("\n");

  const doNotRepeat = avoidList
    ? `\n\nCRITICAL: Do NOT repeat or closely paraphrase any of these previous days' content. Generate completely fresh, different ideas:\n${avoidList}\n`
    : "";

  const prompt = `You are the witty, sarcastic, hilarious AI assistant for "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Generate exactly 4 lines of content. Be extremely funny, witty, and sarcastic — like a best friend who roasts you lovingly.

The Bengali lines MUST be in PURE Bengali script (বাংলা হরফ), NOT Banglish.
The English lines MUST be in witty, engaging English.
${doNotRepeat}
CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that expresses a full thought.
- NEVER output 1-2 word broken phrases or contextless fragments like "লাইক করো", "ট্রল পোস্টের", "মাইক্রো টাস্ক করে বড়লোক".
- Each line must be readable, meaningful, and form a full humorous or actionable thought from start to finish.
- A good sentence has a subject, a verb, and a clear punchline or takeaway.

Return ONLY valid JSON, no markdown, no code fences.

Format:
{
  "funny_bn": "A complete, witty, sarcastic 1-line funny truth about social media algorithms, viral marketing, freelancing, or micro-tasks in PURE Bengali script, casual best-friend tone, max 120 chars. Must be a full sentence.",
  "funny_en": "The same funny line in witty English, max 100 chars. Must be a full complete sentence.",
  "tip_bn": "A practical, actionable social media growth tip in PURE Bengali script, with a funny sarcastic twist, max 150 chars. Must be a complete sentence with clear advice.",
  "tip_en": "The same tip in witty English with a sarcastic twist, max 120 chars. Must be a complete sentence with clear advice."
}

Good examples (complete sentences):
- Bengali: "ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে — সে জানে তুমি কখন অনলাইন আসবে!"
- English: "Facebook's algorithm knows your ex better than you — it knows when you'll come online!"

BAD examples (NEVER do this — these are broken fragments):
- "লাইক করো" (too short, no context)
- "ট্রল পোস্টের" (not a sentence)
- "মাইক্রো টাস্ক করে বড়লোক" (incomplete thought)

Make it fresh and different each time. Be creative, specific, and hilarious. No emoji.`;

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
              generationConfig: { temperature: 1.4, maxOutputTokens: 500 },
            }),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`daily-ai-content: Gemini ${model} key#${k} failed (${res.status}): ${errBody.slice(0, 300)}`);
          continue;
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text ?? "")
          .join("") || "";
        if (!text) {
          console.error(`daily-ai-content: Gemini ${model} key#${k} returned empty reply`);
          continue;
        }
        const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (
          parsed.funny_bn && parsed.funny_en && parsed.tip_bn && parsed.tip_en &&
          isCompleteSentence(parsed.funny_bn) && isCompleteSentence(parsed.funny_en) &&
          isCompleteSentence(parsed.tip_bn) && isCompleteSentence(parsed.tip_en)
        ) {
          return parsed;
        }
        console.error(`daily-ai-content: Gemini ${model} key#${k} returned incomplete content (fragments detected), trying next`);
        continue;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          console.error(`daily-ai-content: Gemini ${model} key#${k} timed out after ${TIMEOUT_MS}ms`);
        } else if (err instanceof SyntaxError) {
          console.error(`daily-ai-content: Gemini ${model} key#${k} returned invalid JSON:`, err);
        } else {
          console.error(`daily-ai-content: Gemini ${model} key#${k} error:`, err);
        }
        continue;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  console.error("daily-ai-content: All keys and models exhausted, using static fallback");
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

    // Check if content already exists for today
    const { data: existing } = await supabase
      .from("daily_ai_content")
      .select("*")
      .eq("content_date", today)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify(existing), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent days' content to avoid repetition
    const { data: recentRows } = await supabase
      .from("daily_ai_content")
      .select("funny_bn, funny_en, tip_bn, tip_en")
      .order("content_date", { ascending: false })
      .limit(7);

    const recentFunnyBn = (recentRows ?? []).map((r) => r.funny_bn).filter(Boolean);
    const recentFunnyEn = (recentRows ?? []).map((r) => r.funny_en).filter(Boolean);
    const recentTipBn = (recentRows ?? []).map((r) => r.tip_bn).filter(Boolean);
    const recentTipEn = (recentRows ?? []).map((r) => r.tip_en).filter(Boolean);

    // Try AI generation, fall back to static content
    const aiResult = await generateWithAI(supabase, recentFunnyBn, recentFunnyEn, recentTipBn, recentTipEn);
    const content = aiResult ?? {
      funny_bn: pick(FALLBACK_FUNNY_BN),
      funny_en: pick(FALLBACK_FUNNY_EN),
      tip_bn: pick(FALLBACK_TIP_BN),
      tip_en: pick(FALLBACK_TIP_EN),
    };

    const { data, error } = await supabase
      .from("daily_ai_content")
      .insert({ content_date: today, ...content })
      .select("*")
      .single();

    if (error) {
      // Race condition: another instance inserted first, fetch it
      const { data: fallback } = await supabase
        .from("daily_ai_content")
        .select("*")
        .eq("content_date", today)
        .maybeSingle();
      if (fallback) {
        return new Response(JSON.stringify(fallback), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
