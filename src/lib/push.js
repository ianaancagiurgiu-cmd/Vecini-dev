import { supabase } from './supabaseClient.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64) {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ reports itself as a Mac; the touch points give it away.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** True when launched from the home screen rather than a browser tab. */
export const isStandalone = () =>
  window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

/**
 * Why push can't be enabled right now, or null if it can.
 *  'unsupported'  — browser has no push at all
 *  'ios-install'  — iPhone/iPad, but not yet added to the home screen
 *  'no-key'       — VITE_VAPID_PUBLIC_KEY missing from the build
 *  'denied'       — user previously blocked notifications
 */
export function pushBlockedReason() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // On iOS this is what a plain Safari tab looks like, so name the real fix.
    return isIOS() && !isStandalone() ? 'ios-install' : 'unsupported';
  }
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!VAPID_PUBLIC_KEY) return 'no-key';
  if (Notification.permission === 'denied') return 'denied';
  return null;
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function storeSubscription(userId, sub) {
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

/** Ask permission, subscribe, persist. Returns null on success or a reason string. */
export async function enablePush(userId) {
  const blocked = pushBlockedReason();
  if (blocked) return blocked;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'dismissed';

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // A subscription made with a different VAPID key can never be delivered to.
    const current = new Uint8Array(sub.options.applicationServerKey || []);
    const wanted = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const matches = current.length === wanted.length && current.every((b, i) => b === wanted[i]);
    if (!matches) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await storeSubscription(userId, sub);
  return null;
}

export async function disablePush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Re-sync on app start: if the browser still holds a subscription, make sure the
 * server knows about it. Covers cleared server rows and Chrome's key rotation.
 */
export async function resyncPush(userId) {
  if (!userId || pushBlockedReason()) return;
  if (Notification.permission !== 'granted') return;
  try {
    const reg = await getRegistration();
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await storeSubscription(userId, sub);
    else await enablePush(userId);
  } catch {
    // Never let a push hiccup break app startup.
  }
}
