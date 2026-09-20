import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import GoLiveModal, { type GoLiveData } from "./GoLiveModal";
import { createPayFastPayment, checkContentUnlocked } from "@/lib/payfast";
import { Loader2 } from "lucide-react";
import {
  Radio,
  Clock,
  History,
  Lock,
  Globe,
  DollarSign,
  MapPin,
  Eye,
  Users,
  Calendar,
  Navigation,
  Flame,
  Sparkles,
  TrendingUp,
} from "lucide-react";

type SortMode = "nearby" | "popular" | "suggested" | "most_viewed";

const sortOptions = [
  { key: "nearby" as const, label: "Nearby", icon: Navigation },
  { key: "popular" as const, label: "Popular", icon: Flame },
  { key: "suggested" as const, label: "Suggested", icon: Sparkles },
  { key: "most_viewed" as const, label: "Most Viewed", icon: TrendingUp },
];

export interface LiveUser {
  id: string;
  username: string;
  avatar: string;
  distance: number;
  title: string;
  viewers?: number;
  status: "live" | "scheduled" | "recently_live";
  visibility: "public" | "private";
  fee?: number;
  scheduledAt?: string;
  endedAt?: string;
  category?: string;
}

const mockLiveUsers: LiveUser[] = [];
// Real live users loaded from live_streams table in Supabase
// Table should contain: id, creator_id, username, avatar, title, viewers, status, created_at

const subTabs = [
  { key: "live" as const, label: "Live Now", icon: Radio },
  { key: "scheduled" as const, label: "Scheduled", icon: Calendar },
  { key: "recently_live" as const, label: "Recent", icon: History },
] as const;

