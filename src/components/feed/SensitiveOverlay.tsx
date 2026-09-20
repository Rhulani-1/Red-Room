import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SensitiveOverlayProps {
  onReveal: () => void;
  onAlwaysShow?: () => void;
  className?: string;
  compact?: boolean;
}

const SensitiveOverlay = ({ onReveal, onAlwaysShow, className, compact }: SensitiveOverlayProps) => {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm text-center px-6",
        className
      )}
    >
      <div className="rounded-full bg-card/80 p-3 ring-1 ring-border">
        <EyeOff className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sensitive content</p>
      {!compact && (
        <p className="text-xs text-muted-foreground max-w-[240px]">
          This post may contain mature or graphic material.
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReveal();
          }}
          className="rounded-full bg-gradient-red px-4 py-1.5 text-xs font-semibold text-primary-foreground glow"
        >
          Tap to view
        </button>
        {onAlwaysShow && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAlwaysShow();
            }}
            className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Always show
          </button>
        )}
      </div>
    </div>
  );
};

export default SensitiveOverlay;
