import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  Loader2,
  Lock,
  CalendarIcon,
} from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createPayFastPayment } from "@/lib/payfast";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WalletRow {
  id: string;
  balance: number;
  currency: string;
}

interface WalletTx {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  created_at: string;
}

interface ContentUnlock {
  id: string;
  content_id: string;
  unlock_type: string;
  created_at: string;
  payment_id: string | null;
  amount: number | null;
}

const RedBusket = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [unlocks, setUnlocks] = useState<ContentUnlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "deposit" | "payment" | "transfer">("all");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "week" | "custom">("all");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const getDateRange = useCallback((): { from: Date; to: Date } | null => {
    const now = new Date();
    if (datePreset === "today") return { from: startOfDay(now), to: endOfDay(now) };
    if (datePreset === "week")
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    if (datePreset === "custom" && customRange?.from)
      return { from: startOfDay(customRange.from), to: endOfDay(customRange.to ?? customRange.from) };
    return null;
  }, [datePreset, customRange]);


  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: w }, { data: t }, { data: u }] = await Promise.all([
      supabase.from("wallets").select("id, balance, currency").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("id, amount, type, status, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("content_unlocks")
        .select("id, content_id, unlock_type, created_at, payment_id, payments(amount)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (w) setWallet({ id: w.id, balance: Number(w.balance), currency: w.currency });
    setTxs((t ?? []) as WalletTx[]);
    setUnlocks(
      ((u ?? []) as Array<ContentUnlock & { payments?: { amount: number } | null }>).map((row) => ({
        id: row.id,
        content_id: row.content_id,
        unlock_type: row.unlock_type,
        created_at: row.created_at,
        payment_id: row.payment_id,
        amount: row.payments?.amount ? Number(row.payments.amount) : null,
      }))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime updates on wallet balance + transactions
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setDepositLoading(true);
    try {
      const { redirectUrl } = await createPayFastPayment({
        amount: amt,
        itemName: "RED BUSKET deposit",
        paymentType: "wallet_deposit",
      });
      window.location.href = redirectUrl;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Deposit failed";
      toast.error(msg);
    } finally {
      setDepositLoading(false);
    }
  };

  if (!user) {
    return (
      <>
        <div className="py-10 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Sign in to access your RED BUSKET</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="py-3 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-gradient">RED</span> BUSKET
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Balance Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-ember p-5 glow">
          <div className="absolute inset-0 noise opacity-20" />
          <div className="relative space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/70">
              Available Balance
            </p>
            <p className="text-3xl font-extrabold text-primary-foreground">
              {wallet ? `${wallet.currency} ${wallet.balance.toFixed(2)}` : "—"}
            </p>
            <p className="text-[10px] text-primary-foreground/70">
              Use it to pay creators, unlock posts, or send to friends.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setDepositOpen(true)}
            className="bg-gradient-red glow text-xs h-11"
          >
            <ArrowDownToLine className="h-4 w-4 mr-1.5" />
            Deposit
          </Button>
          <Button
            variant="outline"
            disabled
            className="text-xs h-11 border-border"
          >
            <ArrowUpFromLine className="h-4 w-4 mr-1.5" />
            Withdraw
          </Button>
        </div>

        {/* Activity Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary">
            <TabsTrigger value="transactions" className="text-xs">Transactions</TabsTrigger>
            <TabsTrigger value="unlocks" className="text-xs">Unlocks</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-3 space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {([
                { v: "all", label: "All" },
                { v: "deposit", label: "Deposits" },
                { v: "payment", label: "Payments" },
                { v: "transfer", label: "Transfers" },
              ] as const).map((f) => (
                <button
                  key={f.v}
                  onClick={() => setTxFilter(f.v)}
                  className={cn(
                    "rounded-full px-3 py-2 min-h-[40px] text-[11px] font-semibold transition-colors",
                    txFilter === f.v
                      ? "bg-gradient-red text-primary-foreground glow"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 flex-wrap items-center">
              {([
                { v: "all", label: "All time" },
                { v: "today", label: "Today" },
                { v: "week", label: "This week" },
              ] as const).map((p) => (
                <button
                  key={p.v}
                  onClick={() => {
                    setDatePreset(p.v);
                    setCustomRange(undefined);
                  }}
                  className={cn(
                    "rounded-full px-3 py-2 min-h-[40px] text-[11px] font-semibold transition-colors",
                    datePreset === p.v
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "rounded-full px-3 py-2 min-h-[40px] text-[11px] font-semibold transition-colors flex items-center gap-1",
                      datePreset === "custom"
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <CalendarIcon className="h-3 w-3" />
                    {datePreset === "custom" && customRange?.from
                      ? `${format(customRange.from, "d MMM")}${
                          customRange.to ? ` – ${format(customRange.to, "d MMM")}` : ""
                        }`
                      : "Custom"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={(r) => {
                      setCustomRange(r);
                      if (r?.from) setDatePreset("custom");
                      if (r?.from && r?.to) setDatePopoverOpen(false);
                    }}
                    numberOfMonths={1}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </span>
            </div>

            {(() => {
              const range = getDateRange();
              return range ? (
                <div className="rounded-lg bg-secondary/50 px-3 py-2 text-[10px] text-muted-foreground space-y-1">
                  <div>
                    <span className="font-semibold text-foreground">From</span>{" "}
                    {format(range.from, "d MMM yyyy, HH:mm:ss")}
                    {" → "}
                    <span className="font-semibold text-foreground">To</span>{" "}
                    {format(range.to, "d MMM yyyy, HH:mm:ss")}{" "}
                    <span className="opacity-70">({Intl.DateTimeFormat().resolvedOptions().timeZone})</span>
                  </div>
                  <div className="opacity-70">
                    <span className="font-semibold">UTC:</span>{" "}
                    {range.from.toISOString().replace("T", " ").slice(0, 19)}
                    {" → "}
                    {range.to.toISOString().replace("T", " ").slice(0, 19)}
                  </div>
                </div>
              ) : null;
            })()}

            {(() => {
              const range = getDateRange();
              const filtered = txs.filter((tx) => {
                if (txFilter !== "all") {
                  if (txFilter === "deposit" && tx.type !== "deposit") return false;
                  if (txFilter === "transfer" && tx.type !== "transfer") return false;
                  if (txFilter === "payment" && tx.type !== "payment" && tx.type !== "payout") return false;
                }
                if (range) {
                  const d = new Date(tx.created_at).getTime();
                  if (d < range.from.getTime() || d > range.to.getTime()) return false;
                }
                return true;
              });
              return loading && filtered.length === 0 ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center rounded-xl border border-border bg-card">
                  <p className="text-sm text-muted-foreground">
                    {txFilter === "all" ? "No transactions yet" : `No ${txFilter}s yet`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Deposit funds to start using your RED BUSKET
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card divide-y divide-border">
                  {filtered.map((tx) => {
                  const credit = Number(tx.amount) > 0;
                  const date = new Date(tx.created_at);
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0",
                          credit ? "bg-green-500/15 text-green-400" : "bg-primary/15 text-primary"
                        )}
                      >
                        {credit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold capitalize truncate">
                          {tx.description || tx.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(date, { addSuffix: true })} ·{" "}
                          {format(date, "d MMM, HH:mm")} ·{" "}
                          <span className="capitalize">{tx.status}</span>
                        </p>
                      </div>
                      <p
                        className={cn(
                          "text-sm font-bold",
                          credit ? "text-green-400" : "text-foreground"
                        )}
                      >
                        {credit ? (
                          <Plus className="inline h-3 w-3 -mt-0.5" />
                        ) : (
                          <Minus className="inline h-3 w-3 -mt-0.5" />
                        )}
                        R{Math.abs(Number(tx.amount)).toFixed(2)}
                      </p>
                    </div>
                  );
                  })}
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="unlocks" className="mt-3">
            {loading && unlocks.length === 0 ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : unlocks.length === 0 ? (
              <div className="py-10 text-center rounded-xl border border-border bg-card">
                <p className="text-sm text-muted-foreground">No content unlocks yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Unlocked posts and passes will appear here
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {unlocks.map((ul) => {
                  const date = new Date(ul.created_at);
                  return (
                    <div key={ul.id} className="flex items-center gap-3 p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 bg-primary/15 text-primary">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold capitalize truncate">
                          {ul.unlock_type.replace(/_/g, " ")}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {formatDistanceToNow(date, { addSuffix: true })} ·{" "}
                          {format(date, "d MMM, HH:mm")}
                        </p>
                      </div>
                      {ul.amount != null && (
                        <p className="text-sm font-bold text-foreground">
                          R{ul.amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-primary" />
              Deposit to RED BUSKET
            </DialogTitle>
            <DialogDescription className="text-xs">
              Top up your wallet via PayFast. Funds appear once payment is confirmed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary">
                R
              </span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="pl-8 bg-secondary border-none h-11 rounded-lg"
                autoFocus
              />
            </div>
            <div className="flex gap-1.5">
              {[50, 100, 250, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setDepositAmount(String(v))}
                  className="flex-1 rounded-full bg-secondary text-xs font-semibold py-1.5 hover:bg-primary/10"
                >
                  R{v}
                </button>
              ))}
            </div>
            <Button
              onClick={handleDeposit}
              disabled={depositLoading || !depositAmount}
              className="w-full bg-gradient-red glow"
            >
              {depositLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Continue to PayFast"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RedBusket;
