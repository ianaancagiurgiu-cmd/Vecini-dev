import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell, GoogleButton, Divider } from './AuthShell.jsx';
import { PasswordInput } from '../components/ui.jsx';

export default function SignUp() {
  const nav = useNavigate();
  const { t, signUpEmail, signInGoogle, showToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!name.trim()) return setErr(t('auth_name'));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr(t('auth_email_bad'));
    if (pw.length < 6) return setErr(t('auth_pw_weak'));
    // Checked before signing up: a typo here locks you out of a brand new
    // account, and with email delivery unreliable, recovery is not guaranteed.
    if (pw !== pw2) return setErr(t('pw_mismatch'));
    setBusy(true);
    try {
      const { needsConfirmation } = await signUpEmail(name.trim(), email, pw);
      if (needsConfirmation) {
        showToast(t('auth_confirm_sent'));
        nav('/login');
      } else {
        nav('/join');
      }
    } catch (e2) {
      setErr(e2.message?.includes('already registered') ? t('auth_email_taken') : e2.message);
    } finally {
      setBusy(false);
    }
  };
  const google = async () => { setErr(''); try { await signInGoogle(); } catch (e2) { setErr(e2.message); } };

  return (
    <AuthShell title={t('auth_signup_title')} sub={t('auth_signup_sub')}
      footer={<span style={{ fontSize: 14, color: 'var(--ink-400)' }}>{t('auth_have_account')} <Link to="/login" style={{ color: 'var(--green-600)', fontWeight: 700 }}>{t('auth_login_link')}</Link></span>}>
      <GoogleButton onClick={google} />
      <Divider label={t('auth_or')} />
      <form onSubmit={submit}>
        <label className="field-label">{t('auth_name')}</label>
        <input className="input" value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} style={{ marginBottom: 14 }} />
        <label className="field-label">{t('auth_email')}</label>
        <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} style={{ marginBottom: 14 }} />
        <label className="field-label">{t('auth_password')}</label>
        <PasswordInput value={pw} autoComplete="new-password" placeholder=""
          onChange={(e) => { setPw(e.target.value); setErr(''); }} style={{ marginBottom: 14 }} />
        <label className="field-label">{t('auth_pw_confirm')}</label>
        <PasswordInput value={pw2} autoComplete="new-password" placeholder=""
          onChange={(e) => { setPw2(e.target.value); setErr(''); }} style={{ marginBottom: 16 }} />
        {err &&<div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={busy}>{t('auth_signup')}</button>
      </form>
    </AuthShell>
  );
}
