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
  if (!VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS.includes(origin)) {
    console.warn(
      `This origin (${origin}) is not in VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS. ` +
        `The app will run, but OAuth sign-in will be refused from here. ` +
        `Add it to that variable, and to Supabase > Authentication > URL Configuration.`,
    );
  }
};

/** Strict, exact-origin match. Never loosen this: it is the open-redirect guard. */
export const isValidOAuthRedirect = (redirectUrl: string) => {
  try {
    const url = new URL(redirectUrl);
    return VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS.includes(url.origin);
  } catch {
    return false;
  }
};
