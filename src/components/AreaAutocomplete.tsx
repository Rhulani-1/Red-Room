import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { MapPin, X, Loader2 } from "lucide-react";
import { isGeocodingEnabled, searchPlaces } from "@/lib/geocoding";
import type { GeoPoint } from "@/lib/geo";

interface AreaAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Labels already present in your own data — always searched, token or not. */
  suggestions: string[];
  placeholder?: string;
  className?: string;
  /** Bias real place results toward the user's location. */
  proximity?: GeoPoint | null;
}

const SEARCH_DEBOUNCE_MS = 250;

const AreaAutocomplete = ({
  value,
  onChange,
  suggestions,
  placeholder = "Type a suburb or city...",
  className,
  proximity,
}: AreaAutocompleteProps) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [remote, setRemote] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const local = query
    ? suggestions.filter((s) => s.toLowerCase().includes(query))
    : suggestions;

  // Own data first (those are people you can actually find), then real places.
  const matches = Array.from(new Set([...local, ...remote])).slice(0, 8);

  // Real place lookup. Without a Mapbox token this effect does nothing and the
  // component behaves exactly as it did before.
  useEffect(() => {
    if (!isGeocodingEnabled() || query.length < 2) {
      setRemote([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchPlaces(value, {
        proximity,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setRemote(results.map((r) => r.label));
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, query, proximity]);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && matches[highlight]) {
      e.preventDefault();
      pick(matches[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="pl-9 pr-9 bg-secondary border-none h-9 rounded-lg text-sm"
      />
      {searching && !value.trim().length ? null : searching ? (
        <Loader2 className="absolute right-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-background/60"
          aria-label="Clear"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {open && matches.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          <ul className="max-h-60 overflow-y-auto py-1">
            {matches.map((m, i) => {
              const idx = m.toLowerCase().indexOf(query);
              const before = idx >= 0 && query ? m.slice(0, idx) : m;
              const match = idx >= 0 && query ? m.slice(idx, idx + query.length) : "";
              const after = idx >= 0 && query ? m.slice(idx + query.length) : "";
              return (
                <li key={m}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(m)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      i === highlight
                        ? "bg-primary/15 text-foreground"
                        : "text-foreground/90 hover:bg-secondary"
                    )}
                  >
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    {idx >= 0 && query ? (
                      <span className="truncate">
                        {before}
                        <span className="font-bold text-primary">{match}</span>
                        {after}
                      </span>
                    ) : (
                      <span className="truncate">{m}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AreaAutocomplete;
