import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';

export function GoogleButton({ onClick }) {
  const { t } = useApp();
  return (
    <button className="btn btn--ghost" onClick={onClick} style={{ gap: 10 }}>
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6c1.9-5.6 7.1-9.8 13.7-9.8z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.1-3.8 6.5-9.4 6.5-16z"/><path fill="#FBBC05" d="M10.3 28.3c-.5-1.4-.7-2.9-.7-4.3s.3-3 .7-4.3l-7.8-6C.9 16.9 0 20.3 0 24s.9 7.1 2.5 10.3l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.6 0-11.8-4.2-13.7-9.8l-7.8 6C6.4 42.6 14.6 48 24 48z"/></svg>
      {t('auth_google')}
    </button>
  );
}

export function AuthShell({ title, sub, children, footer }) {
  const nav = useNavigate();
  return (
    <div className="screen screen-anim">
      <div className="pad" style={{ paddingTop: 6 }}>
        <button onClick={() => nav('/')} style={{ background: 'none', border: 'none', color: 'var(--green-600)', fontWeight: 700, fontSize: 15, padding: '8px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      <div className="pad" style={{ paddingTop: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 24 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--green-600)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 19, fontFamily: 'var(--font-display)' }}>V</span>
          <span className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--green-ink)' }}>Vecini</span>
        </div>
        <h1 className="display" style={{ fontSize: 30, margin: '0 0 8px' }}>{title}</h1>
        <p className="muted" style={{ fontSize: 15, margin: '0 0 26px', lineHeight: 1.45 }}>{sub}</p>
        {children}
      </div>
      {footer && <div className="pad" style={{ marginTop: 22, textAlign: 'center' }}>{footer}</div>}
    </div>
  );
}

export function Divider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span className="faint" style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}
