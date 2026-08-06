import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';

function Logo({ size = 40 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: size, height: size, borderRadius: size * 0.28, background: 'var(--green-600)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.55, fontFamily: 'var(--font-display)' }}>V</span>
      <span className="serif" style={{ fontSize: size * 0.66, fontWeight: 600, color: 'var(--green-ink)' }}>Vecini</span>
    </div>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <span style={{ width: 42, height: 42, minWidth: 42, borderRadius: 13, background: '#e6f1ea', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{title}</div>
        <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45 }}>{body}</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const { t, authed, authLoading } = useApp();
  if (authLoading) return null;
  if (authed) return <Navigate to="/app" replace />;
  return (
    <div className="screen screen-anim" style={{ paddingBottom: 40 }}>
      {/* hero */}
      <div style={{ background: 'var(--section-bg)', borderBottom: '1px solid var(--border)', padding: '20px 20px 30px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 90% 6%, rgba(47,107,79,.12) 0, transparent 45%)' }} />
        <div style={{ position: 'relative' }}>
          <Logo />
          <div className="eyebrow" style={{ marginTop: 26, marginBottom: 12, color: 'var(--green-600)' }}>{t('landing_kicker')}</div>
          <h1 className="display" style={{ fontSize: 32, lineHeight: 1.08, margin: '0 0 12px' }}>{t('landing_title')}</h1>
          <p className="muted" style={{ fontSize: 15.5, lineHeight: 1.5, margin: 0 }}>{t('landing_sub')}</p>
        </div>
      </div>

      {/* features */}
      <div className="pad" style={{ paddingTop: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Feature icon="📢" title={t('landing_feat1_t')} body={t('landing_feat1_b')} />
        <Feature icon="🛠️" title={t('landing_feat2_t')} body={t('landing_feat2_b')} />
        <Feature icon="🗳️" title={t('landing_feat3_t')} body={t('landing_feat3_b')} />
      </div>

      {/* CTAs */}
      <div className="pad" style={{ paddingTop: 30, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <button className="btn btn--primary" onClick={() => nav('/signup')}>{t('landing_cta_primary')}</button>
        <button className="btn btn--ghost" onClick={() => nav('/join')}>{t('landing_cta_secondary')}</button>
        <button onClick={() => nav('/login')} style={{ background: 'none', border: 'none', color: 'var(--ink-400)', fontSize: 14, fontWeight: 600, marginTop: 4, textAlign: 'center' }}>{t('landing_signin')}</button>
      </div>
    </div>
  );
}
