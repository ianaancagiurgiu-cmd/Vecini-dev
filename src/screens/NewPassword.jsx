import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell } from './AuthShell.jsx';

// Shown after following a "reset password" link from email. The recovery
// session is already established at this point, so we only need the new
// password.
export default function NewPassword() {
  const nav = useNavigate();
  const { t, setNewPassword, showToast } = useApp();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 6) return setErr(t('auth_pw_weak'));
    if (pw !== pw2) return setErr(t('pw_mismatch'));
    setBusy(true);
    try {
      await setNewPassword(pw);
      showToast(t('pw_changed'));
      nav('/app');
    } catch (e2) {
      setErr(e2.message === 'same_password' ? t('pw_same') : t('pw_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t('pw_new_title')} sub={t('pw_new_sub')}>
      <form onSubmit={submit}>
        <label className="field-label">{t('pw_new')}</label>
        <input className="input" type="password" value={pw} autoComplete="new-password"
          onChange={(e) => { setPw(e.target.value); setErr(''); }} placeholder="••••••••" style={{ marginBottom: 14 }} />
        <label className="field-label">{t('pw_confirm')}</label>
        <input className="input" type="password" value={pw2} autoComplete="new-password"
          onChange={(e) => { setPw2(e.target.value); setErr(''); }} placeholder="••••••••" style={{ marginBottom: 16 }} />
        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={busy}>{t('pw_save')}</button>
      </form>
    </AuthShell>
  );
}
