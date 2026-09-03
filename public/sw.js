/* Service worker: keeps the shell installed and offers the last digest offline.
   The digest itself is always network-first, so a cached copy is only ever a
   fallback — the app never quietly serves yesterday's news as if it were new. */

const SHELL = 'dd-shell-v3';
const DATA = 'dd-data-v3';

const SHELL_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache third-party requests (article thumbnails live on other hosts).
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  /*
   * Shell: network-first, cache as the fallback.
   *
   * This used to be cache-first, which meant a changed index.html or app.js was
   * never seen again once cached — the app silently froze at whatever version
   * first installed. Freshness matters more than the few milliseconds saved,
   * and the cache still covers being offline.
   */
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

/* ---------------- Morning briefing push ---------------- */

/*
 * The server sends a push with no payload. This wakes the worker, which then
 * fetches the live briefing headline — so the notification always shows what is
 * actually leading this morning, not what was leading when the push was queued.
 */
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let title = 'Your morning briefing';
      let body = "Today's news, ready to read.";

      try {
        const res = await fetch('/api/brief/notification', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.title) title = data.title;
          if (data.body) body = data.body;
        }
      } catch {
        // Offline: the generic text above still gets the notification through.
      }

      await self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-120.png',
        tag: 'daily-brief',
        renotify: true,
        data: { url: '/#/brief' }
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/#/brief';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

/*
 * If the push service rotates a subscription out from under us, re-subscribe
 * with the same key so the morning briefing keeps arriving.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/api/push/key');
        const { publicKey } = await res.json();
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyToBytes(publicKey)
        });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() })
        });
      } catch {
        // Nothing useful to do here; the user can re-enable from the app.
      }
    })()
  );
});

/** base64url VAPID key -> bytes, the form every browser accepts. */
function keyToBytes(base64url) {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
