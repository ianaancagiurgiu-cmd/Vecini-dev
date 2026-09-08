/*
  How tall the app shell is.

  Some mobile browsers (notably in-app webviews) report a viewport height that
  is taller than the area you can actually see, which makes 100dvh/100vh lay
  the app shell out too tall — the page itself then scrolls and the bottom nav
  drifts up into the middle of the screen. So we measure the real visible
  height ourselves and publish it as --app-h.

  But the on-screen keyboard shrinks that same measurement, and there the shrink
  is not a fix — it is the bug. Reproduced locally at Iana's exact numbers
  (window 797, visible 394): the shell shrinks to 394 while the keyboard covers
  everything below it anyway, so all the shrink achieves is to clip the screen's
  content at 394 and leave a dead strip under it with nothing in it. That strip
  is the "blank space above the keyboard".

  The address bar and the keyboard both shrink the visible height, so the
  measurement alone cannot tell them apart — but a focused text field can. So
  while someone is typing, the last height measured before the keyboard opened
  is held, the shell stays as tall as the window, and the keyboard simply covers
  the bottom of it, as a keyboard should. keyboardScroll.js then brings the
  focused field up into the part that is still visible.
*/
let held = null;

const isField = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

export function installViewportHeightFix() {
  const root = document.documentElement.style;
  const apply = (px) => root.setProperty('--app-h', Math.round(px) + 'px');

  const set = () => {
    const vv = window.visualViewport;
    const measured = vv ? vv.height : window.innerHeight;

    // Typing: keep the pre-keyboard height rather than shrinking into a dead
    // strip. window.innerHeight is the fallback because, unlike the visual
    // viewport, iOS leaves it alone when the keyboard opens.
    if (isField(document.activeElement)) {
      const full = held ?? Math.max(measured, window.innerHeight);
      apply(full);
      /*
        And how much of that the keyboard is sitting on, published so the
        screen can grow itself that much more room at the bottom.

        Without it, a field on a short form cannot be lifted clear of the
        keyboard at all: there is no scrollable overflow to lift it into, so
        the sign-in password — the other case Iana reported — stays underneath
        it however carefully the sums are done. The room has to be made before
        anything can move into it.
      */
      root.setProperty('--kb-h', Math.max(0, Math.round(full - measured)) + 'px');
      return;
    }

    held = measured;
    apply(measured);
    root.setProperty('--kb-h', '0px');
  };

  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', set);
  window.addEventListener('focusin', set);
  // On the way out, the keyboard is still closing; re-measure once it has gone.
  window.addEventListener('focusout', () => { setTimeout(set, 350); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', set);
    window.visualViewport.addEventListener('scroll', set);
  }
  // Address-bar show/hide sometimes settles a moment after load.
  window.addEventListener('load', () => setTimeout(set, 120));
}
