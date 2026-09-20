import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authentication");

    const body = await req.json();
    const action = body.action as "pay" | "transfer";
    const amount = parseFloat(body.amount);
    const description = (body.description as string | undefined) || null;
    const reference = (body.reference as string | undefined) || null;
    const recipientUserId = body.recipientUserId as string | undefined;
    const contentId = body.contentId as string | undefined;
    const creatorId = body.creatorId as string | undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid amount");
    }
    if (!action || !["pay", "transfer"].includes(action)) {
      throw new Error("Invalid action");
    }

    // Load payer wallet
    const { data: wallet, error: wErr } = await supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", user.id)
      .single();
    if (wErr || !wallet) throw new Error("Wallet not found");
    if (Number(wallet.balance) < amount) {
      return new Response(
        JSON.stringify({ error: "Insufficient RED BUSKET balance" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If unlocking content, ensure not already unlocked
    if (action === "pay" && contentId) {
      const { data: existing } = await supabase
        .from("content_unlocks")
        .select("id")
        .eq("user_id", user.id)
        .eq("content_id", contentId)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({ error: "Content already unlocked", alreadyUnlocked: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Optional: create a payment row for content purchases (audit trail)
    let paymentId: string | null = null;
    if (action === "pay" && contentId) {
      const { data: pay, error: payErr } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          content_id: contentId,
          amount,
          payment_type: "wallet",
          status: "paid",
        })
        .select("id")
        .single();
      if (payErr) throw payErr;
      paymentId = pay.id;
    }

    // Debit payer
    const { error: debitErr } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        amount: -amount,
        type: action === "transfer" ? "transfer" : "payment",
        status: "completed",
        description,
        reference: reference || paymentId,
      });
    if (debitErr) throw debitErr;

    // Credit content creator (or transfer recipient)
    const recipient = action === "transfer" ? recipientUserId : creatorId;
    if (recipient) {
      if (recipient === user.id) {
        // self credit not allowed; skip
      } else {
        const { data: rWallet, error: rErr } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", recipient)
          .maybeSingle();
        if (rErr) throw rErr;
        let rWalletId = rWallet?.id;
        if (!rWalletId) {
          const { data: created, error: cErr } = await supabase
            .from("wallets")
            .insert({ user_id: recipient })
            .select("id")
            .single();
          if (cErr) throw cErr;
          rWalletId = created.id;
        }
        // Apply 10% platform commission only on creator earnings (action === "pay").
        // Pure user-to-user transfers are not commissioned.
        const COMMISSION_RATE = 0.10;
        const isCommissionable = action === "pay";
        const commission = isCommissionable
          ? Math.round(amount * COMMISSION_RATE * 100) / 100
          : 0;
        const netAmount = Math.round((amount - commission) * 100) / 100;

        const { error: creditErr } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id: rWalletId,
            user_id: recipient,
            amount: netAmount,
            type: action === "transfer" ? "transfer" : "payout",
            status: "completed",
            description: description ||
              (action === "pay"
                ? `Content sale via RED BUSKET (net of ${(COMMISSION_RATE * 100).toFixed(0)}% platform fee)`
                : "Transfer received"),
            reference: reference || paymentId,
          });
        if (creditErr) throw creditErr;

        if (isCommissionable && commission > 0) {
          await supabase.from("platform_revenue").insert({
            source_user_id: user.id,
            creator_id: recipient,
            source_type: contentId ? "content_unlock" : "creator_payment",
            gross_amount: amount,
            commission_amount: commission,
            commission_rate: COMMISSION_RATE,
            reference: reference || paymentId,
            description: description || "RED BUSKET creator earnings commission",
          });
        }
      }
    } else if (action === "transfer") {
      throw new Error("recipientUserId required for transfer");
    }

    // Record content unlock
    if (action === "pay" && contentId) {
      await supabase.from("content_unlocks").upsert(
        {
          user_id: user.id,
          content_id: contentId,
          payment_id: paymentId,
          unlock_type: "purchase",
        },
        { onConflict: "user_id,content_id" }
      );
    }

    return new Response(JSON.stringify({ ok: true, paymentId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("wallet-pay error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
