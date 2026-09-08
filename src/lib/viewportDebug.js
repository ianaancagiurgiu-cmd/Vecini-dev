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
export function installViewportDebug() {
  const el = document.createElement('div');
  el.id = 'vp-debug';
  el.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:rgba(20,10,0,.88)', 'color:#7fffb0',
    'font:11px/1.5 ui-monospace,Menlo,monospace',
    'padding:4px 8px', 'white-space:pre', 'pointer-events:none',
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

    el.textContent = [
      line('vv.h', vv ? Math.round(vv.height) : undefined),
      line('vv.top', vv ? Math.round(vv.offsetTop) : undefined),
      line('vv.left', vv ? Math.round(vv.offsetLeft) : undefined),
      line('win.h', window.innerHeight),
      line('scrY', window.scrollY),
      line('--app-h', getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim()),
    ].join('  ') + '\n' + [
      line('focus', tag),
      line('field.bottom', rect ? Math.round(rect.bottom) : undefined),
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
