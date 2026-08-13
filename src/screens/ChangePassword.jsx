import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, PasswordInput } from '../components/ui.jsx';

export default function ChangePassword() {
  const nav = useNavigate();
  const { t, changePassword, setNewPassword, hasPasswordLogin, showToast } = useApp();
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (hasPasswordLogin && !current) return setErr(t('pw_current_required'));
    if (pw.length < 6) return setErr(t('auth_pw_weak'));
    if (pw !== pw2) return setErr(t('pw_mismatch'));
    setBusy(true);
    try {
      // Google-only accounts have no existing password to verify against.
      if (hasPasswordLogin) await changePassword(current, pw);
      else await setNewPassword(pw);
      showToast(t('pw_changed'));
      nav('/app/settings');
    } catch (e2) {
      setErr(e2.message === 'wrong_current' ? t('pw_current_wrong') : t('pw_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={hasPasswordLogin ? t('pw_change_title') : t('pw_set_title')} onBack={() => nav('/app/settings')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        {!hasPasswordLogin && (
          <div className="card" style={{ background: 'var(--status-new-bg)', border: 'none', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--status-new-fg)' }}>
              {t('pw_google_note')}
            </p>
          </div>
        )}
        <form onSubmit={submit}>
          {hasPasswordLogin && (
            <>
              <label className="field-label">{t('pw_current')}</label>
              <PasswordInput value={current} autoComplete="current-password"
                onChange={(e) => { setCurrent(e.target.value); setErr(''); }} style={{ marginBottom: 18 }} />
            </>
          )}
          <label className="field-label">{t('pw_new')}</label>
          <PasswordInput value={pw} autoComplete="new-password"
            onChange={(e) => { setPw(e.target.value); setErr(''); }} style={{ marginBottom: 14 }} />
          <label className="field-label">{t('pw_confirm')}</label>
          <PasswordInput value={pw2} autoComplete="new-password"
            onChange={(e) => { setPw2(e.target.value); setErr(''); }} style={{ marginBottom: 16 }} />
          {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
          <button className="btn btn--primary" type="submit" disabled={busy}>{t('pw_save')}</button>
        </form>
      </div>
    </div>
  );
}
