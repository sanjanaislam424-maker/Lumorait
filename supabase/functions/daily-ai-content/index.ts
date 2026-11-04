import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FALLBACK_FUNNY_BN = [
  "ফেসবুকের অ্যালগরিদম তোমার এক্সের চেয়ে বেশি যত্নশীল — সে তোমাকে দেখেই পুরনো মেমোরিয়াল দেখায়!",
  "তুই ভাইরাল হতে চাস? আগে দেখ তোর কনটেন্টে আছে কি শুধু হিম্মত নাকি কিছু আছে!",
  "ফ্রিল্যান্সিং মানে স্বাধীনতা ভাই — ক্লায়েন্ট না থাকলে রাত দুটায় ঘুমানোর পূর্ণ স্বাধীনতা!",
  "মাইক্রো-টাস্ক করে কোটিপতি হওয়া যায় না, কিন্তু না করলে চায়ের টাকাও জোগাড় হয় না!",
  "ইউটিউবে সাবস্ক্রাইব বাটন চাপলে মানুষ চলে যায় — ভিডিও দেখার সময় আলাদা ব্যাপার!",
  "ফেসবুকে লাইক দিয়ে ভাবিস ভাই তোরা দোস্ত — কিন্তু কেউ ক্লিক করে না, অ্যালগরিদমের এটাই খেলা!",
  "পেজ রিচ কম হলে ভেবেছিস অ্যালগরিদম তোর দুশমন — আসলে সে তোর কনটেন্ট দেখে হতাশ!",
  "সোশ্যাল মিডিয়ায় সবাই সেলিব্রিটি — শুধু ফলোয়ার না থাকলে সেটা বোঝা যায় না!",
];
const FALLBACK_FUNNY_EN = [
  "Facebook's algorithm cares more than your ex — it shows you old memories the moment you log in!",
  "Wanna go viral? First check if your content has actual substance or just audacity!",
  "Freelancing means freedom bro — total freedom to sleep at 2 AM when no client shows up!",
  "Micro-tasks won't make you a millionaire, but skip them and you can't even afford tea!",
  "On YouTube people smash subscribe and leave — watching the video is a whole different story!",
  "You think likes mean friendship on Facebook? Nobody clicks through — that's the algorithm's joke!",
  "Low page reach? You blamed the algorithm — but it's just disappointed by your content!",
  "Everyone's a celebrity on social media — until you notice they have zero followers!",
];
const FALLBACK_TIP_BN = [
  "ফেসবুক পেজ রিচ বাড়াতে প্রতিদিন সকাল ৯টা ও রাত ৮টায় পোস্ট করো — অ্যালগরিদম তখন সবচেয়ে বেশি মুডে থাকে!",
  "ইউটিউব শর্টস আপলোড করার সেরা সময় বিকেল ৫টা থেকে রাত ৯টা — মানুষ তখন স্ক্রল করতে করতে আটকে যায়!",
  "টাস্ক কমপ্লিট করার প্রমাণে সবসময় ক্লিয়ার স্ক্রিনশট দাও — অ্যাডমিনও তো মানুষ, তারও চোখ লাগে!",
  "ভিডিওর প্রথম ৩ সেকেন্ডে হুক রাখো — নাহলে দর্শক স্ক্রল করে পালাবে তোর হাত ধরার আগেই!",
  "পেজে পোস্ট করার আগে ক্যাপশন দুবার পড়ো — টাইপো দেখলে মানুষ হাসে, কনটেন্ট নয়!",
  "কনটেন্ট বানাতে গিয়ে পারফেকশনিজমে পড়িস না — বেশি ভাবলে আর পোস্টই করবি না, শুধু ভাববি!",
];
const FALLBACK_TIP_EN = [
  "Post on Facebook at 9 AM and 8 PM daily — that's when the algorithm is in the best mood!",
  "Best time for YouTube Shorts is 5-9 PM — people are scrolling and get stuck on good stuff!",
  "Always submit crystal-clear screenshots as task proof — admins are human too, they need to see!",
  "Hook viewers in the first 3 seconds — or they scroll away before you can even say hi!",
  "Read your caption twice before posting — typos make people laugh at you, not your content!",
  "Don't fall into perfectionism when creating content — overthink it and you'll never post anything!",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash"];
const TIMEOUT_MS = 20_000;

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

function isTruncated(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/[,،]$/u.test(trimmed)) return true;
  if (/\.\.\.$/u.test(trimmed)) return true;
  if (!/[.!?\u0964\u0965]$/u.test(trimmed) && /[\u0995-\u09B9]$/u.test(trimmed)) return true;
  return false;
}

