import { useState } from 'react';
import { useApp } from '../state/store.jsx';

export const LANGS = [
  { code: 'ro', flag: '🇷🇴', short: 'RO', name: 'Română' },
  { code: 'en', flag: '🇬🇧', short: 'EN', name: 'English' },
  { code: 'hu', flag: '🇭🇺', short: 'HU', name: 'Magyar' },
];

// Small, in-flow language switch — sits inline in a header row instead of
// floating over the screen, so it never covers form fields. Tapping cycles
// through the available languages; Settings offers them as explicit choices.
export function LangSwitch() {
  const { lang, setLang } = useApp();
  const i = Math.max(0, LANGS.findIndex((l) => l.code === lang));
  const current = LANGS[i];
  const next = LANGS[(i + 1) % LANGS.length];
  return (
    <button
      onClick={() => setLang(next.code)}
      aria-label={`Language: ${current.name}. Switch to ${next.name}`}
      style={{
        border: '1px solid var(--border)', borderRadius: 999, padding: '6px 12px',
        background: 'var(--section-bg)', color: 'var(--ink-400)', fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {current.flag} {current.short}
    </button>
  );
}

/*
  Line-art eye, drawn rather than an emoji: emoji render as a different picture
  on every platform and read as decoration next to a form field, where this has
  to read as a control.
*/
function EyeIcon({ off = false }) {
  return (
    <svg
      width="21" height="21" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      <path d="M2.6 12S6.3 5.8 12 5.8 21.4 12 21.4 12 17.7 18.2 12 18.2 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="3.1" />
      {/* Struck through when the password is showing: the tap hides it again. */}
      {off && <path d="M4.4 19.6 19.6 4.4" />}
    </svg>
  );
}

/*
  Password field with a reveal toggle. Typing a password you cannot see is the
  easiest way to lock yourself out of your own account, and on a phone keyboard
  it is close to guaranteed.

  The 16px font size is deliberate: iOS Safari zooms the whole page in when it
  focuses an input with smaller text.
*/
export function PasswordInput({
  value,
  onChange,
  // Empty by default. The row of dots this used to show carried nothing: it was
  // not the person's password, only decoration, and it made an empty field look
  // like a filled one. The label above already says what the field is.
  placeholder = '',
  autoComplete = 'current-password',
  style,
  ...rest
}) {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        className="input"
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        // Leave room for the button so long passwords do not run underneath it.
        style={{ paddingRight: 46 }}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={t(visible ? 'pw_hide' : 'pw_show')}
        title={t(visible ? 'pw_hide' : 'pw_show')}
        aria-pressed={visible}
        style={{
          position: 'absolute', top: 0, right: 0, height: '100%', width: 46,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          lineHeight: 1,
          // Green while revealed, so it is obvious the password is on screen.
          color: visible ? 'var(--green-600)' : 'var(--ink-400)',
        }}
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}

export function Avatar({ user, size = 38 }) {
  const initials = (user?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span style={{
      width: size, height: size, minWidth: size, borderRadius: size * 0.32,
      background: user?.color || '#999', color: '#fff', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontWeight: 700,
      fontSize: size * 0.4, letterSpacing: '.3px',
    }}>{initials}</span>
  );
}

export function Badge({ children, bg, fg, dot }) {
  return (
    <span className="badge" style={{ background: bg, color: fg }}>
      {dot && <span className="dot" style={{ background: fg }} />}
      {children}
    </span>
  );
}

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="toast-wrap"><div className="toast">{toast}</div></div>
  );
}

export function Empty({ icon = '🌿', children }) {
  return <div className="empty"><div className="empty__icon">{icon}</div><div>{children}</div></div>;
}

// A generic top header inside a screen
export function ScreenHeader({ title, onBack, right, kicker }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--app-bg)', paddingTop: 6 }}>
      <div className="pad" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48 }}>
        {onBack && (
          <button onClick={onBack} aria-label="back" style={{ background: 'none', border: 'none', padding: '6px 8px 6px 0', fontSize: 16, fontWeight: 700, color: 'var(--green-600)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {kicker && <div className="eyebrow" style={{ fontSize: 11, marginBottom: 2 }}>{kicker}</div>}
          <h1 className="serif" style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
        </div>
        {right}
      </div>
      <div style={{ height: 1, background: 'var(--border)', opacity: .7 }} />
    </div>
  );
}

// Round "+" action button used in headers
export function AddButton({ onClick, label }) {
  return (
    <button onClick={onClick} className="btn btn--primary" style={{ width: 'auto', padding: '9px 14px', borderRadius: 999, fontSize: 13.5, gap: 4 }}>
      <span style={{ fontSize: 17, marginTop: -1 }}>+</span>{label}
    </button>
  );
}
