import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/*
  Holding a message down, and the little menu that comes up beside it.

  Two pieces: the gesture, and the menu it opens.

  The gesture is a hook called once per screen rather than once per message,
  and it returns a binder. A hook inside the loop over the comments would be a
  hook whose call order changes with the number of comments, which is the one
  thing React cannot tolerate. One finger can only hold one thing down at a
  time, so one timer per screen is all there is to keep anyway.

  What it has to get right is the difference between a hold and the start of a
  scroll. A finger resting on a message for half a second while the thumb
  decides is a hold; the same finger moving ten pixels is somebody scrolling
  the conversation, and opening a menu under them is how a list becomes
  unusable. So movement cancels.
*/

const HOLD_MS = 450;
const SLOP_PX = 10;

export function useLongPress() {
  const held = useRef({ timer: null, x: 0, y: 0 });

  const cancel = () => {
    if (held.current.timer) clearTimeout(held.current.timer);
    held.current.timer = null;
  };
  useEffect(() => cancel, []);

  /*
    `enabled` false gives back no handlers at all rather than handlers that do
    nothing: a message with nothing to offer should not swallow the press, and
    should leave the browser's own text selection alone.
  */
  return (onFire, enabled = true) => (enabled ? {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = e.currentTarget;
      held.current.x = e.clientX;
      held.current.y = e.clientY;
      cancel();
      held.current.timer = setTimeout(() => {
        held.current.timer = null;
        onFire(el);
      }, HOLD_MS);
    },
    onPointerMove: (e) => {
      if (!held.current.timer) return;
      if (Math.abs(e.clientX - held.current.x) > SLOP_PX
        || Math.abs(e.clientY - held.current.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    // The hold is ours now, so neither the desktop right-click menu nor iOS's
    // "copy / look up" callout should also answer it.
    onContextMenu: (e) => e.preventDefault(),
  } : {});
}

const ROW_H = 46;

/*
  The menu itself, beside the message rather than at the foot of the screen.

  Rendered into the phone frame, like the bottom bar and the onboarding sheets,
  so it is not clipped by the scrolling region and does not travel with it.

  It prefers to sit above the message, because the finger that opened it is
  resting on the message and would cover a menu placed below. When there is no
  room above — a message near the top of the screen — it goes below instead.
  Sideways it is clamped to the frame, so a menu opened next to the edge does
  not hang off it.

  It closes on a scroll rather than trying to follow one. The position was
  measured from where the message was when you held it down; the honest options
  are to recompute on every frame or to get out of the way, and for a menu you
  opened half a second ago the second one is also what you would expect.
*/
export function ActionMenu({ anchor, items, onClose }) {
  const [host, setHost] = useState(null);
  const card = useRef(null);
  const [pos, setPos] = useState(null);
  useEffect(() => { setHost(document.querySelector('.phone')); }, []);

  /*
    Measured, not calculated.

    The height used to be rows times a row height, which is only true while
    every label fits on one line. "Schimbă termenul priorității" does not, and
    a menu two lines taller than the arithmetic said was a menu placed two
    lines too low — invisible on a menu that opens downwards from a header,
    and wrong on one that opens upwards from a message. Labels also arrive
    translated, so nothing here can know how tall they will be.

    Placed on the frame it is drawn in rather than in the layout: it prefers
    above, because the finger that opened it is resting below.
  */
  useLayoutEffect(() => {
    if (!host || !anchor || !card.current) return;
    const frame = host.getBoundingClientRect();
    const { width, height } = card.current.getBoundingClientRect();
    const gap = 8;
    const above = anchor.top - frame.top - height - gap;
    setPos({
      top: above >= 10 ? above : (anchor.bottom - frame.top + gap),
      left: Math.max(12, Math.min(anchor.left - frame.left, frame.width - width - 12)),
    });
  }, [host, anchor, items.length]);

  useEffect(() => {
    const bye = () => onClose();
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    const scroller = document.querySelector('.phone__scroll');
    scroller?.addEventListener('scroll', bye, { passive: true });
    window.addEventListener('resize', bye);
    window.addEventListener('keydown', key);
    return () => {
      scroller?.removeEventListener('scroll', bye);
      window.removeEventListener('resize', bye);
      window.removeEventListener('keydown', key);
    };
  }, [onClose]);

  if (!host || !anchor) return null;

  const menu = (
    <div
      onClick={onClose}
      style={{ position: 'absolute', inset: 0, zIndex: 160, background: 'rgba(20,28,23,.22)' }}
    >
      <div
        ref={card}
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          // Off-screen for the one frame it takes to measure, rather than in
          // the wrong place for it.
          top: pos ? pos.top : -9999, left: pos ? pos.left : -9999,
          width: 232, opacity: pos ? 1 : 0,
          background: '#fff', borderRadius: 14, padding: '5px 0',
          border: '1px solid var(--border)',
          boxShadow: '0 10px 30px rgba(20,28,23,.18)',
          animation: 'menu-in .13s ease-out',
        }}
      >
        {items.map((it) => (
          <button
            key={it.label}
            role="menuitem"
            onClick={() => { onClose(); it.onSelect(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, width: '100%',
              // A minimum rather than a height: a label that needs two lines
              // has to make the row taller, not spill out of it.
              minHeight: ROW_H, padding: '9px 15px', background: 'none', border: 'none',
              textAlign: 'left', fontSize: 14.5, fontWeight: 600, lineHeight: 1.3,
              // Deleting is the one row you can reach by mistake and not undo,
              // so it does not look like the others.
              color: it.tone === 'danger' ? 'var(--terracotta)' : 'var(--ink-900)',
            }}
          >
            <span aria-hidden="true" style={{ color: it.tone === 'danger' ? 'var(--terracotta)' : 'var(--green-600)', display: 'inline-flex' }}>{it.icon}</span>
            {it.label}
          </button>
        ))}
      </div>
      <style>{`
        @keyframes menu-in { from { opacity: 0; transform: translateY(3px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { @keyframes menu-in { from { opacity: 1 } to { opacity: 1 } } }
      `}</style>
    </div>
  );

  return createPortal(menu, host);
}

export const PencilIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4l10-10-4-4L4 16v4Z" />
    <path d="M14.5 5.5 18.5 9.5" />
  </svg>
);
