/**
 * Error monitoring. Entirely optional: with no VITE_SENTRY_DSN set, none of this
 * runs and the Sentry bundle is never downloaded (it's behind a dynamic import).
 *
 * This exists because the app once served a blank white page to every visitor and
 * nothing anywhere reported it — it was only discoverable by opening the site and
 * looking. Any crash of that kind should page someone, not wait to be noticed.
 */

type SentryModule = typeof import("@sentry/react");

let sentry: SentryModule | null = null;

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/**
 * A Sentry DSN must end in /<projectId>. Without it Sentry logs "Invalid Sentry Dsn"
 * to the console and quietly disables itself — so monitoring looks configured while
 * reporting nothing, which is worse than being obviously off. Check it up front.
 */
const DSN_SHAPE = /^https:\/\/[0-9a-f]+@[^/]+\/\d+$/;

export const isMonitoringEnabled = () => {
  const v = dsn?.trim();
  if (!v) return false;
  if (!DSN_SHAPE.test(v)) {
    console.warn(
      "VITE_SENTRY_DSN is malformed, so crash reporting is OFF. A DSN must end " +
        "with /<projectId>, e.g. https://abc123@o12345.ingest.us.sentry.io/678910 " +
        "— copy the full value from Sentry > Settings > Client Keys (DSN).",
    );
    return false;
  }
  return true;
};

/**
 * Loads and starts Sentry. Safe to call when disabled — it resolves immediately.
 * Never throws: monitoring failing must not take the app down with it.
 */
export const initMonitoring = async (): Promise<void> => {
  if (!isMonitoringEnabled() || sentry) return;

  try {
    const mod = await import("@sentry/react");
    mod.init({
      dsn,
      environment: import.meta.env.MODE,
      // Traces are sampled low: this is for catching crashes, not performance work,
      // and the free tier is easy to exhaust.
      tracesSampleRate: 0.1,
      // Don't send user IP or headers we don't need.
      sendDefaultPii: false,
      beforeSend(event) {
        // Strip anything that could carry a token. Supabase puts access tokens in
        // URL fragments during sign-in, and those must never reach a third party.
        if (event.request?.url) {
          event.request.url = event.request.url.split("#")[0];
        }
        return event;
      },
    });
    sentry = mod;
  } catch (error) {
    console.warn("Error monitoring failed to start (continuing without it):", error);
  }
};

/** Report a caught error. No-op when monitoring is disabled. */
export const reportError = (error: unknown, context?: Record<string, unknown>) => {
  if (!sentry) return;
  try {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    /* reporting must never throw into the caller */
  }
};

/** Associate errors with a user, so a crash can be traced to a report. */
export const setMonitoringUser = (userId: string | null) => {
  if (!sentry) return;
  try {
    sentry.setUser(userId ? { id: userId } : null);
  } catch {
    /* non-fatal */
  }
};
