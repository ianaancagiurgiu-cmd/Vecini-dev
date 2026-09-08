// Some mobile browsers (notably in-app webviews) report a viewport height that
// is taller than the area you can actually see, which makes 100dvh/100vh lay
// the app shell out too tall — the page itself then scrolls and the bottom nav
// drifts up into the middle of the screen.
//
// So we measure the real visible height ourselves and publish it as --app-h.
export function installViewportHeightFix() {
  const set = () => {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');

    /*
      Tapping a field, iOS pans the visual viewport toward it instead of
      resizing it — a compositor-level shift that `overflow: hidden` does
      nothing to stop. The line above already shrinks the shell to fit
      entirely above the keyboard, so that pan only ever works against it: it
      slides the visible window down past the shell's own, already-correct
      bottom edge, and what shows through there is nothing but bare page
      background — the gap between the field and the keyboard that this
      whole function exists to prevent.

      `interactive-widget=resizes-content` on the viewport meta tag asks a
      modern browser not to do this at all; where that lands, offsetTop stays
      0 and the lines below are a no-op. Where it does not — older Safari,
      chiefly — the pan still happens, so the shell is nudged back by exactly
      as much as the viewport panned, putting the two in step again.

      A plain `top`/`left` shift on a relatively positioned body, not a
      transform: a `transform` on an ancestor becomes the containing block for
      any `position: fixed` descendant, and the bottom nav is fixed on purpose
      — precisely so it cannot drift if some ancestor's box ever disagrees
      with the real viewport, which is exactly the situation being corrected
      here. `position: relative` carries no such side effect.
    */
    if (vv) {
      document.body.style.position = 'relative';
      document.body.style.top = `${-vv.offsetTop}px`;
      document.body.style.left = `${-vv.offsetLeft}px`;
    }
  };

  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', set);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', set);
    window.visualViewport.addEventListener('scroll', set);
  }
  // Address-bar show/hide sometimes settles a moment after load.
  window.addEventListener('load', () => setTimeout(set, 120));
}
