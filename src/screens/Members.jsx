import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

export default function Members() {
  const nav = useNavigate();
  const { data, t, lang, userById, role, actions } = useApp();
  const [confirm, setConfirm] = useState(null);
  if (role !== 'admin') return <Navigate to="/app/admin" replace />;

  const roleColors = {
    admin: { bg: '#13211b', fg: '#7fd1a8' },
    moderator: { bg: 'var(--status-new-bg)', fg: 'var(--status-new-fg)' },
    member: { bg: 'var(--section-bg)', fg: 'var(--ink-400)' },
  };
  const cycle = { member: 'moderator', moderator: 'member', admin: 'admin' };

  return (
    <div className="screen">
      <ScreenHeader title={t('admin_members_title')} onBack={() => nav('/app/admin')} kicker={`${data.members.length} ${t('admin_members')}`} />
      <div className="pad" style={{ paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.members.map((m) => {
          const u = userById(m.userId);
          const rc = roleColors[m.role];
          return (
            <div key={m.userId} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar user={u} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{u.name}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{u.apartment} · {t('admin_joined_on')} {formatDate(m.joinedAt, lang)}</div>
                </div>
                <span className="badge" style={{ background: rc.bg, color: rc.fg }}>{t('role_' + m.role)}</span>
              </div>

              {m.role !== 'admin' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => actions.changeRole(m.userId, cycle[m.role])} className="btn btn--ghost" style={{ flex: 1, padding: '9px', fontSize: 13 }}>
                    {m.role === 'member' ? '↑ ' + t('role_moderator') : '↓ ' + t('role_member')}
                  </button>
                  <button onClick={() => setConfirm(m.userId)} className="btn" style={{ flex: 1, padding: '9px', fontSize: 13, background: 'var(--section-bg)', color: 'var(--terracotta)' }}>{t('admin_remove')}</button>
                </div>
              )}

              {confirm === m.userId && (
                <div style={{ marginTop: 12, background: 'var(--section-bg)', borderRadius: 12, padding: 13 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{t('admin_remove_confirm')}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirm(null)} className="btn btn--ghost" style={{ flex: 1, padding: '9px', fontSize: 13 }}>{t('cancel')}</button>
                    <button onClick={() => { actions.removeMember(m.userId); setConfirm(null); }} className="btn btn--terracotta" style={{ flex: 1, padding: '9px', fontSize: 13 }}>{t('admin_remove')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
