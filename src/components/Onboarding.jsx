import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../state/store.jsx';
import { pushBlockedReason } from '../lib/push.js';
import { installPromptKind, runNativeInstall, snooze, silence, canAskForPush } from '../lib/install.js';

/*
  Two nudges shown just after someone starts using the app, in the order they
  actually depend on each other:

    1. add it to the home screen
    2. turn notifications on

  The order is not a preference. On iPhone, push does not work at all until the
  app has been added to the home screen, so asking the other way round would ask
  for something that cannot yet be granted.

  Neither appears immediately: landing in a new app and being handed a modal
  before seeing anything is how people learn to dismiss without reading.
*/

const FIRST_DELAY = 6000;   // let them look around first
const BETWEEN_DELAY = 1200; // a beat between the two sheets

/*
  Rendered into the phone frame rather than into the scrolling content, for two
  reasons: the sheet then stays put instead of sliding away when the page behind
  it is scrolled, and it sits in the same layer as the bottom navigation bar,
  which is pinned to the frame too. Below that bar's z-index the nav painted
  straight over the sheet's bottom edge, hiding the very button it was asking
  people to press. A modal covers the navigation; it does not queue behind it.
*/
function Sheet({ children, onClose }) {
  const [host, setHost] = useState(null);
  useEffect(() => { setHost(document.querySelector('.phone')); }, []);

  const sheet = (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 150,
        background: 'rgba(20,28,23,.42)',
        display: 'flex', alignItems: 'flex-end',
        animation: 'ob-fade .22s ease-out',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', background: '#fff',
          borderRadius: '22px 22px 0 0',
          /* Roomier at the foot than a plain sheet needs: in a browser tab the
             toolbar sits right under the page and reports no safe-area inset,
             so without this the last button ends up flush against it. */
          padding: '26px 22px calc(30px + env(safe-area-inset-bottom))',
          boxShadow: '0 -8px 40px rgba(20,28,23,.18)',
          animation: 'ob-rise .28s cubic-bezier(.2,.8,.3,1)',
          maxHeight: '88%', overflowY: 'auto',
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes ob-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ob-rise { from { transform: translateY(14px) } to { transform: none } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes ob-rise { from { transform: none } to { transform: none } }
        }
      `}</style>
    </div>
  );

  return host ? createPortal(sheet, host) : null;
}

/*
  The two iOS controls people have to find, drawn rather than described. Apple
  gives no way to open either one from a web page, so recognising the shape is
  the whole task — and "the Share button" means nothing to someone who has never
  noticed it. Inline SVG so they stay crisp and load with the page.
*/
const IosGlyph = ({ label, children }) => (
  <span
    role="img"
    aria-label={label}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 21, height: 21, borderRadius: 6, margin: '0 3px',
      /* Optical centring: aligns the box's middle with the text's middle, and
         keeps doing so if the type size ever changes. A fixed pixel nudge only
         looks right at one size, and looked low at this one. */
      verticalAlign: 'middle',
      background: 'var(--status-done-bg)', color: 'var(--green-600)', flexShrink: 0,
    }}
  >
    {children}
  </span>
);

const ShareGlyph = ({ label }) => (
  <IosGlyph label={label}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2v10.4" />
      <path d="M8.4 6.8 12 3.2l3.6 3.6" />
      <path d="M8.2 10.2H6.6A1.6 1.6 0 0 0 5 11.8v7.6a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6v-7.6a1.6 1.6 0 0 0-1.6-1.6h-1.6" />
    </svg>
  </IosGlyph>
);

const AddGlyph = ({ label }) => (
  <IosGlyph label={label}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.4" />
      <path d="M12 8.6v6.8M8.6 12h6.8" />
    </svg>
  </IosGlyph>
);

/* The notification sheet's header mark, drawn in the same line-art style as the
   iOS glyphs above rather than an emoji, which renders as a different picture
   on every platform. */
const BellMark = () => (
  <div
    aria-hidden="true"
    style={{
      width: 44, height: 44, borderRadius: 13, marginBottom: 14,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--status-done-bg)', color: 'var(--green-600)',
    }}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.2 9.6a5.8 5.8 0 0 1 11.6 0c0 4.5 1.9 5.9 1.9 5.9H4.3s1.9-1.4 1.9-5.9Z" />
      <path d="M10.2 19.2a2 2 0 0 0 3.6 0" />
    </svg>
  </div>
);

/*
  Steps carry two bits of markup, so each translation can place them naturally:
  {icon} is where the drawn iOS button belongs, and *stars* wrap the words that
  appear verbatim in the phone's own menu. Those words used to be in quotes, but
  a quoted phrase inside a sentence reads as something being said; bold reads as
  something to look for, which is what they are.
*/
const MARKUP = /(\{icon\}|\*[^*]+\*)/g;

function richStep(text, glyph) {
  return String(text).split(MARKUP).filter(Boolean).map((part, i) => {
    if (part === '{icon}') return glyph; // already carries its own key
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(1, -1)}</strong>;
    }
    return part;
  });
}

function Step({ n, children }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '7px 0' }}>
      <span style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
        background: 'var(--status-done-bg)', color: 'var(--green-600)',
        fontSize: 12.5, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <span style={{ fontSize: 14.5, lineHeight: 1.5, paddingTop: 1 }}>{children}</span>
    </li>
  );
}

const Title = ({ children, center }) => (
  <h2 className="serif" style={{
    fontSize: 22, lineHeight: 1.25, margin: '0 0 8px', color: 'var(--green-ink)',
    textAlign: center ? 'center' : 'left',
  }}>{children}</h2>
);

const Body = ({ children }) => (
  <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.55, margin: '0 0 16px' }}>{children}</p>
);

const Later = ({ onClick, label }) => (
  <button onClick={onClick} style={{
    background: 'none', border: 'none', width: '100%', marginTop: 10,
    color: 'var(--ink-400)', fontSize: 13.5, fontWeight: 600, padding: 8,
  }}>{label}</button>
);

export default function Onboarding() {
  const { t, actions, data, showToast } = useApp();
  const [stage, setStage] = useState(null);
  /*
    Captured when we decide to show the sheet, not recomputed on every render.
    Recomputing risked the two disagreeing mid-flight and drawing an install
    button on a platform that has none to offer.
  */
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(false);

  const pushWorthAsking = useCallback(() => {
    if (!canAskForPush()) return false;
    if (data.notifPrefs.push) return false;          // already on
    if (pushBlockedReason()) return false;           // unsupported, or iOS not installed yet
    return typeof Notification !== 'undefined' && Notification.permission === 'default';
  }, [data.notifPrefs.push]);

  // Decide what to show, after letting them get their bearings.
  useEffect(() => {
    const timer = setTimeout(() => {
      const k = installPromptKind();
      if (k) { setKind(k); setStage('install'); }
      else if (pushWorthAsking()) setStage('push');
    }, FIRST_DELAY);
    return () => clearTimeout(timer);
  }, [pushWorthAsking]);

  const afterInstall = () => {
    setStage(null);
    // Only chain to notifications if they are actually grantable now.
    setTimeout(() => { if (pushWorthAsking()) setStage('push'); }, BETWEEN_DELAY);
  };

  if (stage === 'install' && kind) {
    return (
      <Sheet onClose={() => { snooze('install'); afterInstall(); }}>
        {/* Centred: it is the sheet's heading, and it reads as one. The body
            below stays ranged left, where several lines of prose are easier
            to read than centred. */}
        <Title center>{t('ob_install_title')}</Title>
        <Body>{t('ob_install_body')}</Body>

        {kind === 'ios' ? (
          <>
            <ol style={{ listStyle: 'none', margin: '0 0 18px', padding: 0 }}>
              <Step n="1">{richStep(t('ob_install_s1'), <ShareGlyph key="g" label={t('ob_glyph_share')} />)}</Step>
              <Step n="2">{richStep(t('ob_install_s2'), <AddGlyph key="g" label={t('ob_glyph_add')} />)}</Step>
              <Step n="3">{richStep(t('ob_install_s3'), null)}</Step>
            </ol>
            <button className="btn btn--primary" onClick={() => { silence('install'); afterInstall(); }}>
              {t('ob_understood')}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn--primary" disabled={busy}
              onClick={async () => { setBusy(true); await runNativeInstall(); setBusy(false); afterInstall(); }}>
              {t('ob_install_cta')}
            </button>
            <Later onClick={() => { snooze('install'); afterInstall(); }} label={t('ob_later')} />
          </>
        )}
      </Sheet>
    );
  }

  if (stage === 'push') {
    return (
      <Sheet onClose={() => { snooze('push'); setStage(null); }}>
        <BellMark />
        <Title>{t('ob_push_title')}</Title>
        <Body>{t('ob_push_body')}</Body>
        <button className="btn btn--primary" disabled={busy}
          onClick={async () => {
            setBusy(true);
            const reason = await actions.setPushEnabled(true);
            setBusy(false);
            setStage(null);
            if (!reason) { silence('push'); showToast(t('push_enabled')); }
            else snooze('push');
          }}>
          {t('ob_push_cta')}
        </button>
        <Later onClick={() => { snooze('push'); setStage(null); }} label={t('ob_later')} />
      </Sheet>
    );
  }

  return null;
}
