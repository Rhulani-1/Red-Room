import { useEffect, useMemo, useState } from "react";
import { MapPin, Clock3, UserRound, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseMeetupLocation } from "@/lib/geo";

type FeedItem = {
  id: string;
  hostId: string;
  guestId: string;
  status: string;
  createdAt: string;
  notes: string | null;
  location: string | null;
};

type ProfileLite = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

const timeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const parsePurpose = (notes: string | null) => {
  if (!notes) return "Meetup request";

  try {
    const parsed = JSON.parse(notes) as { purpose?: string };
    if (parsed.purpose && parsed.purpose.trim()) return parsed.purpose;
  } catch {
    // Keep backwards compatibility with plain-text notes.
  }

  return notes;
};

const profileName = (p: ProfileLite | undefined) => {
  if (!p) return "Unknown user";
  return p.display_name || p.username || "Unknown user";
};

const statusChip = (status: string) => {
  const clean = status.toLowerCase();
  if (clean === "confirmed") return "bg-green-500/15 text-green-300 border-green-500/30";
  if (clean === "cancelled") return "bg-destructive/15 text-destructive border-destructive/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
};

const ForYouFeed = ({ scope = "all" }: { scope?: "all" | "mine" }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user) {
        if (active) {
          setItems([]);
          setProfiles(new Map());
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      let query = supabase
        .from("meetups")
        .select("id, host_id, guest_id, status, created_at, notes, location")
        .order("created_at", { ascending: false })
        .limit(60);

      if (scope === "mine") {
        query = query.or(`host_id.eq.${user.id},guest_id.eq.${user.id}`);
      }

      const { data: meetups } = await query;
      const records = (meetups ?? []).map((m) => ({
        id: m.id,
        hostId: m.host_id,
        guestId: m.guest_id,
        status: m.status,
        createdAt: m.created_at,
        notes: m.notes,
        location: m.location,
      }));

      const userIds = Array.from(new Set(records.flatMap((m) => [m.hostId, m.guestId])));
      if (userIds.length > 0) {
        const { data: rows } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds);

        const mapped = new Map<string, ProfileLite>();
        (rows ?? []).forEach((row) => mapped.set(row.user_id, row));

        if (active) {
          setProfiles(mapped);
        }
      } else if (active) {
        setProfiles(new Map());
      }

      if (active) {
        setItems(records);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [scope, user]);

  const emptyMessage = useMemo(() => {
    if (!user) return "Sign in to see activity.";
    if (loading) return "Loading activity...";
    return scope === "mine"
      ? "You have not created or joined meetups yet."
      : "No activity yet. Send meetup requests to start the feed.";
  }, [loading, scope, user]);

  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2 px-3">
      {items.map((item) => {
        const host = profiles.get(item.hostId);
        const guest = profiles.get(item.guestId);
        const parsedLocation = parseMeetupLocation(item.location);

        return (
          <div key={item.id} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={host?.avatar_url ?? "https://i.pravatar.cc/80"}
                  alt={profileName(host)}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                <img
                  src={guest?.avatar_url ?? "https://i.pravatar.cc/81"}
                  alt={profileName(guest)}
                  className="h-8 w-8 rounded-full object-cover"
                />
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusChip(item.status)}`}>
                {item.status}
              </span>
            </div>

            <p className="text-sm font-semibold">
              {profileName(host)} requested a meetup with {profileName(guest)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{parsePurpose(item.notes)}</p>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" /> {timeAgo(item.createdAt)}
              </span>
              {parsedLocation.label && (
                <span className="inline-flex items-center gap-1 min-w-0 truncate">
                  <MapPin className="h-3.5 w-3.5" /> {parsedLocation.label}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                <Link to={`/profile/${item.hostId}`} className="hover:text-foreground">Host</Link>
                <span>·</span>
                <Link to={`/profile/${item.guestId}`} className="hover:text-foreground">Guest</Link>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ForYouFeed;
