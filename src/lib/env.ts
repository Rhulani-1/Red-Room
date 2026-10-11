const requiredEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value;
};

export const VITE_SUPABASE_URL = requiredEnv("VITE_SUPABASE_URL");
export const VITE_SUPABASE_PUBLISHABLE_KEY = requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
export const VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS = requiredEnv("VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

/**
 * Warns when the app is served from an origin that isn't allow-listed.
 *
 * Deliberately a warning, not a throw. Throwing killed the entire app before React
 * mounted, which on a host like Vercel means every preview deployment — each one on
 * its own generated URL — is a dead page. That is a disproportionate response to a
 * configuration mismatch.
 *
 * The real control is isValidOAuthRedirect below, which stays strict: it is what
 * stops a sign-in being redirected to an origin you do not own. Supabase enforces
 * its own redirect allow-list server-side as well, so an unlisted origin here cannot
 * complete a sign-in regardless.
 */
export const validateRuntimeEnv = () => {
  if (typeof window === "undefined") return;
  const origin = window.location.origin;
  if (!VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS.some((entry) => originMatches(origin, entry))) {
    console.warn(
      `This origin (${origin}) is not in VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS. ` +
        `The app will run, but OAuth sign-in will be refused from here. ` +
        `Add it to that variable, and to Supabase > Authentication > URL Configuration.`,
    );
  }
};

/**
 * Matches an origin against one allow-list entry.
 *
 * Exact match unless the entry contains `*`, which stands for one or more
 * characters inside the host only. This exists because Vercel mints a new origin
 * for every deployment, so an exact list can never keep up — but the pattern must
 * stay narrow enough to be a real boundary. `https://*-myteam.vercel.app` is scoped
 * to one Vercel account; `https://*.vercel.app` would let anyone who can deploy
 * there receive a sign-in redirect, so keep the account suffix in the pattern.
 *
 * Deliberate restrictions: the scheme is never wildcarded, `*` cannot match a `/`
 * (so it can't reach into the path), and a bare `*` is refused outright.
 */
const originMatches = (origin: string, pattern: string): boolean => {
  if (!pattern.includes("*")) return origin === pattern;
  if (pattern === "*" || pattern === "https://*" || pattern === "http://*") return false;

  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[^/]+");

  return new RegExp(`^${escaped}$`).test(origin);
};

/**
 * The open-redirect guard. Loosen only through the wildcard rules above — an
 * attacker-controlled origin here means a sign-in token handed to the attacker.
 */
export const isValidOAuthRedirect = (redirectUrl: string) => {
  try {
    const url = new URL(redirectUrl);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      return false;
    }
    return VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS.some((entry) => originMatches(url.origin, entry));
  } catch {
    return false;
  }
};
