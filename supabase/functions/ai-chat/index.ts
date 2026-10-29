import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: string;
  content: string;
}

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"];

async function callGeminiModel(model: string, apiKey: string, systemPrompt: string, contents: unknown[]): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.8, maxOutputTokens: 600 },
        }),
      },
    );
    if (!res.ok) {
      console.error(`Gemini ${model} failed (${res.status}): ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) console.error(`Gemini ${model} returned no text:`, JSON.stringify(data));
    return text || null;
  } catch (err) {
    console.error(`Gemini ${model} request error:`, err);
    return null;
  }
}

async function callGemini(apiKey: string, systemPrompt: string, history: ChatMessage[]): Promise<string | null> {
  const contents = history.map((m) => ({
    role: m.role === "assistant" || m.role === "admin" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (const model of GEMINI_MODELS) {
    const reply = await callGeminiModel(model, apiKey, systemPrompt, contents);
    if (reply) return reply;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, sessionId } = await req.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settings } = await supabase
      .from("app_settings")
      .select("gemini_api_keys, ai_system_prompt, ai_active_key_index")
      .eq("id", 1)
      .maybeSingle();

    const apiKeys: string[] = Array.isArray(settings?.gemini_api_keys) ? settings.gemini_api_keys : [];
    const systemPrompt: string = settings?.ai_system_prompt || "You are a helpful assistant.";
    let activeIndex: number = settings?.ai_active_key_index ?? 0;

    const envKey = Deno.env.get("GEMINI_API_KEY");
    const allKeys = [...apiKeys.filter(Boolean)];
    if (envKey && !allKeys.includes(envKey)) allKeys.push(envKey);

    if (allKeys.length === 0) {
      return new Response(JSON.stringify({
        reply: "I'm sorry, no AI keys are configured yet. Please contact support.",
        noKeys: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let reply: string | null = null;
    let usedKeyIndex = activeIndex % allKeys.length;

    for (let attempt = 0; attempt < allKeys.length; attempt++) {
      const keyIndex = (activeIndex + attempt) % allKeys.length;
      reply = await callGemini(allKeys[keyIndex], systemPrompt, messages);
      if (reply) {
        usedKeyIndex = keyIndex;
        if (keyIndex !== activeIndex) {
          await supabase.from("app_settings").update({ ai_active_key_index: keyIndex }).eq("id", 1);
        }
        break;
      }
    }

    if (!reply) {
      reply = "I'm having trouble responding right now. Please try again in a moment, or click 'Talk to Human' to reach our support team.";
    }

    if (sessionId) {
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: reply,
      });
    }

    return new Response(JSON.stringify({ reply, keyIndex: usedKeyIndex }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
