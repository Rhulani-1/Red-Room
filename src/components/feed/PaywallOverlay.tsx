import { Lock, Eye, Clock, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { createPayFastPayment, payWithWallet } from "@/lib/payfast";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface PaywallOverlayProps {
  type: "image" | "video" | "text";
  price?: number;
  username: string;
  contentId?: string;
  creatorId?: string;
  hasSnippet?: boolean;
  snippetSeconds?: number;
  onUnlock?: () => void;
  className?: string;
}

const PaywallOverlay = ({
  type,
  price = 4.99,
  username,
  contentId,
  creatorId,
  hasSnippet,
  snippetSeconds = 5,
  onUnlock,
  className,
}: PaywallOverlayProps) => {
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    if (!user) {
      setBalance(null);
      return;
    }
    supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setBalance(Number(data.balance));
      });
    return () => {
      active = false;
    };
  }, [user]);

  const hasEnough = balance !== null && balance >= price;

  const handleWalletUnlock = async () => {
    if (!contentId) return;
    setWalletLoading(true);
    try {
      await payWithWallet({
        contentId,
        creatorId,
        amount: price,
        description: `Unlock content from @${username}`,
      });
      toast.success("Unlocked with RED BUSKET");
      onUnlock?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Wallet payment failed";
      toast.error(msg);
    } finally {
      setWalletLoading(false);
    }
  };


  const handleUnlock = async () => {
    if (!contentId) {
      // Fail closed. Granting access when there is nothing to charge against was a
      // free-unlock path for any caller that omitted contentId.
      toast.error("This content can't be unlocked right now.");
      return;
    }

    setLoading(true);
    try {
      const { redirectUrl } = await createPayFastPayment({
        contentId,
        amount: price,
        itemName: `Unlock content from @${username}`,
        paymentType: "once_off",
        creatorId,
      });
      window.location.href = redirectUrl;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Payment failed";
      toast.error(msg);
      // Deliberately NO onUnlock() here. This used to grant access on any failure
      // ("fallback to mock unlock for demo"), which turned every network blip or edge
      // function error into a free unlock.
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!contentId || !creatorId) {
      toast.error("This creator isn't accepting subscriptions right now.");
      return;
    }

    setLoading(true);
    try {
      const { redirectUrl } = await createPayFastPayment({
        contentId,
        amount: 29.99,
        itemName: `Monthly subscription to @${username}`,
        paymentType: "subscription",
        creatorId,
      });
      window.location.href = redirectUrl;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Subscription failed";
      toast.error(msg);
      // Same as above: a failed subscription must not grant access.
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 border border-primary/30">
          <Lock className="h-6 w-6 text-primary" />
        </div>

        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">Premium Content</p>
          <p className="text-xs text-muted-foreground">
            Subscribe to <span className="text-primary font-semibold">@{username}</span> or pay to unlock
          </p>
        </div>

        {hasSnippet && (
          <div className="flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1">
            <Clock className="h-3 w-3 text-primary" />
            <span className="text-[11px] text-muted-foreground">
              {type === "video" ? `${snippetSeconds}s preview available` : "Blurred preview"}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2 w-full max-w-[220px] mt-1">
          {user && (
            hasEnough ? (
              <button
                onClick={handleWalletUnlock}
                disabled={walletLoading || loading}
                className="w-full rounded-lg bg-gradient-ember px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform active:scale-95 glow disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Wallet className="h-4 w-4" />
                {walletLoading
                  ? "Processing..."
                  : `Pay with RED BUSKET · R${price.toFixed(2)}`}
              </button>
            ) : balance !== null ? (
              <Link
                to="/wallet"
                className="w-full rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-[11px] font-semibold text-primary text-center hover:bg-primary/10 flex items-center justify-center gap-1.5"
              >
                <Wallet className="h-3.5 w-3.5" />
                RED BUSKET: R{balance.toFixed(2)} · Top up
              </Link>
            ) : null
          )}
          <button
            onClick={handleUnlock}
            disabled={loading || walletLoading}
            className="w-full rounded-lg bg-gradient-red px-4 py-2.5 text-sm font-bold text-primary-foreground transition-transform active:scale-95 glow disabled:opacity-50"
          >
            {loading ? "Processing..." : `Pay with PayFast · R${price.toFixed(2)}`}
          </button>
          <button
            onClick={handleSubscribe}
            disabled={loading || walletLoading}
            className="w-full rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-transform active:scale-95 disabled:opacity-50"
          >
            Subscribe · R29.99/mo
          </button>
        </div>

        {hasSnippet && type === "video" && (
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
            <Eye className="h-3.5 w-3.5" />
            Watch {snippetSeconds}s preview
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default PaywallOverlay;
