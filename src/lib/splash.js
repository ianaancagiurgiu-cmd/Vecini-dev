/*
  Taking down the waiting screen in index.html.

  Deliberately not "when React mounts". Mounting only means the bundle arrived;
  AppLayout still returns null three more times after that, while the session is
  checked, then the membership, then the community's first load. Hiding on mount
  would swap the snail for a blank screen, which is the bug this is meant to fix.

  So the caller decides when there is something real to look at, and the fade is
  left to CSS. Removing the node afterwards keeps it out of the way of taps.
*/

/*
  A loading screen that comes and goes inside a couple of hundred milliseconds
  is not read as "loading" — it is read as the screen glitching. On a warm cache
  that is exactly what happens, so once shown it stays for a moment even if the
  app is ready sooner. It costs a fraction of a second on the fastest loads and
  removes a flicker on all of them.
*/
const MIN_VISIBLE_MS = 500;

export function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || el.dataset.leaving === '1') return;
  el.dataset.leaving = '1';

  const go = () => {
    // The bar runs to the end first: the one moment it can honestly say 100%.
    el.classList.add('is-done');
    el.addEventListener('transitionend', (e) => {
      if (e.propertyName === 'opacity') el.remove();
    });
    // A tab in the background fires no transitions, so the node would linger.
    setTimeout(() => el.remove(), 1200);
  };

  // performance.now() is milliseconds since navigation started, which is as
  // close to "since the snail appeared" as makes any difference.
  const shownFor = performance.now();
  if (shownFor >= MIN_VISIBLE_MS) go();
  else setTimeout(go, MIN_VISIBLE_MS - shownFor);
}
