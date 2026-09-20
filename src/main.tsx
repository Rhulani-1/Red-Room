import { createRoot } from "react-dom/client";
import "./index.css";

/**
 * Renders a readable failure page instead of a blank white screen.
 *
 * `src/lib/env.ts` throws at module scope when a required variable is missing or the
 * origin isn't allow-listed. That happens during import, before React mounts, so no
 * ErrorBoundary can catch it — the entire app silently rendered nothing. A missing
 * variable took the whole site down with no visible symptom and nothing in the UI to
 * explain it. Booting through dynamic imports lets us catch that and say what's wrong.
 */
const renderFatal = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const root = document.getElementById("root");
  if (!root) return;

  const isConfig = /Missing required env variable|Unauthorized client origin/i.test(message);

  root.innerHTML = `
    <div role="alert" style="
      min-height:100dvh;display:flex;align-items:center;justify-content:center;
      padding:24px;background:#0b0b0d;color:#ededf2;
      font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;">
      <div style="max-width:34rem">
        <h1 style="margin:0 0 12px;font-size:1.25rem;font-weight:700">
          ${isConfig ? "The app isn&rsquo;t configured correctly" : "The app failed to start"}
        </h1>
        <p style="margin:0 0 16px;color:#b4b4c2;line-height:1.6">
          ${
            isConfig
              ? "A required setting is missing or wrong, so the app stopped before it could load."
              : "Something went wrong while loading the app."
          }
        </p>
        <pre style="
          margin:0;padding:12px 14px;border-radius:8px;background:#16161c;
          border:1px solid #272730;color:#ff9a8a;white-space:pre-wrap;word-break:break-word;
          font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.8rem">${
            message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)
          }</pre>
      </div>
    </div>`;
};

const boot = async () => {
  // Start monitoring first so a startup failure is itself reported. No-op unless
  // VITE_SENTRY_DSN is set, and it never throws.
  const { initMonitoring, reportError } = await import("@/lib/monitoring");
  await initMonitoring();

  try {
    const { validateRuntimeEnv } = await import("@/lib/env");
    validateRuntimeEnv();

    const { default: App } = await import("./App.tsx");
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (error) {
    console.error("Startup failed:", error);
    reportError(error, { phase: "startup" });
    renderFatal(error);
  }
};

void boot();

// Register a minimal service worker ONLY on the live deployed site so the
// browser can fire `beforeinstallprompt` (Add to Home Screen / Install app).
// We must never register inside the Lovable editor preview iframe — service
// workers there cache stale HTML and break hot-reload.
(() => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isLovablePreview =
    host.includes("lovableproject.com") ||
    host.includes("id-preview--") ||
    host.includes("lovable.app") && host.includes("preview");

  if (inIframe || isLovablePreview) {
    // Clean up any SW that may have been registered previously in preview.
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* non-fatal */
    });
  });
})();
