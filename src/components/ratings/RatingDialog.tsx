import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateeId: string;
  rateeName: string;
  meetupId?: string;
  targetType?: "user" | "meetup";
  onSubmitted?: () => void;
}

const reviewSchema = z.string().trim().max(1000, { message: "Max 1000 characters" });

const RatingDialog = ({
  open,
  onOpenChange,
  rateeId,
  rateeName,
  meetupId,
  targetType = "user",
  onSubmitted,
}: RatingDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState("");
  const [busy, setBusy] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) {
      setStars(0);
      setHover(0);
      setReview("");
      setEligible(null);
      return;
    }
    if (!user) {
      setEligible(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("can_rate", {
        _rater: user.id,
        _ratee: rateeId,
        _meetup_id: meetupId ?? null,
      });
      if (error) {
        setEligible(false);
        return;
      }
      setEligible(!!data);
    })();
  }, [open, user, rateeId, meetupId]);

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (stars < 1 || stars > 5) {
      toast({ title: "Pick a star rating", variant: "destructive" });
      return;
    }
    const parsed = reviewSchema.safeParse(review);
    if (!parsed.success) {
      toast({ title: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("ratings")
        .upsert(
          {
            rater_id: user.id,
            ratee_id: rateeId,
            meetup_id: meetupId ?? null,
            target_type: targetType,
            stars,
            review: parsed.data || null,
          },
          { onConflict: "rater_id,ratee_id,meetup_id" },
        );
      if (error) throw error;
      toast({
        title: "Rating submitted ⭐",
        description: `Thanks for rating ${rateeName}.`,
      });
      onSubmitted?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't save rating";
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {rateeName}</DialogTitle>
          <DialogDescription>
            Share your honest experience. You can edit your rating anytime.
          </DialogDescription>
        </DialogHeader>

        {eligible === false ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            You can only rate someone after a completed meetup, an active
            subscription, or a paid content unlock with them.
          </div>
        ) : eligible === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1 py-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (hover || stars) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setStars(n)}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "h-9 w-9 transition-colors",
                        active
                          ? "fill-primary text-primary"
                          : "text-muted-foreground/40",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Optional review — what stood out?"
              maxLength={1000}
              rows={4}
              className="resize-none"
            />
            <p className="text-[10px] text-right text-muted-foreground">
              {review.length}/1000
            </p>
          </>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy || !eligible || stars === 0}
            className="bg-gradient-red glow gap-1"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
