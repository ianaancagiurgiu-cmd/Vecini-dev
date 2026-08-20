import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, PasswordInput } from '../components/ui.jsx';
import PendingEmail from '../components/PendingEmail.jsx';

/*
  Changing the sign-in address.

  Nothing moves when the form is submitted. Supabase emails a confirmation link
  to the new address, and the account only follows once that link is opened, so
  this screen's job ends with saying clearly that the change is waiting in an
  inbox rather than done.
*/

export default function ChangeEmail() {
  const nav = useNavigate();
  const { t, session, changeEmail, hasPasswordLogin, pendingEmail, showToast } = useApp();
  const current = session?.user?.email || '';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setErr(t('auth_email_bad'));
    if (!pw) return setErr(t('pw_current_required'));
    setBusy(true);
    try {
      const next = await changeEmail(pw, email);
      setSentTo(next);
      setPw('');
      showToast(t('email_change_sent').replace('{email}', next));
    } catch (e2) {
      if (e2.message === 'wrong_current') setErr(t('pw_current_wrong'));
      else if (e2.code === 'email_same') setErr(t('email_same'));
      else if (e2.code === 'email_taken') setErr(t('auth_email_taken'));
      else setErr(t('email_error'));
    } finally {
      setBusy(false);
    }
  };

  /*
    A Google account's address belongs to Google: changing it here would leave
    the two disagreeing about who the person is. Setting a password first turns
    it into an account this app can actually manage, so that is what we point at.
  */
  if (!hasPasswordLogin) {
    return (
      <div className="screen">
        <ScreenHeader title={t('email_change_title')} onBack={() => nav('/app/settings/account')} />
        <div className="pad" style={{ paddingTop: 18 }}>
          <div className="card" style={{ background: 'var(--status-new-bg)', border: 'none', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--status-new-fg)' }}>
              {t('email_google_note')}
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => nav('/app/settings/password')}>{t('pw_set_title')}</button>
        </div>
      </div>
    );
  }

  const waitingFor = sentTo || pendingEmail;

  return (
    <div className="screen">
      <ScreenHeader title={t('email_change_title')} onBack={() => nav('/app/settings/account')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        {waitingFor && <PendingEmail email={waitingFor} />}

        <p className="muted" style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.55 }}>{t('email_change_sub')}</p>

        <form onSubmit={submit}>
          <label className="field-label">{t('email_current')}</label>
          <input className="input" value={current} readOnly disabled style={{ marginBottom: 18 }} />

          <label className="field-label">{t('email_new')}</label>
          <input className="input" type="email" autoComplete="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setErr(''); }} style={{ marginBottom: 18 }} />

          <label className="field-label">{t('pw_current')}</label>
          <PasswordInput value={pw} autoComplete="current-password"
            onChange={(e) => { setPw(e.target.value); setErr(''); }} style={{ marginBottom: 8 }} />
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 16 }}>{t('email_pw_note')}</div>

          {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
          <button className="btn btn--primary" type="submit" disabled={busy}>{t('email_change_cta')}</button>
        </form>
      </div>
    </div>
  );
}
