import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StarRating from "./StarRating";

interface Review {
  id: string;
  stars: number;
  review: string | null;
  created_at: string;
  rater_id: string;
  rater?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

interface ReviewsListProps {
  rateeId: string;
  refreshKey?: number;
}

const ReviewsList = ({ rateeId, refreshKey = 0 }: ReviewsListProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      // 1) ratings
      const { data: rows, error } = await supabase
        .from("ratings")
        .select("id, stars, review, created_at, rater_id")
        .eq("ratee_id", rateeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error || !rows) {
        if (active) {
          setReviews([]);
          setLoading(false);
        }
        return;
      }
      // 2) batch fetch rater profiles
      const raterIds = Array.from(new Set(rows.map((r) => r.rater_id)));
      const profilesMap = new Map<string, Review["rater"]>();
      if (raterIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", raterIds);
        profs?.forEach((p) =>
          profilesMap.set(p.user_id, {
            display_name: p.display_name,
            username: p.username,
            avatar_url: p.avatar_url,
          }),
        );
      }
      const merged = rows.map((r) => ({ ...r, rater: profilesMap.get(r.rater_id) ?? null }));
      if (active) {
        setReviews(merged);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [rateeId, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No reviews yet — be the first to leave one.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {reviews.map((r) => {
        const name = r.rater?.display_name || r.rater?.username || "Anonymous";
        return (
          <li
            key={r.id}
            className="rounded-xl border border-border bg-card p-3 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              {r.rater?.avatar_url ? (
                <img
                  src={r.rater.avatar_url}
                  alt={name}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </div>
              <StarRating value={r.stars} size="sm" showCount={false} />
            </div>
            {r.review && (
              <p className="text-sm text-foreground/90 leading-snug">{r.review}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default ReviewsList;
