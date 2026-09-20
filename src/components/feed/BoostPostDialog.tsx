import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Wallet as WalletIcon, CreditCard, Loader2, Check, Zap, Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { payWithWallet, createPayFastPayment } from "@/lib/payfast";
import { toast } from "sonner";

interface BoostPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

type TierKey = "basic" | "pro" | "premium";
type Tier = {
  key: TierKey;
  label: string;
  price: number;
  hours: number;
  durationLabel: string;
  reach: string;
  icon: typeof Zap;
};

const TIERS: Tier[] = [
  { key: "basic",   label: "Basic",   price: 20,  hours: 24,  durationLabel: "24 hours", reach: "~3× normal reach",  icon: Zap },
  { key: "pro",     label: "Pro",     price: 50,  hours: 72,  durationLabel: "3 days",   reach: "~6× normal reach",  icon: Flame },
  { key: "premium", label: "Premium", price: 150, hours: 168, durationLabel: "7 days",   reach: "~12× normal reach", icon: Crown },
];

type Method = "wallet" | "payfast";

const BoostPostDialog = ({ open, onOpenChange, postId }: BoostPostDialogProps) => {
  const { user } = useAuth();
  const [tierKey, setTierKey] = useState<TierKey>("pro");
  const [method, setMethod] = useState<Method>("wallet");
  const [submitting, setSubmitting] = useState(false);

  const tier = TIERS.find((t) => t.key === tierKey)!;

  const handleBoost = async () => {
    if (!user) {
      toast.error("Sign in to boost a post");
      return;
    }
    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + tier.hours * 3600_000).toISOString();

      if (method === "wallet") {
        // Pay from RED BUSKET wallet (debit only — no creator credit, platform retains)
        await payWithWallet({
          amount: tier.price,
          description: `Boost post (${tier.label} · ${tier.durationLabel})`,
          action: "pay",
        });

        const { error: insertErr } = await supabase.from("post_boosts").insert({
          user_id: user.id,
          post_id: postId,
          tier: tier.key,
          amount: tier.price,
          duration_hours: tier.hours,
          expires_at: expiresAt,
          status: "active",
          payment_method: "wallet",
        });
        if (insertErr) throw insertErr;

        toast.success(`Boost activated — ${tier.durationLabel}`, {
          description: tier.reach,
        });
        onOpenChange(false);
        return;
      }

      // PayFast flow: create pending boost row, then redirect
      const { data: boost, error: boostErr } = await supabase
        .from("post_boosts")
        .insert({
          user_id: user.id,
          post_id: postId,
          tier: tier.key,
          amount: tier.price,
          duration_hours: tier.hours,
          expires_at: expiresAt,
          status: "pending",
          payment_method: "payfast",
        })
        .select("id")
        .single();
      if (boostErr || !boost) throw boostErr ?? new Error("Could not create boost");

      const { redirectUrl } = await createPayFastPayment({
        contentId: `boost:${boost.id}`,
        amount: tier.price,
        itemName: `Boost post — ${tier.label} (${tier.durationLabel})`,
        paymentType: "once_off",
      });
      window.location.href = redirectUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not boost post";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gradient text-xl font-extrabold">
            <Rocket className="h-5 w-5 text-primary" /> Boost Post
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pay to push this post in front of more people. Boosted posts surface higher in the feed and Discover.
          </DialogDescription>
        </DialogHeader>

        {/* Tier selector */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Choose package</p>
          <div className="space-y-2">
            {TIERS.map((t) => {
              const active = t.key === tierKey;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTierKey(t.key)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10 glow"
                      : "border-border bg-card/50 hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center",
                      active ? "bg-gradient-red" : "bg-secondary"
                    )}>
                      <Icon className={cn("h-4 w-4", active ? "text-primary-foreground" : "text-foreground")} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{t.label} · {t.durationLabel}</p>
                      <p className="text-[11px] text-muted-foreground">{t.reach}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-extrabold">R{t.price}</p>
                    {active && <Check className="h-3.5 w-3.5 text-primary inline-block" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment method */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Pay with</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMethod("wallet")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 transition-colors",
                method === "wallet" ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:bg-secondary"
              )}
            >
              <WalletIcon className="h-4 w-4" />
              <span className="text-xs font-bold">RED BUSKET</span>
            </button>
            <button
              onClick={() => setMethod("payfast")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border p-3 transition-colors",
                method === "payfast" ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:bg-secondary"
              )}
            >
              <CreditCard className="h-4 w-4" />
              <span className="text-xs font-bold">PayFast</span>
            </button>
          </div>
        </div>

        <Button
          onClick={handleBoost}
          disabled={submitting}
          className="w-full bg-gradient-red glow h-11 text-sm font-bold mt-2"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Rocket className="h-4 w-4 mr-2" />
          )}
          Boost for R{tier.price}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default BoostPostDialog;
