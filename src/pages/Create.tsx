import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Camera, Image, Video, MapPin, Hash, AlignLeft, ImageIcon, AlertTriangle, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import SensitivePreviewSection from "@/components/feed/SensitivePreview";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const postTypes = [
  { id: "media", label: "Photo/Video", icon: ImageIcon },
  { id: "text", label: "Text Post", icon: AlignLeft },
] as const;

type PostType = typeof postTypes[number]["id"];

const Create = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [caption, setCaption] = useState("");
  const [postType, setPostType] = useState<PostType>("text");
  const [isSensitive, setIsSensitive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Media upload. The `posts` bucket is private, so the row stores the object path
  // and playback uses a signed URL — the same pattern GroupChat already uses.
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const MAX_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

  const pickMedia = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast({
        title: "File too large",
        description: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 50 MB.`,
        variant: "destructive",
      });
      return;
    }
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in first", variant: "destructive" });
      navigate("/auth");
      return;
    }

    const trimmed = caption.trim();
    if (!trimmed) {
      toast({ title: "Empty post", description: "Please write something to post", variant: "destructive" });
      return;
    }

    if (postType === "media" && !mediaFile) {
      toast({ title: "No media selected", description: "Choose a photo or video first", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let uploadedPath: string | null = null;
    try {
      if (postType === "media" && mediaFile) {
        // Path must start with the user id — the storage policy checks
        // foldername(name)[1] against auth.uid().
        const ext = mediaFile.name.split(".").pop()?.toLowerCase() || "bin";
        uploadedPath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(uploadedPath, mediaFile, { contentType: mediaFile.type, upsert: false });
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase
        .from("post_metadata")
        .insert({
          creator_id: user.id,
          description: trimmed,
          is_sensitive: isSensitive,
          post_type: postType === "media" ? "media" : "text",
          media_url: uploadedPath,
        });

      // Don't leave an orphaned file behind if the row fails to insert.
      if (error) {
        if (uploadedPath) {
          await supabase.storage.from("posts").remove([uploadedPath]).catch(() => undefined);
        }
        throw error;
      }

      toast({ title: "Post created!", description: "Your post has been published" });
      setCaption("");
      setIsSensitive(false);
      clearMedia();
      navigate("/");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to create post";
      toast({ title: "Error creating post", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="py-4 space-y-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Create Post
        </h2>

        {/* Post type selector */}
        <div className="flex gap-2">
          {postTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setPostType(type.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all",
                postType === type.id
                  ? "bg-gradient-red text-primary-foreground glow"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              <type.icon className="h-4 w-4" />
              {type.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {postType === "media" ? (
            <motion.div
              key="media"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Hidden inputs. `capture` opens the camera directly on a phone. */}
              <input
                ref={captureInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => { pickMedia(e.target.files?.[0]); e.target.value = ""; }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => { pickMedia(e.target.files?.[0]); e.target.value = ""; }}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                hidden
                onChange={(e) => { pickMedia(e.target.files?.[0]); e.target.value = ""; }}
              />

              {/* Upload area — shows a preview once something is chosen */}
              {mediaPreview ? (
                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                  {mediaFile?.type.startsWith("video/") ? (
                    <video src={mediaPreview} controls className="max-h-[60vh] w-full bg-black object-contain" />
                  ) : (
                    <img src={mediaPreview} alt="Selected media preview" className="max-h-[60vh] w-full bg-black object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={clearMedia}
                    aria-label="Remove selected media"
                    className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white backdrop-blur transition-colors hover:bg-black/90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="truncate px-3 py-2 text-[11px] text-muted-foreground">
                    {mediaFile?.name} — {((mediaFile?.size ?? 0) / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center rounded-xl border-2 border-dashed border-border bg-card">
                  <div className="text-center space-y-3">
                    <div className="flex justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => captureInputRef.current?.click()}
                        className="flex min-h-[44px] flex-col items-center gap-1 rounded-xl bg-secondary p-4 transition-colors hover:bg-muted"
                      >
                        <Camera className="h-6 w-6 text-primary" />
                        <span className="text-[10px] text-muted-foreground">Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex min-h-[44px] flex-col items-center gap-1 rounded-xl bg-secondary p-4 transition-colors hover:bg-muted"
                      >
                        <Image className="h-6 w-6 text-primary" />
                        <span className="text-[10px] text-muted-foreground">Gallery</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="flex min-h-[44px] flex-col items-center gap-1 rounded-xl bg-secondary p-4 transition-colors hover:bg-muted"
                      >
                        <Video className="h-6 w-6 text-primary" />
                        <span className="text-[10px] text-muted-foreground">Video</span>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Tap to add a photo or video (max 50 MB)</p>
                  </div>
                </div>
              )}

              {/* Caption */}
              <Textarea
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-secondary border-none resize-none"
                rows={3}
              />
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {/* Text post area */}
              <Textarea
                placeholder="What's on your mind? Share your thoughts..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="bg-card border border-border resize-none text-base leading-relaxed min-h-[200px]"
                rows={8}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{caption.length} / 500 characters</span>
                {caption.length > 0 && (
                  <span className="text-primary font-medium">
                    {caption.length <= 280 ? "Short post" : "Long post"}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Options */}
        <div className="space-y-2">
          {/* Not built yet. type="button" matters: without it these sit inside the
              form and clicking one submits the post. Disabled and labelled rather
              than left looking functional. */}
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-3 rounded-xl bg-card border border-border p-3 text-sm opacity-50 cursor-not-allowed"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <span>Add Location</span>
            <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
          </button>
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-3 rounded-xl bg-card border border-border p-3 text-sm opacity-50 cursor-not-allowed"
          >
            <Hash className="h-4 w-4 text-primary" />
            <span>Add Tags</span>
            <span className="ml-auto text-xs text-muted-foreground">Coming soon</span>
          </button>
          <div className="flex w-full items-start gap-3 rounded-xl bg-card border border-border p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Mark as sensitive content</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Adult, graphic, or otherwise mature material. Viewers can choose how this is shown.
              </p>
            </div>
            <Switch
              checked={isSensitive}
              onCheckedChange={setIsSensitive}
              aria-label="Mark as sensitive content"
            />
          </div>
        </div>

        <SensitivePreviewSection
          isSensitive={isSensitive}
          postType={postType}
          caption={caption}
        />

        <Button 
          type="submit"
          disabled={isSubmitting || !caption.trim()}
          className="w-full bg-gradient-red hover:opacity-90 glow text-sm font-semibold h-12 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            postType === "text" ? "Post" : "Share Post"
          )}
        </Button>
      </form>
    </>
  );
};

export default Create;
