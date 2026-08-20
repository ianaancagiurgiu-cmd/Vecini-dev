import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

/*
  Who is in the community, and who runs it.

  The rules about roles are enforced in the database, not here: only an admin
  may change one, never their own, and nothing may leave the community with
  members but nobody in charge. What this screen does is not offer moves that
  would be refused, and be plain about the one that cannot be undone alone.
*/

export default function Members() {
  const nav = useNavigate();
  const { data, t, lang, counted, userById, role, currentUser, actions } = useApp();
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [promoting, setPromoting] = useState(null);
  const [busy, setBusy] = useState(false);
  if (role !== 'admin') return <Navigate to="/app/admin" replace />;

  const roleColors = {
    admin: { bg: '#13211b', fg: '#7fd1a8' },
    moderator: { bg: 'var(--status-new-bg)', fg: 'var(--status-new-fg)' },
    member: { bg: 'var(--section-bg)', fg: 'var(--ink-400)' },
  };

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { /* the store has already said so */ }
    finally { setBusy(false); setPromoting(null); }
  };

  const SmallBtn = ({ onClick, children, tone }) => (
    <button onClick={onClick} disabled={busy} className="btn btn--ghost"
      style={{ flex: 1, padding: '9px', fontSize: 13, opacity: busy ? .5 : 1, ...(tone === 'danger' ? { background: 'var(--section-bg)', color: 'var(--terracotta)' } : {}) }}>
      {children}
    </button>
  );

  return (
    <div className="screen">
      <ScreenHeader title={t('admin_members_title')} onBack={() => nav('/app/admin')} kicker={counted('admin_members', data.members.length)} />
      <div className="pad" style={{ paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.members.map((m) => {
          const u = userById(m.userId);
          const rc = roleColors[m.role];
          const isMe = m.userId === currentUser.id;
          const isAdmin = m.role === 'admin';

          return (
            <div key={m.userId} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar user={u} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    {u.name}{isMe && <span className="faint" style={{ fontWeight: 600 }}> · {t('you')}</span>}
                  </div>
                  <div className="faint" style={{ fontSize: 12 }}>{u.apartment} · {t('admin_joined_on')} {formatDate(m.joinedAt, lang)}</div>
                </div>
                <span className="badge" style={{ background: rc.bg, color: rc.fg }}>{t('role_' + m.role)}</span>
              </div>

              {/* Nothing on your own row: you cannot change your own standing,
                  and handing the community over is offered on the row of the
                  person you would hand it to. */}
              {!isMe && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {isAdmin ? (
                      <SmallBtn onClick={() => run(() => actions.changeRole(m.userId, 'member'))}>
                        ↓ {t('admin_demote_admin')}
                      </SmallBtn>
                    ) : (
                      <>
                        <SmallBtn onClick={() => run(() => actions.changeRole(m.userId, m.role === 'member' ? 'moderator' : 'member'))}>
                          {m.role === 'member' ? '↑ ' + t('role_moderator') : '↓ ' + t('role_member')}
                        </SmallBtn>
                        <SmallBtn onClick={() => setPromoting(promoting === m.userId ? null : m.userId)}>
                          ♛ {t('admin_make_admin')}
                        </SmallBtn>
                      </>
                    )}
                    <SmallBtn onClick={() => setConfirmRemove(m.userId)} tone="danger">{t('admin_remove')}</SmallBtn>
                  </div>

                  {/* Two different things, easily confused, so they are spelled
                      out side by side rather than hidden behind one word. */}
                  {promoting === m.userId && (
                    <div style={{ marginTop: 12, background: 'var(--section-bg)', borderRadius: 12, padding: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <button onClick={() => run(() => actions.changeRole(m.userId, 'admin'))} disabled={busy}
                          className="btn btn--primary" style={{ padding: '11px', fontSize: 13.5 }}>
                          {t('admin_make_admin_keep')}
                        </button>
                        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 6 }}>{t('admin_make_admin_keep_note')}</div>
                      </div>
                      <div>
                        <button onClick={() => run(() => actions.handOverCommunity(m.userId))} disabled={busy}
                          className="btn btn--terracotta" style={{ padding: '11px', fontSize: 13.5 }}>
                          {t('admin_hand_over')}
                        </button>
                        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 6 }}>{t('admin_hand_over_note')}</div>
                      </div>
                      <button onClick={() => setPromoting(null)} style={{ background: 'none', border: 'none', color: 'var(--ink-400)', fontSize: 13, fontWeight: 600, padding: 4 }}>
                        {t('cancel')}
                      </button>
                    </div>
                  )}

                  {confirmRemove === m.userId && (
                    <div style={{ marginTop: 12, background: 'var(--section-bg)', borderRadius: 12, padding: 13 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{t('admin_remove_confirm')}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <SmallBtn onClick={() => setConfirmRemove(null)}>{t('cancel')}</SmallBtn>
                        <button onClick={() => { actions.removeMember(m.userId); setConfirmRemove(null); }} className="btn btn--terracotta" style={{ flex: 1, padding: '9px', fontSize: 13 }}>{t('admin_remove')}</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 6 }}>{t('admin_last_admin')}</div>
      </div>
    </div>
  );
}
