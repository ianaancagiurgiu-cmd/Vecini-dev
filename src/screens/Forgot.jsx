import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function Forgot() {
  const { t, sendPasswordReset } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => { e.preventDefault(); await sendPasswordReset(email); setSent(true); };

  return (
    <AuthShell title={t('auth_forgot_title')} sub={t('auth_forgot_sub')}
      footer={<Link to="/login" style={{ color: 'var(--green-600)', fontWeight: 700, fontSize: 14 }}>{t('auth_login_link')}</Link>}>
      {sent ? (
        <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--status-done-bg)', border: 'none' }}>
          <span style={{ fontSize: 22 }}>✅</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green-500)' }}>{t('auth_forgot_sent')}</span>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label className="field-label">{t('auth_email')}</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@exemplu.ro" style={{ marginBottom: 16 }} />
          <button className="btn btn--primary" type="submit">{t('auth_send_reset')}</button>
        </form>
      )}
    </AuthShell>
  );
}
