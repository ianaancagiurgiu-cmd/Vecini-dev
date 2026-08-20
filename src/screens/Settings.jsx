import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar, LANGS } from '../components/ui.jsx';

export default function Settings() {
  const nav = useNavigate();
  const { t, lang, setLang, currentUser, role, isStaff, data, signOut } = useApp();

  const roleLabel = role === 'admin' ? t('role_admin') : role === 'moderator' ? t('role_moderator') : t('role_member');
  const roleBg = role === 'admin' ? '#13211b' : role === 'moderator' ? 'var(--status-new-bg)' : 'var(--section-bg)';
  const roleFg = role === 'admin' ? '#7fd1a8' : role === 'moderator' ? 'var(--status-new-fg)' : 'var(--ink-400)';

  const Item = ({ icon, label, onClick, danger, right }) => (
    <button onClick={onClick} className="card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, color: danger ? 'var(--terracotta)' : 'inherit' }}>
      <span style={{ fontSize: 19 }}>{icon}</span>
      <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{label}</span>
      {right || <span className="faint" style={{ fontSize: 18 }}>›</span>}
    </button>
  );

  const logout = async () => { await signOut(); nav('/'); };

  return (
    <div className="screen">
      <ScreenHeader title={t('set_title')} onBack={() => nav('/app')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        {/* profile card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <Avatar user={currentUser} size={54} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{currentUser.name}</div>
            <div className="muted" style={{ fontSize: 13 }}>{currentUser.apartment} · {data.community.name}</div>
          </div>
          <span className="badge" style={{ background: roleBg, color: roleFg }}>{roleLabel}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 8 }}>
          <div className="eyebrow" style={{ margin: '12px 0 2px' }}>{t('set_lang')}</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{ padding: '11px 14px', borderRadius: 11, border: 'none', fontWeight: 700, fontSize: 14, textAlign: 'left', background: lang === l.code ? 'var(--green-600)' : 'var(--section-bg)', color: lang === l.code ? '#fff' : 'var(--ink-400)' }}>
                {l.flag} {l.name}
              </button>
            ))}
          </div>

          <div className="eyebrow" style={{ margin: '14px 0 2px' }}>{t('set_account')}</div>
          {/* Both the account details and the two things you can change about
              them live behind this one row now. The password used to be linked
              straight from here, while the sign-in address appeared nowhere. */}
          <Item icon="👤" label={t('acc_title')} onClick={() => nav('/app/settings/account')} />
          <Item icon="🔔" label={t('notif_prefs')} onClick={() => nav('/app/notifications')} />
          {isStaff && <Item icon="🛡️" label={t('admin_title')} onClick={() => nav('/app/admin')} />}
          <Item icon="↩︎" label={t('auth_logout')} onClick={logout} danger />
        </div>
      </div>
    </div>
  );
}
