/*
  Bringing a focused field up into the strip of screen the keyboard has not
  covered.

  viewport.js now leaves the shell at full window height while someone types, so
  the keyboard simply covers its lower half — which means the field they tapped
  can easily be underneath it, and something has to move it.

  scrollIntoView({ block: 'center' }) is not that something: it centres the
  field in the *scroll container*, which is now the full height of the window,
  so it lands halfway down a screen whose bottom half is keyboard. Measured at
  Iana's geometry, that put the field at 369–418 with the keyboard starting at
  394 — centred, and still half hidden.

  What the field has to be centred in is the visible strip, and the one thing
  iOS does report reliably is how tall that strip is: visualViewport.height. So
  the sums are done here against that, and the app's own scroll container is
  moved by the difference.

  Twice, at two different moments: the first pass is for the common case, the
  second lands after iOS has finished its own attempt and its keyboard
  animation, so ours has the last word.
*/
const isField = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');

// Enough room left above the field for its own label, and to clear a sticky
// screen header where there is one.
const ROOM_ABOVE = 76;

function scroller(from) {
  for (let el = from.parentElement; el; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

export function installKeyboardScrollLock() {
  document.addEventListener('focusin', (e) => {
    if (!isField(e.target)) return;

    const reveal = () => {
      // Still the same field? Moving straight on to the next one must not drag
      // the screen back to the one just left.
      if (document.activeElement !== e.target) return;
      const box = scroller(e.target);
      if (!box) return;

      const strip = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const r = e.target.getBoundingClientRect();
      // Centred in the strip, but never so high that the label above it goes
      // under the header.
      const target = Math.max(ROOM_ABOVE, (strip - r.height) / 2);
      const delta = r.top - target;
      if (Math.abs(delta) < 2) return;

      // Assigned rather than scrollTo({behavior}): the container sets
      // scroll-behavior: smooth, and a smooth scroll overlapping the keyboard
      // animation gets interrupted halfway.
      const before = box.scrollTop;
      box.style.scrollBehavior = 'auto';
      box.scrollTop = before + delta;
      box.style.scrollBehavior = '';
    };

    setTimeout(reveal, 120);
    setTimeout(reveal, 450);
  });
}
