import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { format, startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Row = {
  id: string;
  creator_id: string;
  source_type: string;
  gross_amount: number;
  commission_amount: number;
  created_at: string;
};

type Profile = { user_id: string; display_name: string | null; username: string | null };

const fmt = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(n);

export default function AdminRevenue() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadAdminRevenue = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await supabase.functions.invoke("admin-revenue", {
          body: { date },
        });

        if (response.error) {
          if (response.error.status === 403) {
            setIsAdmin(false);
            return;
          }
          throw new Error(response.error.message ?? "Unable to load revenue data");
        }

        const data = response.data as { rows: Row[]; profiles: Profile[] };
        setRows(data.rows ?? []);
        setProfiles(
          Object.fromEntries((data.profiles ?? []).map((profile) => [profile.user_id, profile])),
        );
        setIsAdmin(true);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Unable to load revenue data");
        }
      } finally {
        setLoading(false);
      }
    };

    loadAdminRevenue();
  }, [user, date]);

  const totals = useMemo(() => {
    let gross = 0, commission = 0;
    rows.forEach((r) => {
      gross += Number(r.gross_amount);
      commission += Number(r.commission_amount);
    });
    return { gross, commission, count: rows.length };
  }, [rows]);

  const byCreator = useMemo(() => {
    const m = new Map<string, { gross: number; commission: number; count: number }>();
    rows.forEach((r) => {
      const cur = m.get(r.creator_id) ?? { gross: 0, commission: 0, count: 0 };
      cur.gross += Number(r.gross_amount);
      cur.commission += Number(r.commission_amount);
      cur.count += 1;
      m.set(r.creator_id, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].commission - a[1].commission);
  }, [rows]);

  const bySource = useMemo(() => {
    const m = new Map<string, { gross: number; commission: number; count: number }>();
    rows.forEach((r) => {
      const cur = m.get(r.source_type) ?? { gross: 0, commission: 0, count: 0 };
      cur.gross += Number(r.gross_amount);
      cur.commission += Number(r.commission_amount);
      cur.count += 1;
      m.set(r.source_type, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].commission - a[1].commission);
  }, [rows]);

  if (authLoading || isAdmin === null) {
    return (
      <>
        <div className="space-y-3 p-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
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

  const nameOf = (id: string) => {
    const p = profiles[id];
    return p?.display_name || p?.username || id.slice(0, 8);
  };

  return (
    <>
      <div className="space-y-6 p-4 pb-20">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Daily Revenue Report</h1>
            <p className="text-sm text-muted-foreground">
              Platform commission summary by creator and source.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="date" className="text-xs">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Transactions</div>
            <div className="text-2xl font-bold">{totals.count}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Gross</div>
            <div className="text-2xl font-bold">{fmt(totals.gross)}</div>
          </Card>
          <Card className="p-4 border-primary/40">
            <div className="text-xs text-muted-foreground">Platform commission</div>
            <div className="text-2xl font-bold text-primary">{fmt(totals.commission)}</div>
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By source type
          </h2>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : bySource.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue for this date.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySource.map(([src, v]) => (
                  <TableRow key={src}>
                    <TableCell className="font-medium">{src}</TableCell>
                    <TableCell className="text-right">{v.count}</TableCell>
                    <TableCell className="text-right">{fmt(v.gross)}</TableCell>
                    <TableCell className="text-right text-primary">{fmt(v.commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            By creator
          </h2>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : byCreator.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revenue for this date.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCreator.map(([id, v]) => (
                  <TableRow key={id}>
                    <TableCell className="font-medium">{nameOf(id)}</TableCell>
                    <TableCell className="text-right">{v.count}</TableCell>
                    <TableCell className="text-right">{fmt(v.gross)}</TableCell>
                    <TableCell className="text-right text-primary">{fmt(v.commission)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
