import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell, GoogleButton, Divider } from './AuthShell.jsx';
import { PasswordInput } from '../components/ui.jsx';

export default function SignUp() {
  const nav = useNavigate();
  const { t, signUpEmail, resendSignupEmail, signInGoogle, showToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Set once the account is created and waiting on a confirmation email —
  // the address it went to, so the screen after can still say it.
  const [sentTo, setSentTo] = useState('');
  const [resending, setResending] = useState(false);

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
      if (needsConfirmation) setSentTo(email);
      else nav('/join');
    } catch (e2) {
      // The store tags this one, rather than us matching on an English sentence
      // that the auth service is free to reword.
      setErr(e2.code === 'email_taken' ? t('auth_email_taken') : e2.message);
    } finally {
      setBusy(false);
    }
  };
  const google = async () => { setErr(''); try { await signInGoogle(); } catch (e2) { setErr(e2.message); } };
  const resend = async () => {
    setResending(true);
    try { await resendSignupEmail(sentTo); showToast(t('auth_confirm_resent')); }
    catch (e2) { showToast(t('auth_confirm_resent')); } // rate-limited or not, nothing more to tell them
    finally { setResending(false); }
  };

  /*
    A toast that vanishes in three seconds was the whole message a new
    account got, immediately followed by a plain login form with no memory
    of why it was there. Whoever missed the toast — looking at the keyboard,
    not the screen — landed with an account that existed and no idea of it.
    This stays up until they leave, the way Forgot's own "sent" screen does.
  */
  if (sentTo) {
    return (
      <AuthShell title={t('auth_signup_title')} sub={t('auth_signup_sub')}>
        <div className="card" style={{ background: 'var(--status-done-bg)', border: 'none', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green-500)', marginBottom: 6 }}>
                {t('auth_confirm_sent')}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--green-500)', marginBottom: 6 }}>{sentTo}</div>
              <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--green-500)' }}>
                {t('auth_confirm_browser')}
              </p>
            </div>
          </div>
        </div>
        <button className="btn btn--primary" style={{ marginBottom: 10 }} onClick={() => nav('/login')}>
          {t('auth_confirm_cta')}
        </button>
        <button className="btn btn--ghost" disabled={resending} onClick={resend}>
          {resending ? t('auth_confirm_resending') : t('auth_confirm_resend')}
        </button>
      </AuthShell>
    );
  }

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
        <PasswordInput value={pw} autoComplete="new-password"
          onChange={(e) => { setPw(e.target.value); setErr(''); }} style={{ marginBottom: 14 }} />
        <label className="field-label">{t('auth_pw_confirm')}</label>
        <PasswordInput value={pw2} autoComplete="new-password"
          onChange={(e) => { setPw2(e.target.value); setErr(''); }} style={{ marginBottom: 16 }} />
        {err &&<div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={busy}>{t('auth_signup')}</button>
      </form>
    </AuthShell>
  );
}
