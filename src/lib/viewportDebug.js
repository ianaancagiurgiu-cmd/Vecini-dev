/*
  TEMPORARY. Diagnosing the "blank gap above the keyboard" report.

  A first attempt at fixing this guessed at the sign of the compensation
  without a real iOS device to check it against, and made the gap worse — so
  this time, before writing any fix, we get the real numbers off Iana's own
  phone. A small readout, pinned to the very top of the screen so the keyboard
  can never cover it, showing exactly what the visual viewport is doing the
  moment the gap appears.

  Remove installViewportDebug() from main.jsx (and this file) once the real
  fix is confirmed working — this has no reason to ship to real users.
*/
/*
  Which build is on screen. Safari caches index.html independently of the
  installed app, so "I tested it and nothing changed" and "I tested the version
  from before the change" look identical from here — this tells them apart.
*/
const BUILD = 'kbd-4';

export function installViewportDebug() {
  const el = document.createElement('div');
  el.id = 'vp-debug';
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:rgba(20,10,0,.88)', 'color:#7fffb0',
    'font:11px/1.5 ui-monospace,Menlo,monospace',
    // Wraps rather than running off the edge: the first screenshots of this
    // had the numbers I most needed cut off the right-hand side.
    'padding:4px 8px', 'white-space:pre-wrap', 'pointer-events:none',
  ].join(';');
  document.body.appendChild(el);

  const line = (label, v) => `${label}=${v === undefined ? '—' : v}`;

  const paint = () => {
    const vv = window.visualViewport;
    const focused = document.activeElement;
    const tag = focused && focused !== document.body
      ? `${focused.tagName.toLowerCase()}${focused.id ? '#' + focused.id : ''}`
      : 'none';
    const rect = focused && focused !== document.body ? focused.getBoundingClientRect() : null;

    const scroller = document.querySelector('.phone__scroll');
    el.textContent = `build ${BUILD}\n` + [
      line('vv.h', vv ? Math.round(vv.height) : undefined),
      line('vv.top', vv ? Math.round(vv.offsetTop) : undefined),
      line('vv.left', vv ? Math.round(vv.offsetLeft) : undefined),
      line('win.h', window.innerHeight),
      line('scrY', window.scrollY),
      line('--app-h', getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()),
    ].join('  ') + '\n' + [
      line('focus', tag),
      line('field.bottom', rect ? Math.round(rect.bottom) : undefined),
      line('body.pos', getComputedStyle(document.body).position),
      line('scroll.top', scroller ? scroller.scrollTop : undefined),
    ].join('  ');
  };

  paint();
  window.addEventListener('resize', paint);
  window.addEventListener('scroll', paint, true);
  window.addEventListener('focusin', paint);
  window.addEventListener('focusout', paint);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', paint);
    window.visualViewport.addEventListener('scroll', paint);
  }
  setInterval(paint, 500); // catches whatever the events above miss
}
