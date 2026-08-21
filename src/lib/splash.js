/*
  Taking down the waiting screen in index.html.

  Deliberately not "when React mounts". Mounting only means the bundle arrived;
  AppLayout still returns null three more times after that, while the session is
  checked, then the membership, then the community's first load. Hiding on mount
  would swap the snail for a blank screen, which is the bug this is meant to fix.

  So the caller decides when there is something real to look at, and the fade is
  left to CSS. Removing the node afterwards keeps it out of the way of taps.
*/
export function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || el.classList.contains('is-done')) return;
  el.classList.add('is-done');
  el.addEventListener('transitionend', () => el.remove(), { once: true });
  // A tab in the background fires no transitions, so the node would linger.
  setTimeout(() => el.remove(), 1200);
}
