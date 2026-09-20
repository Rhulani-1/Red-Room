import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Users, Crown, Loader2 } from "lucide-react";
import CreateGroupDialog from "@/components/groups/CreateGroupDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  pass_price: number;
  subscribers_free: boolean;
  creator_id: string;
}

const Groups = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"my" | "discover">("my");
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: members }, { data: all }] = await Promise.all([
      user
        ? supabase
            .from("group_members")
            .select("group_id, groups(*)")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] as Array<{ group_id: string; groups: Group }> }),
      supabase.from("groups").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const mine = (members ?? [])
      .map((m: { groups: Group | null }) => m.groups)
      .filter((g): g is Group => Boolean(g));
    setMyGroups(mine);
    setAllGroups((all ?? []) as Group[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const handleJoin = async (g: Group) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setJoining(g.id);
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: g.id, user_id: user.id, role: "member" });
    setJoining(null);

    if (error) {
      toast.error(
        g.pass_price > 0
          ? `Access requires R${g.pass_price.toFixed(2)} pass or active subscription`
          : "You need an active subscription to join"
      );
      return;
    }
    toast.success(`Joined ${g.name}`);
    navigate(`/groups/${g.id}`);
  };

  const myIds = new Set(myGroups.map((g) => g.id));
  const visible = tab === "my" ? myGroups : allGroups;

  return (
    <>
      <div className="py-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Groups
          </h2>
          <CreateGroupDialog />
        </div>

        <div className="mb-4 inline-flex rounded-xl border border-border bg-card p-1">
          {(["my", "discover"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all ${
                tab === t ? "bg-gradient-ember text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "my" ? "My Groups" : "Discover"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === "my" ? "You haven't joined any groups yet." : "No groups yet — be the first."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((g, i) => {
              const isMember = myIds.has(g.id);
              const isOwner = g.creator_id === user?.id;
              return (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-ember">
                      {isOwner ? <Crown className="h-5 w-5 text-primary-foreground" /> : <Users className="h-5 w-5 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-bold">{g.name}</p>
                        {!isMember && <Lock className="h-3 w-3 text-primary" />}
                      </div>
                      {g.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{g.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {g.subscribers_free && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Subscribers free</span>}
                        {g.pass_price > 0 && <span className="rounded-full bg-secondary px-2 py-0.5">Pass R{g.pass_price.toFixed(2)}</span>}
                      </div>
                    </div>
                    <div>
                      {isMember ? (
                        <Button size="sm" variant="secondary" asChild>
                          <Link to={`/groups/${g.id}`}>Open</Link>
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => handleJoin(g)} disabled={joining === g.id} className="bg-gradient-ember glow">
                          {joining === g.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Join"}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Groups;
