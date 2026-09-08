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
