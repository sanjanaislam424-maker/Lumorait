import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DAY_MS = 86400000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch all active long-term promotions (those with a daily rate)
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, creator_id, title, promotion_daily_rate, promotion_end_at, promotion_last_charged_at, promotion_started_at, promotion_locked_until, promotion_coins, promotion_weight")
      .eq("is_promoted", true)
      .not("promotion_daily_rate", "is", null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let charged = 0;
    let stopped = 0;
    const results: { taskId: string; action: string }[] = [];

    for (const task of tasks ?? []) {
      const taskId = task.id;
      const dailyRate = task.promotion_daily_rate ?? 0;

      // Check if promotion_end_at has passed -> auto-stop
      if (task.promotion_end_at && new Date(task.promotion_end_at).getTime() <= now.getTime()) {
        await supabase.from("tasks").update({
          is_promoted: false,
          promotion_expires_at: nowIso,
          promotion_end_at: nowIso,
        }).eq("id", taskId);
        stopped += 1;
        results.push({ taskId, action: "auto_stopped_end_date" });
        continue;
      }

      // Ensure at least 24h has passed since last charge
      const lastCharged = task.promotion_last_charged_at ? new Date(task.promotion_last_charged_at) : null;
      if (lastCharged && (now.getTime() - lastCharged.getTime()) < DAY_MS) {
        continue;
      }

      // Determine rate: use daily_rate_after_lock if 8-day lock has passed
      const startedAt = task.promotion_started_at ? new Date(task.promotion_started_at) : null;
      const lockPassed = startedAt && (now.getTime() - startedAt.getTime()) >= 8 * DAY_MS;

      // Fetch the tier's daily_rate_after_lock from app_settings if lock passed
      let chargeRate = dailyRate;
      if (lockPassed) {
        const { data: settings } = await supabase
          .from("app_settings")
          .select("promotion_tiers")
          .eq("id", 1)
          .maybeSingle();
        const tiers = settings?.promotion_tiers as Array<{ daily_rate?: number; daily_rate_after_lock?: number }> | null;
        if (tiers && Array.isArray(tiers)) {
          // Find the matching tier by daily_rate (the one used for this promotion)
          const matchTier = tiers.find((t) => t.daily_rate === dailyRate);
          if (matchTier?.daily_rate_after_lock != null) {
            chargeRate = matchTier.daily_rate_after_lock;
          }
        }
      }

      // Deduct coins from the task creator's balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("lumora_coins")
        .eq("id", task.creator_id)
        .maybeSingle();

      if (profile) {
        const newBalance = Math.max(0, (profile.lumora_coins ?? 0) - chargeRate);
        await supabase.from("profiles").update({ lumora_coins: newBalance }).eq("id", task.creator_id);
        await supabase.from("transactions").insert({
          user_id: task.creator_id,
          type: "task_spend",
          amount: -chargeRate,
          status: "completed",
          note: `Daily boost charge: ${task.title}`,
        });
      }

      // Update last charged timestamp and accumulate total spent
      await supabase.from("tasks").update({
        promotion_last_charged_at: nowIso,
        promotion_coins: (task.promotion_coins ?? 0) + chargeRate,
        promotion_weight: (task.promotion_weight ?? 0) + chargeRate,
      }).eq("id", taskId);

      charged += 1;
      results.push({ taskId, action: `charged_${chargeRate}` });
    }

    return new Response(JSON.stringify({ processed: tasks?.length ?? 0, charged, stopped, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
