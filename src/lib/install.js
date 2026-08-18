import { isIOS, isStandalone } from './push.js';

/*
  Deciding when to suggest installing the app, and when to shut up about it.

  Two different worlds:
   - Android and desktop Chrome fire `beforeinstallprompt`, which lets us offer a
     real one-tap install button.
   - iOS fires nothing and offers no API at all, so the only thing that works is
     telling people where the Share button is. It matters more there, too: on
     iPhone, push notifications simply do not arrive until the app has been
     added to the home screen.

  Anything asked repeatedly becomes noise, so each prompt is snoozed after a
  dismissal and given up on entirely after a few refusals.
*/

const KEY = 'vecini.onboarding.v1';
const SNOOZE_DAYS = 7;
const MAX_ASKS = 3;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function write(patch) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  } catch (e) {
    // Private browsing can refuse storage. Worst case we ask again next time.
  }
}

/** `what` is 'install' or 'push'. */
export function snooze(what) {
  const state = read();
  const count = (state[`${what}Count`] || 0) + 1;
  write({
    [`${what}Count`]: count,
    [`${what}Until`]: Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000,
  });
}

/** Stop asking for good, once they have done it or clearly do not want it. */
export function silence(what) {
  write({ [`${what}Count`]: MAX_ASKS, [`${what}Until`]: Number.MAX_SAFE_INTEGER });
}

function allowedToAsk(what) {
  const state = read();
  if ((state[`${what}Count`] || 0) >= MAX_ASKS) return false;
  return Date.now() >= (state[`${what}Until`] || 0);
}

/*
  Chrome fires this once, early, and only offers the install prompt if we keep
  the event. Registered at module load so it is not missed while React mounts.
*/
let deferredPrompt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    silence('install');
  });
}

export const hasNativeInstallPrompt = () => !!deferredPrompt;

/** Returns true if the app was actually installed. */
export async function runNativeInstall() {
  if (!deferredPrompt) return false;
  const evt = deferredPrompt;
  deferredPrompt = null;
  try {
    evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === 'accepted') {
      silence('install');
      return true;
    }
  } catch (e) {
    // Some browsers refuse a second call; nothing useful to do about it.
  }
  return false;
}

/**
 * Should we suggest installing?
 * 'ios'    — show the Share > Add to Home Screen steps
 * 'native' — show a one-tap install button
 * null     — already installed, can't install, or asked too often
 */
export function installPromptKind() {
  if (isStandalone()) return null;
  if (!allowedToAsk('install')) return null;
  if (isIOS()) return 'ios';
  return hasNativeInstallPrompt() ? 'native' : null;
}

export const canAskForPush = () => allowedToAsk('push');
