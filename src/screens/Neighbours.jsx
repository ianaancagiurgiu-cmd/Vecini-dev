import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar, Empty } from '../components/ui.jsx';

/*
  Who else lives here, and how to reach the ones who said they could be reached.

  Open to every member, unlike the admin's member list, because the point is
  different: this is for ringing the neighbour above you when water is coming
  through the ceiling, not for promoting and removing people.

  A number appears only when its owner turned it on. That is enforced in the
  database, not here — this screen simply never receives the others.
*/

const PhoneIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.2 3.5h3l1.5 3.8-2 1.4a11.5 11.5 0 0 0 5.6 5.6l1.4-2 3.8 1.5v3a1.8 1.8 0 0 1-2 1.8A16.4 16.4 0 0 1 4.4 5.5a1.8 1.8 0 0 1 1.8-2Z" />
  </svg>
);

export default function Neighbours() {
  const nav = useNavigate();
  const { data, t, counted, userById, currentUser } = useApp();
  const [q, setQ] = useState('');

  const rows = data.members
    .map((m) => ({ ...m, user: userById(m.userId) }))
    .filter((r) => !r.user.deleted)
    .filter((r) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return `${r.user.name} ${r.user.apartment || ''}`.toLowerCase().includes(needle);
    })
    // The people who can be reached first, then everyone else by name. Someone
    // opening this screen usually needs to call somebody.
    .sort((a, b) => (Number(!!b.user.phone) - Number(!!a.user.phone))
      || a.user.name.localeCompare(b.user.name, 'ro'));

  const reachable = data.members.filter((m) => userById(m.userId).phone).length;

  return (
    <div className="screen">
      <ScreenHeader title={t('nb_title')} onBack={() => nav('/app')}
        kicker={counted('dash_members', data.members.length)} />

      <div className="pad" style={{ paddingTop: 14 }}>
        {data.members.length > 6 && (
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t('nb_search')} style={{ marginBottom: 12 }} />
        )}

        {/* Said once, at the top, rather than beside every name without one. */}
        {reachable === 0 && data.members.length > 1 && (
          <div className="card" style={{ background: 'var(--section-bg)', border: 'none', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{t('nb_none_shared')}</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.length === 0 && <Empty icon="🏠">{t('nb_empty')}</Empty>}
          {rows.map((r) => {
            const isMe = r.userId === currentUser.id;
            return (
              <div key={r.userId} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar user={r.user} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                    {r.user.name}{isMe && <span className="faint" style={{ fontWeight: 600 }}> · {t('you')}</span>}
                  </div>
                  <div className="faint" style={{ fontSize: 12.5, marginTop: 1 }}>
                    {r.user.apartment || t('acc_not_set')}
                    {r.role !== 'member' && ` · ${t('role_' + r.role)}`}
                  </div>
                </div>

                {/* A real tel: link, so the phone does the dialling. */}
                {r.user.phone && (
                  <a href={`tel:${r.user.phone.replace(/[^\d+]/g, '')}`}
                    aria-label={`${t('nb_call')} ${r.user.name}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      background: 'var(--status-done-bg)', color: 'var(--green-600)',
                      padding: '9px 13px', borderRadius: 11, textDecoration: 'none',
                      fontSize: 13.5, fontWeight: 700, flexShrink: 0,
                    }}>
                    <PhoneIcon />
                    {t('nb_call')}
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 16 }}>{t('nb_note')}</div>
      </div>
    </div>
  );
}
