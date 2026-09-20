import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings, Grid3X3, Bookmark, Heart, Film, Star, MessageSquareText, Eye, EyeOff, AlertTriangle, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import SeriesSection from "@/components/profile/SeriesSection";
import StarRating from "@/components/ratings/StarRating";
import RatingDialog from "@/components/ratings/RatingDialog";
import ReviewsList from "@/components/ratings/ReviewsList";
import SettingsSheet from "@/components/profile/SettingsSheet";
import { useSensitivePref, type SensitivePref } from "@/hooks/useSensitivePref";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Profile images - would be loaded from content_unlocks or creator posts table
// For now, commented out as posts tracking is not yet implemented

interface ProfileRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  average_rating: number;
  ratings_count: number;
}

interface ProfilePost {
  id: string;
  description: string | null;
  is_sensitive: boolean | null;
  post_type: string | null;
  created_at: string;
}

const SENSITIVE_OPTIONS: { value: SensitivePref; label: string; desc: string; icon: typeof Eye }[] = [
  { value: "hide", label: "Hide sensitive content", desc: "Don't show flagged posts in any feed.", icon: EyeOff },
  { value: "blur", label: "Blur with warning", desc: "Default — covers content until you tap to view.", icon: AlertTriangle },
  { value: "show", label: "Always show sensitive content", desc: "No blur or warning. Show everything.", icon: Eye },
];

