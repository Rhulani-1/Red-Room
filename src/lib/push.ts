import { supabase } from "@/integrations/supabase/client";

/**
 * Web push subscription management.
 *
 * Optional, like the other integrations: with no VITE_VAPID_PUBLIC_KEY set,
 * `isPushConfigured()` is false and the UI hides the option entirely rather than
 * offering a switch that can't work.
 *
 * Requires the `push_subscriptions` table (see
 * supabase/migrations/20260701_001_push_subscriptions.sql) to be applied.
 */

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const isPushConfigured = () => Boolean(publicKey && publicKey.trim());

/** Push needs all three; Safari only gained support in the installed PWA. */
export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export type PushStatus = "unsupported" | "unconfigured" | "denied" | "off" | "on";

/** Base64url VAPID key -> Uint8Array, the format PushManager requires. */
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
};

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
};

export const getPushStatus = async (): Promise<PushStatus> => {
  if (!isPushSupported()) return "unsupported";
  if (!isPushConfigured()) return "unconfigured";
  if (Notification.permission === "denied") return "denied";

  const reg = await getRegistration();
  if (!reg) return "off";
  const existing = await reg.pushManager.getSubscription();
  return existing ? "on" : "off";
};

/**
 * Ask permission, subscribe, and store the subscription against this user.
 * Returns the resulting status so callers can render the real state rather than
 * assuming success.
 */
export const enablePush = async (): Promise<PushStatus> => {
  if (!isPushSupported()) return "unsupported";
  if (!isPushConfigured()) return "unconfigured";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = await getRegistration();
  if (!reg) return "off";

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey as string),
    }));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "off";

  const json = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  // Keyed on endpoint so re-subscribing the same device updates rather than
  // creating duplicates that would each receive the same notification.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("Could not save push subscription:", error);
    // Don't leave a browser subscription we can't send to.
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error(error.message);
  }

  return "on";
};

/** Unsubscribe this device and remove it from the database. */
export const disablePush = async (): Promise<PushStatus> => {
  const reg = await getRegistration();
  if (!reg) return "off";

  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return "off";

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) console.error("Could not remove push subscription:", error);

  return "off";
};
