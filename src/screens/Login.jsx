import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell, GoogleButton, Divider } from './AuthShell.jsx';
import { PasswordInput } from '../components/ui.jsx';

export default function Login() {
  const nav = useNavigate();
  const { t, signInEmail, resendSignupEmail, signInGoogle, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Set when the account itself is fine and only unconfirmed — a different
  // situation from a wrong password, and one with something to do about it
  // right here, rather than a dead end.
  const [unconfirmed, setUnconfirmed] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setUnconfirmed(false);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr(t('auth_email_bad'));
    setBusy(true);
    try {
      await signInEmail(email, pw);
      nav('/app');
    } catch (e2) {
      // Supabase answers an unconfirmed address with the same shape as a
      // wrong password — told apart here, or a brand new account hears
      // "wrong password" the first time it tries to sign in, which it never
      // typed wrong at all.
      if (e2.code === 'email_not_confirmed') setUnconfirmed(true);
      else setErr(t('auth_bad_creds'));
    } finally {
      setBusy(false);
    }
  };
  const google = async () => { setErr(''); try { await signInGoogle(); } catch (e2) { setErr(e2.message); } };
  const resend = async () => {
    try { await resendSignupEmail(email); showToast(t('auth_confirm_resent')); }
    catch (e2) { showToast(t('auth_confirm_resent')); }
  };

  return (
    <AuthShell title={t('auth_welcome_back')} sub={t('auth_login_sub')}
      footer={<span style={{ fontSize: 14, color: 'var(--ink-400)' }}>{t('auth_no_account')} <Link to="/signup" style={{ color: 'var(--green-600)', fontWeight: 700 }}>{t('auth_signup_link')}</Link></span>}>
      <GoogleButton onClick={google} />
      <Divider label={t('auth_or')} />
      <form onSubmit={submit}>
        <label className="field-label">{t('auth_email')}</label>
        <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); setUnconfirmed(false); }} style={{ marginBottom: 14 }} />
        <label className="field-label">{t('auth_password')}</label>
        <PasswordInput value={pw} autoComplete="current-password"
          onChange={(e) => { setPw(e.target.value); setErr(''); setUnconfirmed(false); }} style={{ marginBottom: 8 }} />
        <div style={{ textAlign: 'right', marginBottom: 16 }}>
          <Link to="/forgot" style={{ fontSize: 13.5, color: 'var(--green-600)', fontWeight: 600 }}>{t('auth_forgot')}</Link>
        </div>
        {unconfirmed && (
          <div className="card" style={{ background: 'var(--status-new-bg)', border: 'none', marginBottom: 14 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, color: 'var(--status-new-fg)' }}>
              {t('auth_not_confirmed')}
            </p>
            <button type="button" className="btn" style={{ width: 'auto', padding: '9px 14px', fontSize: 13.5 }} onClick={resend}>
              {t('auth_confirm_resend')}
            </button>
          </div>
        )}
        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={busy}>{t('auth_login')}</button>
      </form>
    </AuthShell>
  );
}
