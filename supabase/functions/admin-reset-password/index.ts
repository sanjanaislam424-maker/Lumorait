import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) {
      return json({ error: "Missing auth token" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Invalid session" }, 401);
    }
    const adminId = userData.user.id;

    const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_platform_admin");
    if (adminErr || isAdmin !== true) {
      return json({ error: "Not authorized" }, 403);
    }

    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!UUID_PATTERN.test(userId)) {
      return json({ error: "Invalid user" }, 400);
    }
    if (password.length < 8 || password.length > 72) {
      return json({ error: "Password must be 8 to 72 characters" }, 400);
    }

    const adminClient = createClient(url, serviceKey);

    const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, { password });
    if (updateErr) {
      console.error("admin password reset failed", updateErr);
      return json({ error: "Could not reset the password. Please try again." }, 500);
    }

    const { error: logErr } = await adminClient.from("user_activity_log").insert({
      user_id: userId,
      actor_id: adminId,
      kind: "credential_change",
      summary: "Password reset by an administrator",
    });
    if (logErr) {
      console.error("credential change log failed", logErr);
    }

    return json({ success: true });
  } catch (err) {
    console.error("admin-reset-password error", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
