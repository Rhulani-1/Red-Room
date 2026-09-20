import { AlertTriangle, EyeOff, Eye, Ban, ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState, useCallback, useId, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { SensitivePref } from "@/hooks/useSensitivePref";

interface SensitivePreviewProps {
  pref: SensitivePref;
  isSensitive: boolean;
  postType: "media" | "text";
  caption: string;
  hasMedia?: boolean;
}

const PrefIcon = ({ pref }: { pref: SensitivePref }) => {
  if (pref === "hide") return <Ban className="h-3.5 w-3.5" />;
  if (pref === "blur") return <EyeOff className="h-3.5 w-3.5" />;
  return <Eye className="h-3.5 w-3.5" />;
};

const labels: Record<SensitivePref, string> = {
  hide: "Hide",
  blur: "Blur",
  show: "Show",
};

const descriptions: Record<SensitivePref, string> = {
  hide: "Post is removed from feed",
  blur: "Content blurred until tapped",
  show: "Content shown with warning",
};

const SensitivePreview = ({ pref, isSensitive, postType, caption, hasMedia }: SensitivePreviewProps) => {
  // Hide mode: post not rendered
  if (isSensitive && pref === "hide") {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
        <Ban className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-sm font-semibold text-foreground">Post hidden from feed</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Viewers with "Hide" preference won't see this post.
        </p>
      </div>
    );
  }

  const blurred = isSensitive && pref === "blur";
  const showWarning = isSensitive && pref === "show";

  return (
    <article className="rounded-2xl card-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-ember p-[2px]">
            <div className="h-full w-full rounded-[10px] border border-background bg-secondary" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">you</p>
            <p className="text-[10px] text-muted-foreground">just now</p>
          </div>
        </div>
        {isSensitive && showWarning && (
          <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[9px] font-bold text-amber-400 uppercase tracking-widest">
            <AlertTriangle className="h-3 w-3" /> Sensitive
          </span>
        )}
      </div>

      {/* Body */}
      {postType === "media" ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
          <div
            className={cn(
              "h-full w-full bg-gradient-to-br from-primary/20 via-secondary to-card flex items-center justify-center transition-all",
              blurred && "blur-2xl scale-110"
            )}
          >
            {!hasMedia && (
              <p className="text-xs text-muted-foreground">[ media preview ]</p>
            )}
          </div>
          {blurred && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm text-center px-6">
              <div className="rounded-full bg-card/80 p-2.5 ring-1 ring-border">
                <EyeOff className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold">Sensitive content</p>
              <button className="rounded-full bg-gradient-red px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                Tap to view
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative px-4 pb-4 min-h-[80px]">
          <p className={cn(
            "text-[15px] leading-relaxed text-foreground whitespace-pre-wrap",
            blurred && "blur-md select-none"
          )}>
            {caption || <span className="text-muted-foreground italic">Your text post will appear here…</span>}
          </p>
          {blurred && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-sm">
              <p className="text-xs font-semibold">Sensitive content</p>
              <button className="rounded-full bg-gradient-red px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                Tap to view
              </button>
            </div>
          )}
        </div>
      )}

      {postType === "media" && caption && !blurred && (
        <div className="px-4 pt-2 pb-3">
          <p className="text-sm">
            <span className="font-semibold">you</span>{" "}
            <span className="text-muted-foreground">{caption}</span>
          </p>
        </div>
      )}
    </article>
  );
};

