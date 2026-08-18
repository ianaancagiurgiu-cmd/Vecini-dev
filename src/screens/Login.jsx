import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell, GoogleButton, Divider } from './AuthShell.jsx';
import { PasswordInput } from '../components/ui.jsx';

export default function Login() {
  const nav = useNavigate();
  const { t, signInEmail, signInGoogle } = useApp();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr(t('auth_email_bad'));
    setBusy(true);
    try {
      await signInEmail(email, pw);
      nav('/app');
    } catch (e2) {
      setErr(t('auth_bad_creds'));
    } finally {
      setBusy(false);
    }
  };
  const google = async () => { setErr(''); try { await signInGoogle(); } catch (e2) { setErr(e2.message); } };

  return (
    <AuthShell title={t('auth_welcome_back')} sub={t('auth_login_sub')}
      footer={<span style={{ fontSize: 14, color: 'var(--ink-400)' }}>{t('auth_no_account')} <Link to="/signup" style={{ color: 'var(--green-600)', fontWeight: 700 }}>{t('auth_signup_link')}</Link></span>}>
      <GoogleButton onClick={google} />
      <Divider label={t('auth_or')} />
      <form onSubmit={submit}>
        <label className="field-label">{t('auth_email')}</label>
        <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} style={{ marginBottom: 14 }} />
        <label className="field-label">{t('auth_password')}</label>
        <PasswordInput value={pw} autoComplete="current-password" placeholder=""
          onChange={(e) => { setPw(e.target.value); setErr(''); }} style={{ marginBottom: 8 }} />
        <div style={{ textAlign: 'right', marginBottom: 16 }}>
          <Link to="/forgot" style={{ fontSize: 13.5, color: 'var(--green-600)', fontWeight: 600 }}>{t('auth_forgot')}</Link>
        </div>
        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={busy}>{t('auth_login')}</button>
      </form>
    </AuthShell>
  );
}
