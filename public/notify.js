/* Morning-briefing push notifications.
 *
 * Requires a secure context (https, or localhost) and — on iPhone and iPad —
 * that the app has been added to the Home Screen first. Safari refuses both the
 * service worker and the Push API otherwise, so the toggle explains that rather
 * than failing silently.
 */

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

export function pushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  );
}

export function isStandalone() {
  return window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

function isApple() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Why push is unavailable, phrased as something the reader can act on. */
export function unavailableReason() {
  if (!window.isSecureContext) {
    return 'Notifications need a secure (https) connection. Over plain http on your home network, Safari blocks them — the README explains how to get https in a minute.';
  }
  if (isApple() && !isStandalone()) {
    return 'On iPhone and iPad, add Daily Digest to your Home Screen first (Share → Add to Home Screen), then open it from there and try again.';
  }
  if (!('PushManager' in window)) {
    return 'This browser does not support push notifications.';
  }
  return 'Push notifications are unavailable here. If this is a preview or embedded browser, open the app in Safari or Chrome directly.';
}

/**
 * The active service worker registration, or null.
 *
 * Deliberately not `navigator.serviceWorker.ready` on its own: that promise
 * never settles when registration failed (plain http on a LAN address, for
 * instance), which would hang the notification button forever with no
 * feedback. Check for a registration first, then race `ready` against a short
 * timeout so a slow activation cannot block either.
 */
export async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return null;
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(reg), 3000))
    ]);
  } catch {
    return null;
  }
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function isEnabled() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  return Boolean(await currentSubscription());
}

export async function enable() {
  const reg = await registration();
  // unavailableReason() already distinguishes insecure origins, iOS apps that
  // have not been added to the Home Screen, and browsers that block workers.
  if (!reg) throw new Error(unavailableReason());

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked for this app in your browser settings.');
  }

  const res = await fetch('/api/push/key');
  if (!res.ok) throw new Error('The server did not hand out a notification key.');
  const { publicKey, schedule } = await res.json();

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyToBytes(publicKey)
  });

  const saved = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
  if (!saved.ok) {
    await subscription.unsubscribe().catch(() => {});
    throw new Error('The server would not store the subscription.');
  }

  return schedule;
}

/**
 * Re-assert this device's subscription with the server.
 *
 * Hosts routinely reset the filesystem on redeploy, which would drop the
 * server's list of subscribers and silently stop the morning briefing. The
 * browser still holds the real subscription, so re-sending it whenever the app
 * opens repairs the server's list without the reader noticing — provided the
 * VAPID keys themselves stayed stable, which is what the deploy notes are for.
 */
export async function resync() {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function disable() {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  }).catch(() => {});
  await subscription.unsubscribe();
  return true;
}
