import { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Share2, Bookmark, MapPin, Repeat2, Play, AlertTriangle, MoreVertical, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import PaywallOverlay from "./PaywallOverlay";
import SharePostDialog from "./SharePostDialog";
import SensitiveOverlay from "./SensitiveOverlay";
import BoostPostDialog from "./BoostPostDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSensitivePref } from "@/hooks/useSensitivePref";

interface BasePost {
  id: string;
  user: { username: string; avatar: string; distance: string };
  likes: number;
  comments: number;
  timeAgo: string;
  liked: boolean;
  isPrivate?: boolean;
  isSensitive?: boolean;
  price?: number;
  showSnippet?: boolean;
}

interface ImagePost extends BasePost {
  type: "image";
  image: string;
  caption: string;
}

interface TextPost extends BasePost {
  type: "text";
  text: string;
}

interface VideoPost extends BasePost {
  type: "video";
  video: string;
  thumbnail: string;
  caption: string;
}

interface SharedPost extends BasePost {
  type: "shared";
  shareComment: string;
  originalPost: {
    user: { username: string; avatar: string };
    text: string;
  };
}

export type Post = ImagePost | TextPost | VideoPost | SharedPost;

const VideoPostContent = ({ post, isLocked, onDoubleClick }: { post: VideoPost; isLocked?: boolean; onDoubleClick?: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const snippetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (snippetTimerRef.current) clearTimeout(snippetTimerRef.current);
    };
  }, []);

  const handlePlaySnippet = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setIsPlaying(true);
    snippetTimerRef.current = setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }, 5000);
  };

  return (
    <>
      <div className="relative aspect-video w-full overflow-hidden bg-secondary" onDoubleClick={onDoubleClick}>
        {isLocked && !post.showSnippet ? (
          <>
            <img
              src={post.thumbnail}
              alt=""
              className="h-full w-full object-cover blur-xl scale-110"
            />
            <PaywallOverlay
              type="video"
              price={post.price}
              username={post.user.username}
              hasSnippet={false}
            />
          </>
        ) : isLocked && post.showSnippet ? (
          <>
            <video
              ref={videoRef}
              src={post.video}
              poster={post.thumbnail}
              className="h-full w-full object-cover"
              muted
              playsInline
              onEnded={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                <button
                  onClick={handlePlaySnippet}
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Watch 5s Preview
                </button>
              </div>
            )}
            {isPlaying && (
              <div className="absolute top-3 left-3 rounded-full bg-primary/90 px-3 py-1 text-[11px] font-bold text-primary-foreground animate-pulse">
                5s PREVIEW
              </div>
            )}
            <PaywallOverlay
              type="video"
              price={post.price}
              username={post.user.username}
              hasSnippet={true}
              snippetSeconds={5}
            />
          </>
        ) : (
          <video
            src={post.video}
            poster={post.thumbnail}
            className="h-full w-full object-cover"
            controls
            playsInline
          />
        )}
      </div>
      {post.caption && !isLocked && (
        <div className="px-4 pt-2">
          <p className="text-sm">
            <span className="font-semibold">{post.user.username}</span>{" "}
            <span className="text-muted-foreground">{post.caption}</span>
          </p>
        </div>
      )}
    </>
  );
};

