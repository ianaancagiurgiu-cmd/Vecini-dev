import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar, Empty } from '../components/ui.jsx';
import { timeAgo, CATEGORIES, catLabel, DISC_CATS } from '../lib/format.js';

export default function Moderation() {
  const nav = useNavigate();
  const { data, t, L, lang, userById, isStaff, actions } = useApp();
  const [moving, setMoving] = useState(null);
  if (!isStaff) return <Navigate to="/app" replace />;

  const queue = data.discussions.filter((d) => d.status === 'pending');

  return (
    <div className="screen">
      <ScreenHeader title={t('admin_moderation')} onBack={() => nav('/app/admin')} kicker={t('admin_mod_queue')} />
      <div className="pad" style={{ paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {queue.length === 0 && <Empty icon="✅">{lang === 'en' ? 'Nothing waiting. All clear!' : 'Nimic în așteptare. Totul e ok!'}</Empty>}
        {queue.map((d) => {
          const cInfo = CATEGORIES[d.category] || CATEGORIES.general;
          return (
            <div key={d.id} className="card">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span className="badge" style={{ background: 'var(--status-prog-bg)', color: 'var(--amber)' }}>⏳ {lang === 'en' ? 'Pending' : 'În așteptare'}</span>
                <span className="badge" style={{ background: cInfo.bg, color: cInfo.fg }}>{cInfo.icon} {catLabel(d.category, t)}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 6 }}>{L(d, 'title')}</div>
              <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 10 }}>{L(d, 'body')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Avatar user={userById(d.authorId)} size={26} />
                <span className="faint" style={{ fontSize: 12.5 }}>{userById(d.authorId).name} · {timeAgo(d.createdAt, t, lang)}</span>
              </div>

              {moving === d.id ? (
                <div>
                  <div className="field-label">{t('admin_move')} →</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {DISC_CATS.filter((c) => c !== d.category).map((c) => (
                      <button key={c} onClick={() => { actions.moderate(d.id, 'move', c); setMoving(null); }} className="pill">{CATEGORIES[c].icon} {catLabel(c, t)}</button>
                    ))}
                    <button onClick={() => setMoving(null)} className="pill">✕ {t('cancel')}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => actions.moderate(d.id, 'approve')} className="btn btn--primary" style={{ flex: 1, padding: '11px', fontSize: 13.5 }}>✓ {t('admin_approve')}</button>
                  <button onClick={() => setMoving(d.id)} className="btn btn--ghost" style={{ flex: 1, padding: '11px', fontSize: 13.5 }}>↔ {t('admin_move')}</button>
                  <button onClick={() => actions.moderate(d.id, 'hide')} className="btn" style={{ flex: 1, padding: '11px', fontSize: 13.5, background: 'var(--section-bg)', color: 'var(--terracotta)' }}>⊘ {t('admin_hide')}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
