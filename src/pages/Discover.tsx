import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import { MapPin, Search, UserPlus, UserCheck, TrendingUp, Star, Crown, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getBrowserLocation, haversineKm, parseMeetupLocation, type GeoPoint } from "@/lib/geo";
import { useAuth } from "@/hooks/useAuth";

type DiscoverUser = {
  id: string;
  username: string;
  bio: string;
  avatar: string;
  followers: number;
  rating: number;
  ratingsCount: number;
  distanceKm: number | null;
  locationLabel: string;
};

const tabs = ["Trending", "Top Rated", "Nearby", "Live"] as const;

const RankBadge = ({ rank }: { rank: number }) => {
  return (
    <div
      className={cn(
        "absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground",
        rank === 1 ? "bg-gradient-red glow" : "bg-primary/80",
      )}
      aria-label={`Rank ${rank}`}
    >
      {rank === 1 ? <Crown className="h-3 w-3" /> : rank}
    </div>
  );
};

const Discover = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Trending");
  const [range, setRange] = useState([10]);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [pendingFollow, setPendingFollow] = useState<string | null>(null);
  const [myCoords, setMyCoords] = useState<GeoPoint | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!user) {
        if (active) {
          setUsers([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const coords = await getBrowserLocation().catch(() => null);
      if (active) {
        setGpsEnabled(!!coords);
        setMyCoords(coords);
      }

      const [{ data: profiles }, { data: meetups }, { data: followRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, bio, average_rating, ratings_count")
          .neq("user_id", user.id),
        supabase
          .from("meetups")
          .select("host_id, guest_id, location, created_at")
          .not("location", "is", null)
          .order("created_at", { ascending: false })
          .limit(600),
        // One query covers both things we need: follower totals per profile, and which
        // of them this user already follows. This replaces a per-profile count query
        // that fired one round trip for every profile in the list, plus a third query
        // whose result was computed and never used.
        supabase.from("followers_relationships").select("follower_id, following_id"),
      ]);

      const followerCountByUserId = new Map<string, number>();
      const alreadyFollowing = new Set<string>();
      (followRows ?? []).forEach((row) => {
        followerCountByUserId.set(
          row.following_id,
          (followerCountByUserId.get(row.following_id) ?? 0) + 1,
        );
        if (row.follower_id === user.id) alreadyFollowing.add(row.following_id);
      });

      const userLocationById = new Map<string, { coords: GeoPoint; label: string }>();
      (meetups ?? []).forEach((m) => {
        const parsed = parseMeetupLocation(m.location);
        if (!parsed.coords) return;
        if (!userLocationById.has(m.host_id)) {
          userLocationById.set(m.host_id, { coords: parsed.coords, label: parsed.label });
        }
        if (!userLocationById.has(m.guest_id)) {
          userLocationById.set(m.guest_id, { coords: parsed.coords, label: parsed.label });
        }
      });

      const next: DiscoverUser[] = (profiles ?? []).map((p) => {
        const knownLoc = userLocationById.get(p.user_id);
        return {
          id: p.user_id,
          username: p.username ?? p.display_name ?? "unknown",
          bio: p.bio ?? "No bio yet",
          avatar: p.avatar_url ?? "https://i.pravatar.cc/100",
          followers: followerCountByUserId.get(p.user_id) ?? 0,
          rating: Number(p.average_rating ?? 0),
          ratingsCount: p.ratings_count ?? 0,
          distanceKm: coords && knownLoc ? haversineKm(coords, knownLoc.coords) : null,
          locationLabel: knownLoc?.label ?? "",
        };
      });

      next.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });

      if (active) {
        setUsers(next);
        setFollowing(alreadyFollowing);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  /** Follow / unfollow. Optimistic, with a rollback if the write is rejected —
   *  the buttons previously had no handler at all. */
  const toggleFollow = async (targetId: string) => {
    if (!user || pendingFollow) return;
    const wasFollowing = following.has(targetId);
    const delta = wasFollowing ? -1 : 1;

    setPendingFollow(targetId);
    const applyLocal = (add: boolean, countDelta: number) => {
      setFollowing((prev) => {
        const next = new Set(prev);
        if (add) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetId ? { ...u, followers: Math.max(0, u.followers + countDelta) } : u,
        ),
      );
    };

    applyLocal(!wasFollowing, delta);

    const { error } = wasFollowing
      ? await supabase
          .from("followers_relationships")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetId)
      : await supabase
          .from("followers_relationships")
          .insert({ follower_id: user.id, following_id: targetId });

    if (error) {
      applyLocal(wasFollowing, -delta);
      console.error("Follow toggle failed:", error);
      toast.error(wasFollowing ? "Couldn't unfollow. Please try again." : "Couldn't follow. Please try again.");
    }
    setPendingFollow(null);
  };

  const globalTop = useMemo(() => {
    const sorted = [...users].sort((a, b) => b.rating - a.rating || b.ratingsCount - a.ratingsCount);
    const map = new Map<string, number>();
    sorted.slice(0, 3).forEach((u, i) => map.set(u.id, i + 1));
    return map;
  }, [users]);

  const areaSuggestions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.locationLabel) set.add(u.locationLabel);
    });
    return Array.from(set);
  }, [users]);

  const filteredUsers = useMemo(() => {
    const area = areaFilter.trim().toLowerCase();
    return users
      .filter((u) => {
        if (u.distanceKm === null) return !gpsEnabled;
        return u.distanceKm <= range[0];
      })
      .filter(
        (u) =>
          u.username.toLowerCase().includes(search.toLowerCase()) ||
          u.bio.toLowerCase().includes(search.toLowerCase()),
      )
      .filter((u) => (area ? u.locationLabel.toLowerCase().includes(area) : true));
  }, [areaFilter, gpsEnabled, range, search, users]);

  const topRated = useMemo(
    () => [...users].sort((a, b) => b.rating - a.rating || b.ratingsCount - a.ratingsCount),
    [users],
  );

  const trendingStats = useMemo(() => {
    const rated = users.filter((u) => u.ratingsCount > 0).length;
    const average = users.length ? users.reduce((acc, u) => acc + u.rating, 0) / users.length : 0;
    const nearbyKnown = users.filter((u) => u.distanceKm !== null).length;
    return [
      { label: "Profiles", value: users.length.toString() },
      { label: "Rated Users", value: rated.toString() },
      { label: "Avg Rating", value: average.toFixed(2) },
      { label: "With GPS", value: nearbyKnown.toString() },
    ];
  }, [users]);

  const emptyMessage = !user
    ? "Sign in to discover nearby users."
    : loading
      ? "Loading discover data..."
      : "No users found yet.";

  return (
    <>
      <div className="py-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search people by username or bio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-none h-10 rounded-xl"
          />
        </div>

        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-4 py-2 min-h-[40px] text-xs font-semibold transition-all",
                activeTab === tab
                  ? "bg-gradient-red text-primary-foreground glow"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Trending" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Network Snapshot</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {trendingStats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === "Top Rated" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Top Rated Users</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {topRated.map((u, i) => {
              const rank = globalTop.get(u.id);
              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="relative flex items-center justify-between rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src={u.avatar} alt={u.username} className="h-11 w-11 rounded-xl object-cover" />
                      {rank && <RankBadge rank={rank} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">@{u.username}</p>
                      <p className="text-xs text-muted-foreground min-w-0 truncate">{u.bio}</p>
                      <p className="mt-1 text-[11px] text-primary inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-primary" /> {u.rating.toFixed(2)} ({u.ratingsCount})
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => toggleFollow(u.id)}
                    disabled={pendingFollow === u.id}
                    variant={following.has(u.id) ? "outline" : "default"}
                    className={cn("text-xs", !following.has(u.id) && "bg-gradient-red hover:opacity-90")}
                  >
                    {following.has(u.id) ? (
                      <><UserCheck className="h-3.5 w-3.5 mr-1" /> Following</>
                    ) : (
                      <><UserPlus className="h-3.5 w-3.5 mr-1" /> Follow</>
                    )}
                  </Button>
                </motion.div>
              );
            })}
            </div>
          </motion.div>
        )}

        {activeTab === "Nearby" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Search Range</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{range[0]} km</span>
                </div>
                <Slider value={range} onValueChange={setRange} max={50} min={1} step={1} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Filter by Area</span>
                  {areaFilter && (
                    <button onClick={() => setAreaFilter("")} className="text-[10px] text-primary font-semibold">
                      Clear
                    </button>
                  )}
                </div>
                <AreaAutocomplete
                  value={areaFilter}
                  onChange={setAreaFilter}
                  suggestions={areaSuggestions}
                  proximity={myCoords}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredUsers.length}</span> users in range
            </p>

            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {filteredUsers.map((u, i) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.username} className="h-11 w-11 rounded-xl object-cover" />
                      <div>
                        <p className="text-sm font-semibold">{u.username}</p>
                        <p className="text-xs text-muted-foreground min-w-0 truncate">{u.bio}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {u.distanceKm === null ? "Distance unavailable" : `${u.distanceKm.toFixed(1)} km away`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/profile/${u.id}`)}
                      className="bg-gradient-red hover:opacity-90 text-xs"
                    >
                      Connect
                    </Button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === "Live" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Recently Active Nearby</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {users.slice(0, 8).map((u) => (
              <div key={u.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img src={u.avatar} alt={u.username} className="h-10 w-10 rounded-full object-cover" />
                    <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-500 border border-card" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">@{u.username}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {u.distanceKm === null ? "GPS not shared" : `${u.distanceKm.toFixed(1)} km away`}
                    </p>
                  </div>
                </div>
                <Users className="h-4 w-4 text-primary" />
              </div>
            ))}
            </div>
          </motion.div>
        )}

        {!loading && users.length === 0 && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
      </div>
    </>
  );
};

export default Discover;
