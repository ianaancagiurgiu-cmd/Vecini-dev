/*
  An invitation code arrives before the account exists: someone taps a link or
  types a code, then has to sign up. The code has to survive that detour, so it
  is parked in localStorage and applied once they are signed in.
*/
const KEY = 'vecini.pendingInvite.v1';

export function savePendingInvite(code) {
  try {
    localStorage.setItem(KEY, (code || '').trim());
  } catch (e) {
    // Private browsing can refuse storage; the flow still works if they retype.
  }
}

export function readPendingInvite() {
  try {
    return (localStorage.getItem(KEY) || '').trim();
  } catch (e) {
    return '';
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* nothing to clean up */
  }
}

/** Shareable invite link, e.g. https://host/#/join/TEILOR-15 */
export function inviteLink(code) {
  return `${window.location.origin}/#/join/${encodeURIComponent((code || '').trim())}`;
}
