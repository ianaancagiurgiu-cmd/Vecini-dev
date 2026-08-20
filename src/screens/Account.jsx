import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar } from '../components/ui.jsx';
import PendingEmail from '../components/PendingEmail.jsx';

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

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onChange}
      role="switch"
      aria-checked={on}
      disabled={disabled}
      style={{
        width: 46, height: 27, borderRadius: 999, border: 'none', padding: 0,
        background: on ? 'var(--green-600)' : 'var(--input-border)',
        position: 'relative', transition: '.2s', flexShrink: 0, opacity: disabled ? .5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 22 : 3, width: 21, height: 21,
        borderRadius: '50%', background: '#fff', transition: '.2s',
      }} />
    </button>
  );
}

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
  const { t, currentUser, role, data, session, pendingEmail, hasPasswordLogin, setContact, showToast } = useApp();

  const saved = data.myContact;
  const [phone, setPhoneField] = useState(saved.phone);
  const [phoneErr, setPhoneErr] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const phoneChanged = phone.trim() !== saved.phone;

  const save = async ({ phone: nextPhone, visible }) => {
    setPhoneErr('');
    const v = nextPhone.trim();
    // Deliberately loose: the field is optional and phone numbers are written
    // in more ways than any pattern worth enforcing. This only catches a slip.
    if (v && !/^[+()\d][\d\s()./-]{5,24}$/.test(v)) { setPhoneErr(t('acc_phone_bad')); return false; }
    setSavingPhone(true);
    try {
      await setContact({ phone: v, visible: v ? visible : false });
      return true;
    } catch (e) {
      setPhoneErr(t('email_error'));
      return false;
    } finally {
      setSavingPhone(false);
    }
  };

  const savePhone = async () => {
    if (await save({ phone, visible: saved.visible })) showToast(t('acc_phone_saved'));
  };

  /*
    Flipping the switch saves straight away, rather than arming a second button.
    It is a one-word decision about who may ring you, and leaving it looking
    flipped but unsaved is how people end up reachable when they meant not to be.
  */
  const toggleVisible = async () => {
    const next = !saved.visible;
    if (await save({ phone, visible: next })) showToast(t(next ? 'acc_phone_shown' : 'acc_phone_hidden'));
  };

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
        {pendingEmail && <PendingEmail email={pendingEmail} />}

        <div className="eyebrow" style={{ margin: '14px 0 2px' }}>{t('acc_details')}</div>
        <div className="card" style={{ paddingTop: 2, paddingBottom: 2 }}>
          <Row label={t('acc_name')} value={currentUser.name} />
          <Row label={t('acc_email')} value={email} />
          <Row label={t('acc_apartment')} value={currentUser.apartment || t('acc_not_set')} faint={!currentUser.apartment} />
          <Row label={t('acc_community')} value={data.community?.name || '—'} />
          <Row label={t('acc_role')} value={roleLabel} />
          <Row label={t('acc_signin')} value={signinLabel} last />
        </div>

        {/* Editable in place rather than behind another screen: it is one
            optional line, and burying it would guarantee nobody fills it in. */}
        <div className="eyebrow" style={{ margin: '18px 0 2px' }}>{t('acc_phone')}</div>
        <div className="card">
          <input className="input" type="tel" autoComplete="tel" inputMode="tel"
            value={phone} onChange={(e) => { setPhoneField(e.target.value); setPhoneErr(''); }} />
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>{t('acc_phone_hint')}</div>
          {phoneErr && <div style={{ color: 'var(--terracotta)', fontSize: 13, fontWeight: 600, marginTop: 8 }}>{phoneErr}</div>}
          {phoneChanged && (
            <button className="btn btn--primary" style={{ marginTop: 12 }} disabled={savingPhone} onClick={savePhone}>
              {t('save')}
            </button>
          )}

          {/* Offered only once there is a number, since there is nothing to
              share otherwise. */}
          {saved.phone && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{t('acc_phone_share')}</span>
                <Toggle on={saved.visible} onChange={toggleVisible} disabled={savingPhone} />
              </div>
              <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>
                {t(saved.visible ? 'acc_phone_share_on' : 'acc_phone_share_off')}
              </div>
            </div>
          )}
        </div>

        <div className="eyebrow" style={{ margin: '18px 0 2px' }}>{t('acc_manage')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Item icon="✉︎" label={t('email_change_title')} onClick={() => nav('/app/settings/email')} />
          <Item icon="🔑" label={hasPasswordLogin ? t('pw_change_title') : t('pw_set_title')} onClick={() => nav('/app/settings/password')} />
        </div>

        {/* Set apart, and last: it is the one action here that cannot be undone. */}
        <div className="eyebrow" style={{ margin: '22px 0 2px' }}>{t('acc_danger')}</div>
        <button onClick={() => nav('/app/settings/delete')} className="card"
          style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, width: '100%', color: 'var(--terracotta)' }}>
          <span style={{ fontSize: 19 }}>🗑</span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 14.5 }}>{t('acc_delete')}</span>
          <span className="faint" style={{ fontSize: 18 }}>›</span>
        </button>
      </div>
    </div>
  );
}
