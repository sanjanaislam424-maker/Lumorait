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

async function generateWithAI(): Promise<{ funny_bn: string; funny_en: string; tip_bn: string; tip_en: string } | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;

  const prompt = `You are the witty, sarcastic, hilarious AI assistant for "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Generate exactly 4 lines of content. Be extremely funny, witty, and sarcastic — like a best friend who roasts you lovingly.

The Bengali lines MUST be in PURE Bengali script (বাংলা হরফ), NOT Banglish.
The English lines MUST be in witty, engaging English.

Return ONLY valid JSON, no markdown, no code fences.

Format:
{
  "funny_bn": "A witty, sarcastic 1-line funny truth about social media algorithms, viral marketing, freelancing, or micro-tasks in PURE Bengali script, casual best-friend tone, max 120 chars",
  "funny_en": "The same funny line in witty English, max 100 chars",
  "tip_bn": "A practical, actionable social media growth tip in PURE Bengali script, with a funny sarcastic twist, max 150 chars",
  "tip_en": "The same tip in witty English with a sarcastic twist, max 120 chars"
}

Example tone for Bengali: "ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে!"
Example tone for English: "Facebook's algorithm knows your ex better than you!"

Make it fresh and different each time. Be creative, specific, and hilarious. No emoji.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.4, maxOutputTokens: 500 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.funny_bn && parsed.funny_en && parsed.tip_bn && parsed.tip_en) {
      return parsed;
    }
    return null;
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

    // Try AI generation, fall back to static content
    const aiResult = await generateWithAI();
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