function isCompleteSentence(text: string, minWords: number = 4): boolean {
  const words = text.trim().split(/\s+/);
  if (words.length < minWords) return false;
  if (isTruncated(text.trim())) return false;
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

  const prompt = `You are the ultimate chill best friend of the user on "Lumora IT", a Bangladeshi social media micro-task and SMM app.
Your vibe: you're that hilarious, warm-hearted buddy who cracks jokes over adda, drops real growth tips like casual wisdom, and makes every interaction feel like a fun chat with your closest friend. You're witty, playful, a little sarcastic, but never mean — you roast with love.

Generate exactly 4 lines of content for today. Be extremely funny, witty, and full of personality — like a best friend cracking jokes over tea.

The Bengali lines MUST be in PURE Bengali script (বাংলা হরফ), NOT Banglish — like how friends actually talk in Bangla, warm and fun, never stiff or robotic.
The English lines MUST be in witty, casual, friendly English — like texting your best friend.
${doNotRepeat}
CRITICAL QUALITY RULES:
- Each line MUST be a COMPLETE, grammatically correct sentence that feels like something a fun friend would say.
- NEVER output 1-2 word broken phrases or contextless fragments like "লাইক করো", "ট্রল পোস্টের", "মাইক্রো টাস্ক করে বড়লোক".
- Each line must be readable, meaningful, and form a full humorous or actionable thought from start to finish.
- A good sentence has a subject, a verb, and a clear punchline or takeaway.
- Be creative, specific, and hilarious — not boring or formal. No emoji.

Return ONLY valid JSON, no markdown, no code fences.

Format:
{
  "funny_bn": "A complete, witty, fun 1-line truth about social media, freelancing, or micro-tasks in PURE Bengali script, casual best-friend adda tone, max 120 chars. Must be a full sentence.",
  "funny_en": "The same funny line in witty, casual English — like texting your best friend, max 100 chars. Must be a full complete sentence.",
  "tip_bn": "A practical, actionable social media growth tip in PURE Bengali script, with a funny playful twist, max 150 chars. Must be a complete sentence with clear advice.",
  "tip_en": "The same tip in witty, casual English with a playful twist, max 120 chars. Must be a complete sentence with clear advice."
}

Good examples (complete sentences with buddy energy):
- Bengali: "ফেসবুকের অ্যালগরিদম তোমার চেয়ে তোমার এক্সকে বেশি চেনে — সে জানে তুমি কখন অনলাইন আসবে!"
- English: "Facebook's algorithm knows your ex better than you — it knows when you'll come online!"

BAD examples (NEVER do this — these are broken fragments):
- "লাইক করো" (too short, no context)
- "ট্রল পোস্টের" (not a sentence)
- "মাইক্রো টাস্ক করে বড়লোক" (incomplete thought)

Make it fresh and different each time. Be creative, specific, and hilarious.`;

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
              generationConfig: { temperature: 1.4, maxOutputTokens: 1200 },
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
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === "MAX_TOKENS") {
          console.error(`daily-ai-content: Gemini ${model} key#${k} hit MAX_TOKENS (output truncated)`);
          continue;
        }
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
      .upsert({ content_date: today, ...content }, { onConflict: "content_date" })
      .select("*")
      .single();

    if (error) {
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
      // Return the generated content even if DB insert fails
      return new Response(JSON.stringify(content), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Even on catastrophic error, return fallback content so the UI never breaks
    const fallback = {
      funny_bn: pick(FALLBACK_FUNNY_BN),
      funny_en: pick(FALLBACK_FUNNY_EN),
      tip_bn: pick(FALLBACK_TIP_BN),
      tip_en: pick(FALLBACK_TIP_EN),
    };
    return new Response(JSON.stringify(fallback), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
