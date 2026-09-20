// Sends a web push notification to every device belonging to a user.
//
// NOT YET DEPLOYED. Deploy with:  supabase functions deploy send-push
// Requires these Edge Function secrets:
//   VAPID_PUBLIC_KEY   (same value as the app's VITE_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY  (never exposed to the browser)
//   VAPID_SUBJECT      (e.g. mailto:you@redroom.space)
//
// Called from other server-side code (a database trigger or another function),
// never directly from the browser — it is authorised with the service role key
// and will deliver to any user id it is given.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Maps a notification kind to the column in notification_preferences. */
const PREFERENCE_COLUMN: Record<string, string> = {
  like: "notif_likes",
  comment: "notif_comments",
  follow: "notif_follows",
  message: "notif_messages",
  live: "notif_live",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@redroom.space";

    if (!publicKey || !privateKey) {
      return new Response(
        JSON.stringify({ error: "Push is not configured on the server." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { userId, title, body, url, kind } = await req.json();
    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: "userId and title are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Respect the switches the user already has in Settings. Those toggles existed
    // but nothing ever consulted them.
    const column = kind ? PREFERENCE_COLUMN[kind] : undefined;
    if (column) {
      const { data: prefs } = await admin
        .from("notification_preferences")
        .select(column)
        .eq("user_id", userId)
        .maybeSingle();
      // Absent row means defaults, which are on. Only an explicit false opts out.
      if (prefs && (prefs as Record<string, boolean>)[column] === false) {
        return new Response(JSON.stringify({ sent: 0, skipped: "user opted out" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (error) throw error;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, skipped: "no devices" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/", tag: kind });
    const stale: string[] = [];
    let sent = 0;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err) {
          // 404/410 mean the browser dropped this subscription for good. Keeping it
          // would retry a dead endpoint on every future notification.
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) stale.push(s.id);
          else console.error("Push send failed:", status, (err as Error)?.message);
        }
      }),
    );

    if (stale.length) {
      await admin.from("push_subscriptions").delete().in("id", stale);
    }

    return new Response(JSON.stringify({ sent, pruned: stale.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
