import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Conversation = {
  id: string;
  name: string;
  coverUrl: string | null;
  lastMessage: string;
  updatedAt: string;
  unread: boolean;
};

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const Messages = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Conversation[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user) {
        if (active) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      const groupIds = (memberships ?? []).map((m) => m.group_id);
      if (groupIds.length === 0) {
        if (active) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      const [{ data: groups }, { data: messages }] = await Promise.all([
        supabase.from("groups").select("id, name, cover_url").in("id", groupIds),
        supabase
          .from("group_messages")
          .select("group_id, body, created_at")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false }),
      ]);

      const latestByGroup = new Map<string, { body: string; created_at: string }>();
      (messages ?? []).forEach((m) => {
        if (!latestByGroup.has(m.group_id)) {
          latestByGroup.set(m.group_id, {
            body: m.body ?? "Shared media",
            created_at: m.created_at,
          });
        }
      });

      const next: Conversation[] = (groups ?? []).map((g) => {
        const latest = latestByGroup.get(g.id);
        return {
          id: g.id,
          name: g.name,
          coverUrl: g.cover_url,
          lastMessage: latest?.body ?? "No messages yet",
          updatedAt: latest?.created_at ?? new Date().toISOString(),
          unread: false,
        };
      });

      next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      if (active) {
        setItems(next);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const emptyText = useMemo(() => {
    if (!user) return "Sign in to view your conversations.";
    if (loading) return "Loading conversations...";
    return "No group conversations yet. Join or create a group to start chatting.";
  }, [loading, user]);

  return (
    <>
      <div className="py-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Messages
          </h2>
          <Link to="/groups" className="flex items-center gap-1.5 rounded-full bg-gradient-ember px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground glow">
            <Crown className="h-3 w-3" /> Groups
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl bg-card p-4 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-1">
            {items.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={`/groups/${msg.id}`}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-card"
                >
                  <div className="relative">
                    <img
                      src={msg.coverUrl ?? "https://i.pravatar.cc/100"}
                      alt={msg.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    {msg.unread && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={cn("text-sm", msg.unread ? "font-bold" : "font-medium")}>{msg.name}</p>
                      <span className={cn("text-[11px]", msg.unread ? "text-primary" : "text-muted-foreground")}>
                        {timeAgo(msg.updatedAt)}
                      </span>
                    </div>
                    <p className={cn("truncate text-xs", msg.unread ? "text-foreground" : "text-muted-foreground")}>
                      {msg.lastMessage}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Messages;
