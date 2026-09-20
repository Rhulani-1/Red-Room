import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  count?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { star: "h-3 w-3", text: "text-[11px]" },
  md: { star: "h-4 w-4", text: "text-sm" },
  lg: { star: "h-5 w-5", text: "text-base" },
};

const StarRating = ({
  value,
  count,
  size = "sm",
  showCount = true,
  className,
}: StarRatingProps) => {
  const s = sizeMap[size];
  const rounded = Math.round(value * 10) / 10;
  const full = Math.floor(rounded);
  const hasHalf = rounded - full >= 0.5;

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = i < full;
          const half = !filled && i === full && hasHalf;
          return (
            <span key={i} className="relative inline-block">
              <Star
                className={cn(
                  s.star,
                  filled ? "fill-primary text-primary" : "text-muted-foreground/40",
                )}
              />
              {half && (
                <Star
                  className={cn(
                    s.star,
                    "absolute inset-0 fill-primary text-primary",
                  )}
                  style={{ clipPath: "inset(0 50% 0 0)" }}
                />
              )}
            </span>
          );
        })}
      </div>
      {showCount && (
        <span className={cn("font-semibold", s.text)}>
          {rounded.toFixed(1)}
          {typeof count === "number" && (
            <span className="ml-1 text-muted-foreground font-normal">
              ({count})
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export default StarRating;
