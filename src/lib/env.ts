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

export const validateRuntimeEnv = () => {
  if (typeof window === "undefined") return;
  const origin = window.location.origin;
  if (!VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS.includes(origin)) {
    throw new Error(
      `Unauthorized client origin: ${origin}. Add this origin to VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS in your environment configuration.`,
    );
  }
};

export const isValidOAuthRedirect = (redirectUrl: string) => {
  try {
    const url = new URL(redirectUrl);
    return VITE_OAUTH_REDIRECT_ALLOWED_ORIGINS.includes(url.origin);
  } catch {
    return false;
  }
};
