import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return jres({ error: "Server configuration error" }, 500);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jres({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jres({ error: "Invalid authentication" }, 401);

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) return jres({ error: "Admin only" }, 403);

    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [eventsRes, paymentsRes, boostsRes] = await Promise.all([
      supabase.from("payfast_webhook_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("payments")
        .select("id, user_id, amount, status, payment_type, content_id, payfast_payment_id, created_at")
        .eq("status", "pending")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("post_boosts")
        .select("id, user_id, post_id, tier, amount, status, payment_method, payment_ref, created_at")
        .eq("status", "pending")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    if (boostsRes.error) throw boostsRes.error;

    return jres({
      events: eventsRes.data ?? [],
      payments: paymentsRes.data ?? [],
      boosts: boostsRes.data ?? [],
    });
  } catch (error: unknown) {
    console.error("admin-payfast-dashboard error", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jres({ error: msg }, 500);
  }
});
