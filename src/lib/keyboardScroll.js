/*
  Keeping a focused field visible above the keyboard, on an iOS home-screen
  install specifically.

  The diagnostic readout in viewportDebug.js ruled out the theory this started
  from: visualViewport.offsetTop and window.scrollY both stay 0 the entire
  time, on the phone this actually broke on, yet the screen still visibly
  shifts — the debug band, `position: fixed; top: 0`, is invisible until the
  page is scrolled back up to see it. Nothing in JS reports the shift, which
  means there is nothing to measure and compensate for; the previous attempt
  tried to cancel a number that was always zero, and only ever changed
  something else.

  So instead of correcting a shift after the fact, this stops the shift from
  having anything to act on. The moment a field is focused, body is taken out
  of document flow entirely — `position: fixed` — which cannot be scrolled by
  anything, native keyboard-avoidance included; `overflow: hidden` alone
  turned out not to be enough to stop it. With nowhere left for the page to
  go, this then does the one thing that was actually wanted — bring the field
  into view — itself, inside the one scroll container the app already
  controls (`.phone__scroll`), rather than leaving it to whatever the OS was
  attempting.
*/
let lockedY = 0;
let locked = false;

function isField(el) {
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
}

function lock() {
  if (locked) return;
  locked = true;
  lockedY = window.scrollY || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = `${-lockedY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlock() {
  if (!locked) return;
  locked = false;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, lockedY);
}

export function installKeyboardScrollLock() {
  document.addEventListener('focusin', (e) => {
    if (!isField(e.target)) return;
    lock();
    // A beat for the keyboard's own opening animation and for --app-h to
    // settle, so the field is scrolled against the space it will actually
    // have rather than the space it had a moment before.
    setTimeout(() => {
      e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
  });

  document.addEventListener('focusout', (e) => {
    if (!isField(e.target)) return;
    // Only once nothing else has already taken focus — moving from one field
    // straight to the next should not visibly unlock and relock in between.
    setTimeout(() => { if (!isField(document.activeElement)) unlock(); }, 50);
  });
}
