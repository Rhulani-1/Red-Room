import type { GeoPoint } from "./geo";

/**
 * Place search and reverse geocoding via Mapbox.
 *
 * Optional by design: with no VITE_MAPBOX_TOKEN set, every function here returns
 * empty and callers fall back to their previous behaviour (suggesting only labels
 * already present in your own data). Nothing breaks without a token — the feature
 * is simply absent, which is why the app works today.
 */

const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

/** Optional ISO country code(s) to bias/limit results, e.g. "za". */
const country = (import.meta.env.VITE_GEOCODING_COUNTRY as string | undefined)?.trim();

const BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

/** Place-ish result types — we want suburbs and cities, not street addresses. */
const PLACE_TYPES = "place,locality,neighborhood,district,region";

export const isGeocodingEnabled = () => Boolean(token && token.trim());

export interface PlaceResult {
  /** Human-readable label, e.g. "Melville, Johannesburg". */
  label: string;
  coords: GeoPoint;
}

const buildUrl = (path: string, params: Record<string, string | undefined>) => {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("access_token", token as string);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  return url.toString();
};

interface MapboxFeature {
  place_name?: string;
  text?: string;
  center?: [number, number];
}

const toResults = (features: MapboxFeature[]): PlaceResult[] =>
  features
    .filter((f) => Array.isArray(f.center) && f.center.length === 2)
    .map((f) => ({
      label: f.place_name ?? f.text ?? "",
      coords: { longitude: f.center![0], latitude: f.center![1] },
    }))
    .filter((r) => r.label);

/**
 * Forward search: "melv" -> ["Melville, Johannesburg, South Africa", …].
 *
 * @param signal pass an AbortSignal so superseded keystrokes are cancelled rather
 *               than racing each other to set state.
 */
export const searchPlaces = async (
  query: string,
  opts: { proximity?: GeoPoint | null; signal?: AbortSignal; limit?: number } = {},
): Promise<PlaceResult[]> => {
  const q = query.trim();
  if (!isGeocodingEnabled() || q.length < 2) return [];

  try {
    const url = buildUrl(`${encodeURIComponent(q)}.json`, {
      types: PLACE_TYPES,
      limit: String(opts.limit ?? 6),
      country,
      // Bias results toward the user so "Rosebank" prefers the nearby one.
      proximity: opts.proximity
        ? `${opts.proximity.longitude},${opts.proximity.latitude}`
        : undefined,
    });

    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return toResults(data.features ?? []);
  } catch (error) {
    // An aborted request is the expected path while typing, not a failure.
    if (error instanceof DOMException && error.name === "AbortError") return [];
    console.warn("Place search failed:", error);
    return [];
  }
};

/** Reverse: coordinates -> the name of the place they're in. */
export const reverseGeocode = async (
  coords: GeoPoint,
  opts: { signal?: AbortSignal } = {},
): Promise<string | null> => {
  if (!isGeocodingEnabled()) return null;

  try {
    const url = buildUrl(`${coords.longitude},${coords.latitude}.json`, {
      types: PLACE_TYPES,
      limit: "1",
    });
    const res = await fetch(url, { signal: opts.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: MapboxFeature[] };
    return toResults(data.features ?? [])[0]?.label ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    console.warn("Reverse geocoding failed:", error);
    return null;
  }
};
