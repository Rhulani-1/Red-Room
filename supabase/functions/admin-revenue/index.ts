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

    // Extract JWT from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jres({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");

    // Verify user via Supabase auth, using service role client
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jres({ error: "Invalid authentication" }, 401);

    // Require admin role
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jres({ error: "Admin only" }, 403);

    const { date } = await req.json() as { date?: string };
    const targetDate = date ? new Date(date) : new Date();
    if (Number.isNaN(targetDate.valueOf())) {
      return jres({ error: "Invalid date" }, 400);
    }

    const from = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0));
    const to = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

    const { data: rows, error: revenueError } = await supabase
      .from("platform_revenue")
      .select("id, creator_id, source_type, gross_amount, commission_amount, created_at")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });

    if (revenueError) {
      throw revenueError;
    }

    const creatorIds = Array.from(new Set((rows ?? []).map((row) => row.creator_id)));
    const profileQuery = creatorIds.length
      ? await supabase.from("profiles").select("user_id, display_name, username").in("user_id", creatorIds)
      : { data: [] };

    return jres({
      rows: rows ?? [],
      profiles: profileQuery.data ?? [],
    });
  } catch (error: unknown) {
    console.error("admin-revenue error", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jres({ error: msg }, 500);
  }
});