const ContentPreferencesCard = () => {
  const [pref, setPref] = useSensitivePref();
  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <p className="text-sm font-semibold">Sensitive content</p>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Choose how posts marked as sensitive by their creators should appear in your feed.
      </p>
      <div className="space-y-1.5">
        {SENSITIVE_OPTIONS.map((opt) => {
          const active = pref === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => setPref(opt.value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/40 hover:bg-secondary"
              )}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-semibold", active ? "text-foreground" : "text-foreground/90")}>
                  {opt.label}
                </p>
                <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
              </div>
              <span
                className={cn(
                  "h-3.5 w-3.5 mt-0.5 rounded-full border-2",
                  active ? "border-primary bg-primary" : "border-muted-foreground/40"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const UserIdCard = ({ userId }: { userId: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      toast({ title: "User ID copied", description: userId });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };
  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your User ID</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-background/60 px-2 py-1.5 text-[11px] font-mono text-foreground">
          {userId}
        </code>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleCopy}
          className="h-8 gap-1 text-xs"
          aria-label="Copy user ID"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
};

const Profile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profilePosts, setProfilePosts] = useState<ProfilePost[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  // Decide whose profile we're showing — URL param wins, else current user
  const targetUserId = userId ?? user?.id ?? null;

  useEffect(() => {
    if (!targetUserId) {
      setProfile(null);
      setProfilePosts([]);
      return;
    }
    let active = true;
    (async () => {
      const [
        { data: profileData },
        { data: postsData, error: postsErr },
        { count: followers },
        { count: followingCount },
        { data: myFollow },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url, bio, average_rating, ratings_count")
          .eq("user_id", targetUserId)
          .maybeSingle(),
        supabase
          .from("post_metadata")
          .select("id, description, is_sensitive, post_type, created_at")
          .eq("creator_id", targetUserId)
          .order("created_at", { ascending: false })
          .limit(9),
        // Counts only — head:true sends no rows over the wire.
        supabase
          .from("followers_relationships")
          .select("*", { count: "exact", head: true })
          .eq("following_id", targetUserId),
        supabase
          .from("followers_relationships")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", targetUserId),
        // Whether the signed-in user follows this profile (skipped on your own).
        user && user.id !== targetUserId
          ? supabase
              .from("followers_relationships")
              .select("follower_id")
              .eq("follower_id", user.id)
              .eq("following_id", targetUserId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (active) {
        setProfile(profileData ?? null);
        setProfilePosts(postsData ?? []);
        setFollowerCount(followers ?? 0);
        setFollowingCount(followingCount ?? 0);
        setIsFollowing(!!myFollow);
        // Previously this error was discarded, so a failing query (the post_metadata
        // table does not exist yet) was indistinguishable from "no posts yet".
        if (postsErr) {
          console.error("Failed to load posts:", postsErr);
          setPostsError(postsErr.message);
        } else {
          setPostsError(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [targetUserId, refreshKey, user]);

  /** Follow / unfollow this profile. Optimistic, rolled back if the write fails. */
  const toggleFollow = async () => {
    if (!user || !targetUserId || followPending || user.id === targetUserId) return;
    const wasFollowing = isFollowing;
    setFollowPending(true);
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => Math.max(0, (c ?? 0) + (wasFollowing ? -1 : 1)));

    const { error } = wasFollowing
      ? await supabase
          .from("followers_relationships")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
      : await supabase
          .from("followers_relationships")
          .insert({ follower_id: user.id, following_id: targetUserId });

    if (error) {
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => Math.max(0, (c ?? 0) + (wasFollowing ? 1 : -1)));
      console.error("Follow toggle failed:", error);
      toast({
        title: wasFollowing ? "Couldn't unfollow" : "Couldn't follow",
        description: "Please try again.",
        variant: "destructive",
      });
    }
    setFollowPending(false);
  };

  /** Share this profile. Uses the native share sheet on mobile, clipboard elsewhere. */
  const handleShare = async () => {
    const url = targetUserId
      ? `${window.location.origin}/profile/${targetUserId}`
      : window.location.href;
    const shareData = {
      title: profile?.display_name ?? profile?.username ?? "RED RXXM profile",
      text: `Check out @${profile?.username ?? "this profile"} on RED RXXM`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Profile link copied to your clipboard." });
    } catch (error) {
      // A user dismissing the native share sheet throws AbortError — not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Share failed:", error);
      toast({
        title: "Couldn't share",
        description: "Copy the link from your browser's address bar instead.",
        variant: "destructive",
      });
    }
  };

  const isOwn = !!user && (!userId || userId === user.id);
  const handle = profile?.username ?? "you_user";
  const name = profile?.display_name ?? "Your Name";
  const bio = profile?.bio ?? "Living life one post at a time 📍";
  const avatar = profile?.avatar_url ?? "https://i.pravatar.cc/100?img=32";

  return (
    <>
      <div className="py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            @{handle}
          </h2>
          {!userId && (
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:text-primary rounded-xl"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Profile Info */}
        <div className="flex items-center gap-6 mb-4">
          <div className="h-20 w-20 rounded-full bg-gradient-red p-[2px]">
            <img src={avatar} alt="" className="h-full w-full rounded-full border-2 border-background object-cover" />
          </div>
          <div className="flex flex-1 justify-around text-center">
            <div>
              {/* Posts stays a dash until post_metadata exists — showing 0 would
                  claim "no posts", which isn't the same as "we can't tell yet". */}
              <p className="text-lg font-bold tabular-nums">{postsError ? "—" : profilePosts.length}</p>
              <p className="text-[11px] text-muted-foreground">Posts</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums">{followerCount ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums">{followingCount ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">Following</p>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{bio}</p>
        </div>

        {/* Rating summary */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Star className="h-4 w-4 text-primary fill-primary" />
          <StarRating
            value={profile?.average_rating ?? 0}
            count={profile?.ratings_count ?? 0}
            size="md"
          />
          {!isOwn && targetUserId && (
            <Button
              size="sm"
              onClick={() => setRateOpen(true)}
              className="ml-auto h-8 text-xs bg-gradient-red glow gap-1"
            >
              <Star className="h-3.5 w-3.5" /> Rate
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          {isOwn ? (
            <Button
              onClick={() => setSettingsOpen(true)}
              className="flex-1 bg-gradient-red hover:opacity-90 glow text-xs h-9"
            >
              Edit Profile
            </Button>
          ) : (
            <Button
              onClick={toggleFollow}
              disabled={followPending}
              variant={isFollowing ? "outline" : "default"}
              className={cn(
                "flex-1 text-xs h-9",
                !isFollowing && "bg-gradient-red hover:opacity-90 glow",
              )}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          )}
          <Button onClick={handleShare} variant="secondary" className="flex-1 text-xs h-9">
            Share Profile
          </Button>
        </div>

        {isOwn && user && <UserIdCard userId={user.id} />}
        {isOwn && <ContentPreferencesCard />}

        {/* Tabs */}
        <Tabs defaultValue="posts">
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="posts" className="flex-1"><Grid3X3 className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="saved" className="flex-1"><Bookmark className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="liked" className="flex-1"><Heart className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="series" className="flex-1"><Film className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1"><MessageSquareText className="h-4 w-4" /></TabsTrigger>
          </TabsList>
          <TabsContent value="posts">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {profilePosts.length > 0 ? (
                profilePosts.map((post) => (
                  <div key={post.id} className="aspect-square rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden p-2">
                    <div className="text-xs text-center line-clamp-3">{post.description}</div>
                  </div>
                ))
              ) : postsError ? (
                <div className="col-span-full py-12 text-center text-sm text-destructive">
                  Couldn't load posts. Please try again later.
                </div>
              ) : (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No posts yet
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="saved">
            <div className="py-12 text-center text-sm text-muted-foreground">No saved posts yet</div>
          </TabsContent>
          <TabsContent value="liked">
            <div className="py-12 text-center text-sm text-muted-foreground">No liked posts yet</div>
          </TabsContent>
          <TabsContent value="series">
            <SeriesSection />
          </TabsContent>
          <TabsContent value="reviews" className="mt-3">
            {targetUserId ? (
              <ReviewsList rateeId={targetUserId} refreshKey={refreshKey} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sign in to see your reviews.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {targetUserId && !isOwn && (
        <RatingDialog
          open={rateOpen}
          onOpenChange={setRateOpen}
          rateeId={targetUserId}
          rateeName={name}
          targetType="user"
          onSubmitted={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {!userId && (
        <SettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onProfileUpdated={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  );
};

export default Profile;