const PostCard = ({ post }: { post: Post }) => {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [boostOpen, setBoostOpen] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [pref, setPref] = useSensitivePref();
  const [revealed, setRevealed] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikes((prev) => (liked ? prev - 1 : prev + 1));
  };

  // Hide mode: don't render this post at all
  if (post.isSensitive && pref === "hide") return null;

  const isLocked = post.isPrivate;
  const sensitiveBlurred = !!post.isSensitive && pref === "blur" && !revealed;

  const previewText =
    post.type === "image" ? post.caption
    : post.type === "video" ? post.caption
    : post.type === "text" ? post.text
    : post.shareComment || post.originalPost.text;

  const handleRepost = (_postId: string, _comment: string) => {
    setReposted(true);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl card-elevated overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-ember p-[2px]">
            <img src={post.user.avatar} alt="" className="h-full w-full rounded-[10px] border border-background object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground tracking-tight">{post.user.username}</p>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="text-[10px] font-medium">{post.user.distance} away</span>
              <span className="text-[10px]">·</span>
              <span className="text-[10px]">{post.timeAgo}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.isSensitive && (
            <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[9px] font-bold text-amber-400 uppercase tracking-widest">
              <AlertTriangle className="h-3 w-3" /> Sensitive
            </span>
          )}
          {post.isPrivate && (
            <span className="rounded-lg bg-primary/15 px-2.5 py-1 text-[9px] font-bold text-primary uppercase tracking-widest border-glow">
              Premium
            </span>
          )}
          {post.type === "shared" && (
            <span className="flex items-center gap-1 text-[11px] text-primary font-semibold">
              <Repeat2 className="h-3.5 w-3.5" /> Shared
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Post options"
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => setBoostOpen(true)} className="gap-2 font-semibold">
                <Rocket className="h-4 w-4 text-primary" />
                Boost post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content by type */}
      {post.type === "image" && (
        <>
          <div className="relative aspect-[4/3] w-full overflow-hidden" onDoubleClick={!isLocked && !sensitiveBlurred ? handleLike : undefined}>
            <img
              src={post.image}
              alt=""
              className={cn(
                "h-full w-full object-cover transition-all",
                isLocked && "blur-xl scale-110",
                sensitiveBlurred && "blur-2xl scale-110"
              )}
            />
            {isLocked && (
              <PaywallOverlay
                type="image"
                price={post.price}
                username={post.user.username}
                hasSnippet={post.showSnippet}
              />
            )}
            {sensitiveBlurred && !isLocked && (
              <SensitiveOverlay
                onReveal={() => setRevealed(true)}
                onAlwaysShow={() => setPref("show")}
              />
            )}
          </div>
          {post.caption && !isLocked && !sensitiveBlurred && (
            <div className="px-4 pt-2">
              <p className="text-sm">
                <span className="font-semibold">{post.user.username}</span>{" "}
                <span className="text-muted-foreground">{post.caption}</span>
              </p>
            </div>
          )}
        </>
      )}

      {post.type === "video" && (
        <div className="relative">
          <div className={cn(sensitiveBlurred && "pointer-events-none")}>
            <VideoPostContent post={post} isLocked={isLocked} onDoubleClick={!isLocked && !sensitiveBlurred ? handleLike : undefined} />
          </div>
          {sensitiveBlurred && !isLocked && (
            <div className="absolute inset-0 backdrop-blur-2xl bg-background/40">
              <SensitiveOverlay
                onReveal={() => setRevealed(true)}
                onAlwaysShow={() => setPref("show")}
              />
            </div>
          )}
        </div>
      )}

      {post.type === "text" && (
        <div className="relative px-4 pb-1 min-h-[80px]" onDoubleClick={!isLocked && !sensitiveBlurred ? handleLike : undefined}>
          <p className={cn(
            "text-[15px] leading-relaxed text-foreground whitespace-pre-wrap",
            isLocked && "blur-md select-none",
            sensitiveBlurred && "blur-md select-none"
          )}>
            {post.text}
          </p>
          {isLocked && (
            <PaywallOverlay
              type="text"
              price={post.price}
              username={post.user.username}
              hasSnippet={false}
            />
          )}
          {sensitiveBlurred && !isLocked && (
            <SensitiveOverlay
              compact
              onReveal={() => setRevealed(true)}
              onAlwaysShow={() => setPref("show")}
            />
          )}
        </div>
      )}

      {post.type === "shared" && (
        <div className="relative px-4 pb-1 space-y-2 min-h-[100px]" onDoubleClick={!isLocked && !sensitiveBlurred ? handleLike : undefined}>
          <div className={cn(
            (isLocked || sensitiveBlurred) && "blur-md select-none"
          )}>
            {post.shareComment && (
              <p className="text-sm text-foreground">{post.shareComment}</p>
            )}
            <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <img src={post.originalPost.user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-xs font-semibold text-foreground">{post.originalPost.user.username}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{post.originalPost.text}</p>
            </div>
          </div>
          {isLocked && (
            <PaywallOverlay
              type="text"
              price={post.price}
              username={post.user.username}
              hasSnippet={false}
            />
          )}
          {sensitiveBlurred && !isLocked && (
            <SensitiveOverlay
              compact
              onReveal={() => setRevealed(true)}
              onAlwaysShow={() => setPref("show")}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={handleLike} className="p-2 rounded-xl hover:bg-secondary transition-colors active:scale-110">
            <Heart className={cn("h-5 w-5", liked ? "fill-primary text-primary" : "text-foreground")} />
          </button>
          <button className="p-2 rounded-xl hover:bg-secondary transition-colors">
            <MessageCircle className="h-5 w-5 text-foreground" />
          </button>
          <button
            onClick={() => { setShareOpen(true); }}
            className={cn(
              "p-2 rounded-xl hover:bg-secondary transition-colors",
              reposted && "text-primary"
            )}
            aria-label="Repost"
          >
            <Repeat2 className={cn("h-4.5 w-4.5", reposted ? "text-primary" : "text-foreground")} />
          </button>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/?post=${post.id}`;
              if (navigator.share) {
                try {
                  await navigator.share({ title: `@${post.user.username}`, text: previewText, url });
                } catch { /* cancelled */ }
              } else {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copied to clipboard");
                } catch {
                  setShareOpen(true);
                }
              }
            }}
            className="p-2 rounded-xl hover:bg-secondary transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-4.5 w-4.5 text-foreground" />
          </button>
        </div>
        <button onClick={() => setSaved(!saved)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <Bookmark className={cn("h-5 w-5", saved ? "fill-foreground text-foreground" : "text-foreground")} />
        </button>
      </div>

      {/* Info */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <p className="text-sm font-bold">{likes.toLocaleString()} <span className="font-medium text-muted-foreground">likes</span></p>
        <button className="text-[11px] text-muted-foreground font-medium hover:text-foreground transition-colors">
          {post.comments} comments
        </button>
      </div>

      <SharePostDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        post={{
          id: post.id,
          username: post.user.username,
          avatar: post.user.avatar,
          preview: previewText,
        }}
        onRepost={handleRepost}
      />

      <BoostPostDialog open={boostOpen} onOpenChange={setBoostOpen} postId={post.id} />
    </motion.article>
  );
};

export default PostCard;
