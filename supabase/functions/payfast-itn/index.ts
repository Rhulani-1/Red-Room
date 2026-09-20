import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Md5 } from "https://deno.land/std@0.119.0/hash/md5.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use sandbox vs production. Keep in sync with payfast-create-payment.
const PAYFAST_SANDBOX = (Deno.env.get("PAYFAST_SANDBOX") ?? "true") === "true";
const PAYFAST_HOST = PAYFAST_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za";
// Hostnames PayFast uses to send ITN POSTs (production + sandbox).
const PAYFAST_HOSTNAMES = [
  "www.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
  "sandbox.payfast.co.za",
];

function md5Hex(input: string): string {
  return new Md5().update(input).toString();
}

// Reconstruct signature source from raw body — preserves field order as PayFast sent it,
// which is required for a matching MD5 (do NOT use formData iteration order).
function buildPostString(rawBody: string): { postString: string; signature: string | null } {
  const pairs: Array<[string, string]> = [];
  let signature: string | null = null;
  for (const segment of rawBody.split("&")) {
    if (!segment) continue;
    const eqIdx = segment.indexOf("=");
    const rawKey = eqIdx === -1 ? segment : segment.slice(0, eqIdx);
    const rawVal = eqIdx === -1 ? "" : segment.slice(eqIdx + 1);
    const key = decodeURIComponent(rawKey.replace(/\+/g, " "));
    const val = decodeURIComponent(rawVal.replace(/\+/g, " "));
    if (key === "signature") {
      signature = val;
      continue;
    }
    pairs.push([key, val]);
  }
  const postString = pairs
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
    .join("&");
  return { postString, signature };
}

function verifySignature(postString: string, providedSignature: string | null, passPhrase: string): boolean {
  if (!providedSignature) return false;
  const sigSource = passPhrase
    ? `${postString}&passphrase=${encodeURIComponent(passPhrase).replace(/%20/g, "+")}`
    : postString;
  return md5Hex(sigSource).toLowerCase() === providedSignature.toLowerCase();
}

async function verifySourceIp(req: Request): Promise<boolean> {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const candidates = [
    ...fwd.split(",").map((s) => s.trim()).filter(Boolean),
    req.headers.get("cf-connecting-ip") ?? "",
    req.headers.get("x-real-ip") ?? "",
  ].filter(Boolean);
  if (candidates.length === 0) return false;

  const allowed = new Set<string>();
  await Promise.all(
    PAYFAST_HOSTNAMES.flatMap((host) =>
      (["A", "AAAA"] as const).map(async (rt) => {
        try {
          const ips = await Deno.resolveDns(host, rt);
          for (const ip of ips) allowed.add(ip);
        } catch {
          // record type may not exist
        }
      }),
    ),
  );

  return candidates.some((ip) => allowed.has(ip));
}