const SensitivePreviewSection = ({
  isSensitive,
  postType,
  caption,
}: {
  isSensitive: boolean;
  postType: "media" | "text";
  caption: string;
}) => {
  const prefs: SensitivePref[] = ["hide", "blur", "show"];
  const [activeIdx, setActiveIdx] = useState(0);
  const [announcedIdx, setAnnouncedIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const headingId = useId();

  const focusSlide = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(prefs.length - 1, idx));
    setActiveIdx(clamped);
    const el = slideRefs.current[clamped];
    if (el) {
      el.focus({ preventScroll: false });
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [prefs.length]);

  // Sync activeIdx with native scroll/swipe position on mobile
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let rafId = 0;
    let touchStartX = 0;
    let touchStartScroll = 0;
    let isTouching = false;

    const computeActive = () => {
      const slides = slideRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!slides.length) return;
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      slides.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const c = r.left + r.width / 2;
        const d = Math.abs(c - center);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      setActiveIdx((prev) => (prev === bestIdx ? prev : bestIdx));
    };

    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(computeActive);
    };

    const onTouchStart = (e: TouchEvent) => {
      isTouching = true;
      touchStartX = e.touches[0]?.clientX ?? 0;
      touchStartScroll = track.scrollLeft;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTouching) return;
      isTouching = false;
      const endX = e.changedTouches[0]?.clientX ?? touchStartX;
      const dx = touchStartX - endX;
      const moved = Math.abs(track.scrollLeft - touchStartScroll);
      // Treat short flicks (<10px scroll) but quick swipes (>40px finger) as a slide change
      if (moved < 10 && Math.abs(dx) > 40) {
        const dir = dx > 0 ? 1 : -1;
        const next = Math.max(0, Math.min(prefs.length - 1, activeIdxRef.current + dir));
        const el = slideRefs.current[next];
        el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } else {
        // Let snap settle, then re-sync
        setTimeout(computeActive, 120);
      }
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("touchstart", onTouchStart, { passive: true });
    track.addEventListener("touchend", onTouchEnd, { passive: true });
    track.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("touchstart", onTouchStart);
      track.removeEventListener("touchend", onTouchEnd);
      track.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [prefs.length]);

  // Keep a live ref to activeIdx for use inside touch handlers without re-binding listeners
  const activeIdxRef = useRef(0);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  // Debounce announcer updates so screen readers only speak the final settled slide
  // (avoids interrupting itself mid-swipe as activeIdx flickers across slides).
  useEffect(() => {
    const t = setTimeout(() => setAnnouncedIdx(activeIdx), 180);
    return () => clearTimeout(t);
  }, [activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, idx: number) => {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusSlide(idx + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusSlide(idx - 1);
        break;
      case "Home":
        e.preventDefault();
        focusSlide(0);
        break;
      case "End":
        e.preventDefault();
        focusSlide(prefs.length - 1);
        break;
    }
  };

  return (
    <section className="space-y-3 pt-2" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-sm sm:text-base font-bold tracking-tight">Viewer preview</h3>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest" aria-hidden="true">
          {isSensitive ? "Sensitive on" : "Standard"}
        </span>
      </div>
      <p className="text-[11px] sm:text-xs text-muted-foreground -mt-1">
        How your post appears to viewers based on their content preference.
        <span className="sr-only"> Use the left and right arrow keys to navigate between previews.</span>
      </p>

      {/* Mobile carousel controls */}
      <div className="flex items-center justify-between sm:hidden" role="group" aria-label="Preview navigation">
        <button
          type="button"
          onClick={() => focusSlide(activeIdx - 1)}
          disabled={activeIdx === 0}
          aria-label="Previous preview"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-opacity disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Viewer preference">
          {prefs.map((p, i) => (
            <button
              key={p}
              role="tab"
              type="button"
              aria-selected={activeIdx === i}
              aria-controls={`${headingId}-slide-${i}`}
              aria-label={`Show ${labels[p]} preview`}
              onClick={() => focusSlide(i)}
              className={cnDot(activeIdx === i)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => focusSlide(activeIdx + 1)}
          disabled={activeIdx === prefs.length - 1}
          aria-label="Next preview"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-opacity disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Viewer preview previews"
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-1 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {prefs.map((p, i) => (
          <div
            key={p}
            ref={(el) => { slideRefs.current[i] = el; }}
            id={`${headingId}-slide-${i}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${prefs.length}: ${labels[p]} — ${descriptions[p]}`}
            tabIndex={i === activeIdx ? 0 : -1}
            onFocus={() => setActiveIdx(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="w-[85%] shrink-0 snap-start space-y-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:shrink"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground">
                <PrefIcon pref={p} />
                {labels[p]}
              </span>
              <span className="text-[10px] text-muted-foreground">{descriptions[p]}</span>
            </div>
            <SensitivePreview
              pref={p}
              isSensitive={isSensitive}
              postType={postType}
              caption={caption}
            />
          </div>
        ))}
      </div>

      {/* Live announcer */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Showing {labels[prefs[announcedIdx]]} preview, {announcedIdx + 1} of {prefs.length}. {descriptions[prefs[announcedIdx]]}.
      </div>
    </section>
  );
};

const cnDot = (active: boolean) =>
  [
    "h-2 rounded-full transition-all",
    active ? "w-5 bg-primary" : "w-2 bg-muted-foreground/40",
  ].join(" ");

export default SensitivePreviewSection;
