export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineKm = (a: GeoPoint, b: GeoPoint): number => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

export const getBrowserLocation = (): Promise<GeoPoint> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => reject(new Error(err.message || "Unable to fetch location")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
};

export const encodeMeetupLocation = (label: string, coords: GeoPoint | null): string => {
  const cleanLabel = label.trim();
  if (!coords) return cleanLabel;
  return `${cleanLabel}::${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
};

export const parseMeetupLocation = (
  raw: string | null,
): { label: string; coords: GeoPoint | null } => {
  if (!raw) return { label: "", coords: null };

  const [label, rawCoords] = raw.split("::");
  if (!rawCoords) return { label: label ?? "", coords: null };

  const [latRaw, lonRaw] = rawCoords.split(",");
  const latitude = Number(latRaw);
  const longitude = Number(lonRaw);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { label: label ?? raw, coords: null };
  }

  return {
    label: label ?? "",
    coords: { latitude, longitude },
  };
};