const LiveSection = () => {
  const [activeSubTab, setActiveSubTab] = useState<"live" | "scheduled" | "recently_live">("live");
  const [sortMode, setSortMode] = useState<SortMode>("nearby");
  const [maxDistance, setMaxDistance] = useState<number>(10);
  const [showGoLive, setShowGoLive] = useState(false);
  const [myStreams, setMyStreams] = useState<LiveUser[]>([]);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const openRoom = (id: string) => navigate(`/live/${id}`);

  const handleJoin = async (user: LiveUser) => {
    if (!user.fee) {
      if (user.status === "scheduled") {
        toast({ title: "Reminder set", description: `@${user.username} — ${user.title}` });
        return;
      }
      openRoom(user.id);
      return;
    }

    if (unlockedIds.has(user.id)) {
      openRoom(user.id);
      return;
    }

    setJoiningId(user.id);
    try {
      const alreadyUnlocked = await checkContentUnlocked(user.id);
      if (alreadyUnlocked) {
        setUnlockedIds((prev) => new Set(prev).add(user.id));
        setJoiningId(null);
        openRoom(user.id);
        return;
      }

      const itemName =
        user.status === "live"
          ? `Attendance fee — @${user.username} live`
          : user.status === "scheduled"
          ? `Reservation — @${user.username} (${user.scheduledAt ?? "scheduled"})`
          : `Replay unlock — @${user.username}`;

      const { redirectUrl } = await createPayFastPayment({
        contentId: user.id,
        amount: user.fee,
        itemName,
        paymentType: "once_off",
        creatorId: user.id,
      });
      window.location.href = redirectUrl;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Payment failed";
      toast({ title: "Couldn't start payment", description: msg, variant: "destructive" });
      setJoiningId(null);
    }
  };

  const allStreams = useMemo(() => [...myStreams, ...mockLiveUsers], [myStreams]);

  const handleGoLive = (data: GoLiveData) => {
    const newStream: LiveUser = {
      id: `mine-${Date.now()}`,
      username: "you",
      avatar: "https://i.pravatar.cc/100?img=30",
      distance: 0,
      title: data.title,
      category: data.category,
      visibility: data.visibility,
      fee: data.fee,
      status: data.scheduleNow ? "live" : "scheduled",
      viewers: data.scheduleNow ? 1 : undefined,
      scheduledAt: data.scheduledAt
        ? new Date(data.scheduledAt).toLocaleString([], {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined,
    };
    setMyStreams((prev) => [newStream, ...prev]);
    setActiveSubTab(data.scheduleNow ? "live" : "scheduled");
    toast({
      title: data.scheduleNow ? "🔴 You're live!" : "📅 Stream scheduled",
      description: data.scheduleNow
        ? "Viewers nearby can now join your stream."
        : `Scheduled for ${newStream.scheduledAt}`,
    });
  };

  const filtered = useMemo(() => {
    const base = allStreams.filter((u) => u.status === activeSubTab && u.distance <= maxDistance);
    const sorted = [...base];
    switch (sortMode) {
      case "nearby":
        sorted.sort((a, b) => a.distance - b.distance);
        break;
      case "popular":
        sorted.sort(
          (a, b) =>
            ((b.viewers ?? 0) + (b.fee ? 200 : 0)) / (b.distance + 1) -
            ((a.viewers ?? 0) + (a.fee ? 200 : 0)) / (a.distance + 1)
        );
        break;
      case "suggested":
        sorted.sort(
          (a, b) =>
            ((b.fee ? 1 : 0) + (b.viewers ?? 0) / 1000 - b.distance * 0.1) -
            ((a.fee ? 1 : 0) + (a.viewers ?? 0) / 1000 - a.distance * 0.1)
        );
        break;
      case "most_viewed":
        sorted.sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0));
        break;
    }
    return sorted;
  }, [activeSubTab, sortMode, maxDistance]);

  return (
    <div className="space-y-3">
      {/* Go Live CTA */}
      <button
        onClick={() => setShowGoLive(true)}
        className="group relative w-full overflow-hidden rounded-2xl bg-gradient-red glow p-4 text-left transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_50%,white,transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur ring-2 ring-primary-foreground/40">
            <Radio className="h-5 w-5 text-primary-foreground animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-primary-foreground">Go Live</div>
            <div className="text-[11px] text-primary-foreground/80">
              Start streaming or schedule a session
            </div>
          </div>
          <span className="rounded-full bg-primary-foreground/20 px-2.5 py-1 text-[10px] font-bold text-primary-foreground backdrop-blur">
            START
          </span>
        </div>
      </button>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {subTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSubTab(key)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
              activeSubTab === key
                ? "bg-gradient-red text-primary-foreground glow"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {key === "live" && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Sort filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {sortOptions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSortMode(key)}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 min-h-[40px] text-[11px] font-semibold transition-all border",
              sortMode === key
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Range slider */}
      <div className="rounded-xl bg-card border border-border px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            <MapPin className="h-3 w-3 text-primary" /> Search Range
          </span>
          <span className="text-xs font-bold text-primary">
            {maxDistance >= 50 ? "50+ km" : `${maxDistance} km`}
          </span>
        </div>
        <Slider
          value={[maxDistance]}
          min={1}
          max={50}
          step={1}
          onValueChange={(v) => setMaxDistance(v[0])}
        />
        <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
          <span>1 km</span>
          <span>25 km</span>
          <span>50 km</span>
        </div>
      </div>

      {/* Cards */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-2.5">
          {filtered.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-card border border-border overflow-hidden"
            >
              {/* Header with avatar and stream info */}
              <div className="p-3 flex gap-3">
                <div className="relative flex-shrink-0">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className={cn(
                      "h-12 w-12 rounded-full object-cover",
                      user.status === "live" && "ring-2 ring-primary ring-offset-2 ring-offset-card"
                    )}
                  />
                  {user.status === "live" && (
                    <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground">
                      LIVE
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold truncate">@{user.username}</span>
                    {user.category && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                        {user.category}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{user.title}</p>

                  {/* Meta info row */}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5 text-primary">
                      <MapPin className="h-3 w-3" />
                      {user.distance} km
                    </span>
                    {user.viewers !== undefined && (
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        {user.viewers.toLocaleString()}
                      </span>
                    )}
                    {user.status === "scheduled" && user.scheduledAt && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {user.scheduledAt}
                      </span>
                    )}
                    {user.status === "recently_live" && user.endedAt && (
                      <span className="flex items-center gap-0.5">
                        <History className="h-3 w-3" />
                        {user.endedAt}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer with visibility, fee, and action */}
              <div className="px-3 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {user.visibility === "public" ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-green-500">
                      <Globe className="h-3 w-3" /> Public
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500">
                      <Lock className="h-3 w-3" /> Subscribers Only
                    </span>
                  )}
                  {user.fee && (
                    <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      <DollarSign className="h-3 w-3" /> R{user.fee}
                    </span>
                  )}
                </div>

                <Button
                  size="sm"
                  onClick={() => handleJoin(user)}
                  disabled={joiningId === user.id}
                  className={cn(
                    "text-xs h-7 gap-1",
                    user.status === "live"
                      ? "bg-gradient-red hover:opacity-90 glow"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  )}
                >
                  {joiningId === user.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  {joiningId === user.id
                    ? "Redirecting…"
                    : unlockedIds.has(user.id)
                    ? user.status === "recently_live"
                      ? "Watch Replay"
                      : "Join Now 🎟️"
                    : user.status === "live"
                    ? user.fee
                      ? `Pay R${user.fee} to Join`
                      : "Watch Live"
                    : user.status === "scheduled"
                    ? user.fee
                      ? `Reserve — R${user.fee}`
                      : "Set Reminder"
                    : user.fee
                    ? `Unlock — R${user.fee}`
                    : "Watch Replay"}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <Radio className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {activeSubTab === "live"
              ? "No one is live right now"
              : activeSubTab === "scheduled"
              ? "No upcoming live sessions"
              : "No recent live sessions"}
          </p>
        </div>
      )}

      <GoLiveModal
        open={showGoLive}
        onClose={() => setShowGoLive(false)}
        onGoLive={handleGoLive}
      />
    </div>
  );
};

export default LiveSection;
