// Service worker: PWA installability + push notifications.
// Intentionally does NOT cache responses — every request passes through to the
// network. Caching here previously broke hot-reload and can serve a stale app.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Required for installability: a fetch handler must exist.
  // Pass-through, no caching.
  event.respondWith(fetch(event.request));
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

/** Falls back safely if a push arrives with no payload or malformed JSON. */
const readPayload = (event) => {
  const fallback = {
    title: "RED RXXM",
    body: "You have a new notification.",
    url: "/",
  };
  if (!event.data) return fallback;
  try {
    const parsed = event.data.json();
    return {
      title: parsed.title || fallback.title,
      body: parsed.body || fallback.body,
      url: parsed.url || fallback.url,
      tag: parsed.tag,
    };
  } catch {
    return { ...fallback, body: event.data.text() || fallback.body };
  }
};

self.addEventListener("push", (event) => {
  const payload = readPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag replaces an earlier notification rather than stacking duplicates.
      tag: payload.tag || "redrxxm",
      renotify: Boolean(payload.tag),
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an existing tab and navigate it, rather than opening duplicates.
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              /* cross-origin or unsupported — focusing is enough */
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});

// Browsers rotate subscriptions periodically. Without this the device silently
// stops receiving notifications and nobody notices.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      clients.forEach((client) =>
        client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED" }),
      );
    })(),
  );
});