async function verifyWithPayFast(rawBody: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${PAYFAST_HOST}/eng/query/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    return text === "VALID";
  } catch (e) {
    console.error("PayFast server confirmation failed:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const passPhrase = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Read raw body once — needed byte-for-byte for signature + server confirmation.
    const rawBody = await req.text();
    const { postString, signature } = buildPostString(rawBody);

    // Field map for downstream logic.
    const itnData: Record<string, string> = {};
    for (const segment of rawBody.split("&")) {
      if (!segment) continue;
      const eqIdx = segment.indexOf("=");
      const k = decodeURIComponent((eqIdx === -1 ? segment : segment.slice(0, eqIdx)).replace(/\+/g, " "));
      const v = eqIdx === -1 ? "" : decodeURIComponent(segment.slice(eqIdx + 1).replace(/\+/g, " "));
      itnData[k] = v;
    }

    console.log("PayFast ITN received:", JSON.stringify(itnData));

    // Insert webhook event log row up-front; we'll update flags as we verify.
    const sourceIp = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "")
      .split(",")[0].trim() || null;
    const { data: eventRow } = await supabase
      .from("payfast_webhook_events")
      .insert({
        m_payment_id: itnData.m_payment_id ?? null,
        payfast_payment_id: itnData.pf_payment_id ?? null,
        payment_status: itnData.payment_status ?? null,
        content_id: itnData.custom_str1 ?? null,
        amount_gross: itnData.amount_gross ? Number(itnData.amount_gross) : null,
        raw_body: rawBody,
        source_ip: sourceIp,
      })
      .select("id")
      .single();
    const eventId = eventRow?.id as string | undefined;
    const markEvent = async (patch: Record<string, unknown>) => {
      if (!eventId) return;
      await supabase.from("payfast_webhook_events").update(patch).eq("id", eventId);
    };

    // 1) Signature check
    const sigOk = verifySignature(postString, signature, passPhrase);
    await markEvent({ signature_ok: sigOk });
    if (!sigOk) {
      console.warn("PayFast ITN rejected: invalid signature");
      await markEvent({ error_message: "invalid signature" });
      return new Response("Invalid signature", { status: 400 });
    }

    // 2) Source IP check (skip in sandbox to allow PayFast sandbox/dev callbacks)
    if (!PAYFAST_SANDBOX) {
      const ipOk = await verifySourceIp(req);
      await markEvent({ ip_ok: ipOk });
      if (!ipOk) {
        console.warn("PayFast ITN rejected: source IP not in PayFast allowlist", {
          xff: req.headers.get("x-forwarded-for"),
        });
        await markEvent({ error_message: "invalid source ip" });
        return new Response("Invalid source", { status: 403 });
      }
    } else {
      await markEvent({ ip_ok: true });
    }

    // 3) Server confirmation — PayFast echoes "VALID" if the data matches their record
    const serverOk = await verifyWithPayFast(rawBody);
    await markEvent({ server_ok: serverOk });
    if (!serverOk) {
      console.warn("PayFast ITN rejected: server confirmation failed");
      await markEvent({ error_message: "server confirmation failed" });
      return new Response("Server confirmation failed", { status: 400 });
    }

    const paymentId = itnData.m_payment_id;
    const paymentStatus = itnData.payment_status;
    const payfastPaymentId = itnData.pf_payment_id;
    const contentId = itnData.custom_str1;
    const paymentType = itnData.custom_str2;
    const creatorId = itnData.custom_str3;
    const token = itnData.token; // For subscriptions

    if (!paymentId) {
      throw new Error("Missing payment ID in ITN");
    }

    // 4) Amount check — guard against tampered amount_gross
    if (itnData.amount_gross) {
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("amount")
        .eq("id", paymentId)
        .maybeSingle();
      if (existingPayment) {
        const expected = Number(existingPayment.amount);
        const got = Number(itnData.amount_gross);
        if (!Number.isFinite(got) || Math.abs(expected - got) > 0.01) {
          console.warn("PayFast ITN rejected: amount mismatch", { expected, got });
          await markEvent({ error_message: `amount mismatch expected=${expected} got=${got}` });
          return new Response("Amount mismatch", { status: 400 });
        }
      }
    }

    // Map PayFast status to our status
    let status = "pending";
    if (paymentStatus === "COMPLETE") status = "completed";
    else if (paymentStatus === "FAILED") status = "failed";
    else if (paymentStatus === "CANCELLED") status = "cancelled";

    // Update payment record
    const { error: updateError } = await supabase
      .from("payments")
      .update({
        status,
        payfast_payment_id: payfastPaymentId,
        payfast_token: token || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("Failed to update payment:", updateError);
      throw updateError;
    }

    // Update payment_logs row (if present) to reflect final status
    try {
      await supabase
        .from('payment_logs')
        .update({ status: status === 'completed' ? 'complete' : status, updated_at: new Date().toISOString(), metadata: { ...itnData } })
        .eq('payment_id', paymentId);
    } catch (e) {
      console.error('Failed to update payment_logs for', paymentId, e);
    }

    // Handle boost payments (contentId format: "boost:<boost_id>")
    const isBoost = typeof contentId === "string" && contentId.startsWith("boost:");
    const boostId = isBoost ? contentId.slice("boost:".length) : null;

    if (isBoost && boostId) {
      if (status === "completed") {
        const { data: boostRow } = await supabase
          .from("post_boosts")
          .select("duration_hours")
          .eq("id", boostId)
          .maybeSingle();
        const hours = boostRow?.duration_hours ?? 24;
        const newExpiresAt = new Date(Date.now() + hours * 3600_000).toISOString();

        const { error: boostUpdateErr } = await supabase
          .from("post_boosts")
          .update({
            status: "active",
            expires_at: newExpiresAt,
            payment_ref: payfastPaymentId ?? paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", boostId);
        if (boostUpdateErr) console.error("Failed to activate boost:", boostUpdateErr);
      } else if (status === "failed" || status === "cancelled") {
        const { error: boostFailErr } = await supabase
          .from("post_boosts")
          .update({
            status: "failed",
            payment_ref: payfastPaymentId ?? paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", boostId)
          .eq("status", "pending");
        if (boostFailErr) console.error("Failed to mark boost failed:", boostFailErr);
      }

      // Boosts don't create unlocks, subscriptions, or creator payouts
      await markEvent({ processed: true });
      return new Response("OK", { status: 200 });
    }

    // If payment is complete, unlock content / credit wallet
    if (status === "completed") {
      // Get the payment to find the user
      const { data: payment } = await supabase
        .from("payments")
        .select("user_id, amount")
        .eq("id", paymentId)
        .single();

      if (payment?.user_id) {
        // Wallet deposit (RED BUSKET top-up)
        if (paymentType === "wallet_deposit") {
          const { data: wallet } = await supabase
            .from("wallets")
            .select("id")
            .eq("user_id", payment.user_id)
            .maybeSingle();
          let walletId = wallet?.id;
          if (!walletId) {
            const { data: created } = await supabase
              .from("wallets")
              .insert({ user_id: payment.user_id })
              .select("id")
              .single();
            walletId = created?.id;
          }
          if (walletId) {
            await supabase.from("wallet_transactions").insert({
              wallet_id: walletId,
              user_id: payment.user_id,
              amount: Number(payment.amount),
              type: "deposit",
              status: "completed",
              reference: payfastPaymentId,
              description: "RED BUSKET deposit via PayFast",
            });
          }
        } else if (contentId) {
          // Create content unlock (existing behavior)
          await supabase
            .from("content_unlocks")
            .upsert({
              user_id: payment.user_id,
              content_id: contentId,
              payment_id: paymentId,
              unlock_type: paymentType === "subscription" ? "subscription" : "purchase",
            }, {
              onConflict: "user_id,content_id",
            });

          // If subscription, create/update subscription record
          if (paymentType === "subscription" && creatorId) {
            await supabase
              .from("subscriptions")
              .upsert({
                subscriber_id: payment.user_id,
                creator_id: creatorId,
                status: "active",
                payfast_token: token,
                amount: parseFloat(itnData.amount_gross || "29.99"),
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "subscriber_id,creator_id",
              });
          }

          // Credit creator (net of 10% platform commission) for content sales / subscriptions
          if (creatorId && creatorId !== payment.user_id) {
            const COMMISSION_RATE = 0.10;
            const gross = Number(payment.amount);
            const commission = Math.round(gross * COMMISSION_RATE * 100) / 100;
            const net = Math.round((gross - commission) * 100) / 100;

            const { data: cWallet } = await supabase
              .from("wallets")
              .select("id")
              .eq("user_id", creatorId)
              .maybeSingle();
            let creatorWalletId = cWallet?.id;
            if (!creatorWalletId) {
              const { data: created } = await supabase
                .from("wallets")
                .insert({ user_id: creatorId })
                .select("id")
                .single();
              creatorWalletId = created?.id;
            }
            if (creatorWalletId) {
              await supabase.from("wallet_transactions").insert({
                wallet_id: creatorWalletId,
                user_id: creatorId,
                amount: net,
                type: "payout",
                status: "completed",
                reference: payfastPaymentId,
                description: paymentType === "subscription"
                  ? "Subscription earnings (net of 10% platform fee)"
                  : "Content sale (net of 10% platform fee)",
              });
              await supabase.from("platform_revenue").insert({
                source_user_id: payment.user_id,
                creator_id: creatorId,
                source_type: paymentType === "subscription" ? "subscription" : "content_unlock",
                gross_amount: gross,
                commission_amount: commission,
                commission_rate: COMMISSION_RATE,
                reference: payfastPaymentId,
                description: "PayFast creator earnings commission",
              });
            }
          }
        }
      }
    }

    // PayFast expects a 200 OK response
    await markEvent({ processed: true });
    return new Response("OK", { status: 200 });
  } catch (error: unknown) {
    console.error("PayFast ITN error:", error);
    return new Response("Error processing ITN", { status: 500 });
  }
});
