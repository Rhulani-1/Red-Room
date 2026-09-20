import { useState } from "react";
import { Repeat2, Send, Link as LinkIcon, Share2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface SharePostTarget {
  id: string;
  username: string;
  avatar: string;
  preview: string; // caption / text snippet
}

interface SharePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: SharePostTarget | null;
  onRepost: (postId: string, comment: string) => void;
}

const SharePostDialog = ({ open, onOpenChange, post, onRepost }: SharePostDialogProps) => {
  const [mode, setMode] = useState<"repost" | "share">("repost");
  const [comment, setComment] = useState("");

  if (!post) return null;

  const shareUrl = `${window.location.origin}/?post=${post.id}`;

  const handleRepost = () => {
    onRepost(post.id, comment.trim());
    setComment("");
    onOpenChange(false);
    toast.success("Reposted to your profile");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleNativeShare = async () => {
    const data = {
      title: `@${post.username} on RED RXXM`,
      text: post.preview,
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // user cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* overflow-y-auto rather than overflow-hidden: tailwind-merge lets the consumer
          class win, so overflow-hidden here defeated DialogContent's own scrolling and
          could strand the submit button off-screen on short viewports. */}
      <DialogContent className="max-w-md p-0 overflow-y-auto">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">Share post</DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="mx-5 flex rounded-xl bg-secondary p-1 gap-1">
          <button
            onClick={() => setMode("repost")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
              mode === "repost"
                ? "bg-gradient-red text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Repeat2 className="h-3.5 w-3.5" /> Repost
          </button>
          <button
            onClick={() => setMode("share")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
              mode === "share"
                ? "bg-gradient-red text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
        </div>

        {/* Original post preview */}
        <div className="mx-5 mt-4 rounded-xl border border-border bg-secondary/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <img src={post.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
            <span className="text-xs font-semibold">@{post.username}</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {post.preview || "Media post"}
          </p>
        </div>

        {mode === "repost" ? (
          <div className="px-5 pb-5 pt-4 space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                Add a comment (optional)
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Say something about this..."
                maxLength={280}
                className="bg-secondary border-none rounded-xl resize-none min-h-[80px] text-sm"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {comment.length}/280
              </p>
            </div>
            <Button
              onClick={handleRepost}
              className="w-full bg-gradient-red hover:opacity-90 glow"
            >
              <Send className="h-4 w-4 mr-1.5" />
              {comment ? "Repost with comment" : "Repost"}
            </Button>
          </div>
        ) : (
          <div className="px-5 pb-5 pt-4 space-y-2">
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 rounded-xl bg-secondary hover:bg-secondary/70 px-4 py-3 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <LinkIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Copy link</p>
                <p className="text-[11px] text-muted-foreground min-w-0 truncate">
                  {shareUrl}
                </p>
              </div>
            </button>
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center gap-3 rounded-xl bg-secondary hover:bg-secondary/70 px-4 py-3 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                <Share2 className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Share via…</p>
                <p className="text-[11px] text-muted-foreground">
                  Open your device share sheet
                </p>
              </div>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SharePostDialog;
