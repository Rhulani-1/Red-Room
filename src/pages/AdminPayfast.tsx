import { useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Loader2, RefreshCw, X } from "lucide-react";

type Event = {
  id: string;
  m_payment_id: string | null;
  payfast_payment_id: string | null;
  payment_status: string | null;
  content_id: string | null;
  amount_gross: number | null;
  signature_ok: boolean;
  ip_ok: boolean;
  server_ok: boolean;
  processed: boolean;
  error_message: string | null;
  source_ip: string | null;
  created_at: string;
};

type StuckPayment = {
  id: string;
  user_id: string | null;
  amount: number;
  status: string;
  payment_type: string;
  content_id: string;
  payfast_payment_id: string | null;
  created_at: string;
};

type StuckBoost = {
  id: string;
  user_id: string;
  post_id: string;
  tier: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_ref: string | null;
  created_at: string;
};

const statusBadge = (s: string | null) => {
  if (!s) return <Badge variant="outline">—</Badge>;
  const v: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    completed: "default", active: "default", paid: "default",
    pending: "secondary",
    failed: "destructive", cancelled: "destructive",
    COMPLETE: "default", FAILED: "destructive", CANCELLED: "destructive",
  };
  return <Badge variant={v[s] ?? "outline"}>{s}</Badge>;
};

const Tick = ({ ok }: { ok: boolean }) =>
  ok
    ? <Check className="h-4 w-4 text-emerald-500" />
    : <X className="h-4 w-4 text-destructive" />;

export default function AdminPayfast() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [payments, setPayments] = useState<StuckPayment[]>([]);
  const [boosts, setBoosts] = useState<StuckBoost[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("admin-payfast-dashboard");
      if (response.error) {
        if (response.error.status === 403) {
          setIsAdmin(false);
          return;
        }
        throw new Error(response.error.message ?? "Unable to load admin PayFast data");
      }

      const payload = response.data as {
        events: Event[];
        payments: StuckPayment[];
        boosts: StuckBoost[];
      };

      setEvents(payload.events ?? []);
      setPayments(payload.payments ?? []);
      setBoosts(payload.boosts ?? []);
      setIsAdmin(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to load admin PayFast data");
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const callResolve = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("payfast-admin-resolve", { body });
    if (error) throw new Error(error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data;
  };

  const verifyPayment = async (paymentId: string) => {
    setBusyId(paymentId);
    try {
      const data = await callResolve({ action: "verify", paymentId });
      setVerifyResult(data);
    } catch (e) {
      toast({ title: "Verify failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const markPayment = async (id: string, status: "completed" | "failed" | "cancelled") => {
    setBusyId(id);
    try {
      await callResolve({ action: "mark_payment", paymentId: id, status });
      toast({ title: `Payment marked ${status}` });
      await refresh();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const markBoost = async (id: string, status: "active" | "failed") => {
    setBusyId(id);
    try {
      await callResolve({ action: "mark_boost", boostId: id, status });
      toast({ title: `Boost marked ${status}` });
      await refresh();
    } catch (e) {
      toast({ title: "Update failed", description: (e as Error).message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  if (authLoading || isAdmin === null) {
    return (
      <>
        <div className="space-y-3 p-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>
      </>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (error) {
    return (
      <>
        <div className="p-6">
          <h1 className="text-xl font-bold">Admin dashboard error</h1>
          <p className="text-sm text-destructive mt-2">{error}</p>
        </div>
      </>
    );
  }
  if (!isAdmin) {
    return (
      <>
        <div className="p-6">
          <h1 className="text-xl font-bold">Not authorized</h1>
          <p className="text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6 p-4 pb-24">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PayFast Webhooks</h1>
            <p className="text-sm text-muted-foreground">Recent ITN events and stuck payments / boosts.</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stuck pending payments (&gt; 30 min)
          </h2>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>pf_payment_id</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{formatDistanceToNow(new Date(p.created_at))} ago</TableCell>
                      <TableCell><Badge variant="outline">{p.payment_type}</Badge></TableCell>
                      <TableCell>R{Number(p.amount).toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.payfast_payment_id ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" disabled={busyId === p.id}
                            onClick={() => verifyPayment(p.id)}>
                            {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
                          </Button>
                          <Button size="sm" variant="default" disabled={busyId === p.id}
                            onClick={() => markPayment(p.id, "completed")}>Mark paid</Button>
                          <Button size="sm" variant="destructive" disabled={busyId === p.id}
                            onClick={() => markPayment(p.id, "failed")}>Mark failed</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Stuck pending boosts (&gt; 30 min)
          </h2>
          {boosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Post</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boosts.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-xs">{formatDistanceToNow(new Date(b.created_at))} ago</TableCell>
                      <TableCell>{b.tier}</TableCell>
                      <TableCell>R{Number(b.amount).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{b.payment_method}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{b.post_id.slice(0, 10)}…</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="default" disabled={busyId === b.id}
                            onClick={() => markBoost(b.id, "active")}>Activate</Button>
                          <Button size="sm" variant="destructive" disabled={busyId === b.id}
                            onClick={() => markBoost(b.id, "failed")}>Mark failed</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent webhook events
          </h2>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Sig</TableHead>
                    <TableHead className="text-center">IP</TableHead>
                    <TableHead className="text-center">Srv</TableHead>
                    <TableHead className="text-center">Done</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>m_payment_id</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(e.created_at))} ago
                      </TableCell>
                      <TableCell>{statusBadge(e.payment_status)}</TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Tick ok={e.signature_ok} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Tick ok={e.ip_ok} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Tick ok={e.server_ok} /></div></TableCell>
                      <TableCell className="text-center"><div className="flex justify-center"><Tick ok={e.processed} /></div></TableCell>
                      <TableCell>{e.amount_gross != null ? `R${Number(e.amount_gross).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{e.m_payment_id?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] xl:max-w-[480px] truncate" title={e.error_message ?? ""}>
                        {e.error_message ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!verifyResult} onOpenChange={(o) => !o && setVerifyResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>PayFast verification</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(verifyResult, null, 2)}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
