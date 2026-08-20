import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar } from '../components/ui.jsx';

/*
  Everything the app knows about you as an account holder, in one place, plus
  the two things you can actually change about it. The sign-in address used to
  appear nowhere at all: you could only find out which one you had used by
  signing out and trying.
*/

/*
  Label left, value right, except when the value is too long to sit beside the
  label. An email address broken across two right-aligned lines leaves an orphan
  like "plu.ro" hanging under it, so past a certain length the value moves onto
  its own line and reads left to right like the address it is.
*/
const STACK_ABOVE = 22;

function Row({ label, value, faint, last }) {
  const stacked = String(value).length > STACK_ABOVE;
  const border = last ? {} : { borderBottom: '1px solid var(--border)' };
  const valueStyle = {
    fontSize: 14.5, fontWeight: 600, wordBreak: 'break-word',
    color: faint ? 'var(--ink-300)' : 'inherit',
    fontStyle: faint ? 'italic' : 'normal',
  };

  if (stacked) {
    return (
      <div style={{ padding: '11px 0', ...border }}>
        <div className="muted" style={{ fontSize: 13, marginBottom: 3 }}>{label}</div>
        <div style={valueStyle}>{value}</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '11px 0', ...border }}>
      <span className="muted" style={{ fontSize: 13, flexShrink: 0, minWidth: 104 }}>{label}</span>
      <span style={{ ...valueStyle, textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  );
}

export default function Account() {
  const nav = useNavigate();
  const { t, currentUser, role, data, session, pendingEmail, hasPasswordLogin } = useApp();

  const email = session?.user?.email || '';
  const roleLabel = role === 'admin' ? t('role_admin') : role === 'moderator' ? t('role_moderator') : t('role_member');
  const usesGoogle = !!session?.user?.identities?.some((i) => i.provider === 'google');
  const signinLabel = usesGoogle && hasPasswordLogin ? t('acc_signin_both')
    : usesGoogle ? t('acc_signin_google')
    : t('acc_signin_email');

  const Item = ({ icon, label, onClick }) => (
    <button onClick={onClick} className="card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13 }}>
      <span style={{ fontSize: 19 }}>{icon}</span>
      <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{label}</span>
      <span className="faint" style={{ fontSize: 18 }}>›</span>
    </button>
  );

  return (
    <div className="screen">
      <ScreenHeader title={t('acc_title')} onBack={() => nav('/app/settings')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <Avatar user={currentUser} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{currentUser.name}</div>
            <div className="muted" style={{ fontSize: 13, wordBreak: 'break-word' }}>{email}</div>
          </div>
        </div>

        {/* A change that has been asked for but not yet confirmed is invisible
            otherwise, which reads as "nothing happened" and invites a second
            attempt. */}
        {pendingEmail && (
          <div className="card" style={{ background: 'var(--status-new-bg)', border: 'none', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--status-new-fg)', marginBottom: 5 }}>
              {t('email_change_pending')}
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--status-new-fg)' }}>
              {t('email_change_pending_body').replace('{email}', pendingEmail)}
            </p>
          </div>
        )}

        <div className="eyebrow" style={{ margin: '14px 0 2px' }}>{t('acc_details')}</div>
        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
          <Row label={t('acc_name')} value={currentUser.name} />
          <Row label={t('acc_email')} value={email} />
          <Row label={t('acc_apartment')} value={currentUser.apartment || t('acc_not_set')} faint={!currentUser.apartment} />
          <Row label={t('acc_community')} value={data.community?.name || '—'} />
          <Row label={t('acc_role')} value={roleLabel} />
          <Row label={t('acc_signin')} value={signinLabel} last />
        </div>

        <div className="eyebrow" style={{ margin: '18px 0 2px' }}>{t('acc_manage')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Item icon="✉︎" label={t('email_change_title')} onClick={() => nav('/app/settings/email')} />
          <Item icon="🔑" label={hasPasswordLogin ? t('pw_change_title') : t('pw_set_title')} onClick={() => nav('/app/settings/password')} />
        </div>
      </div>
    </div>
  );
}
