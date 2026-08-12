import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function Join() {
  const nav = useNavigate();
  const { t, joinByCode, authed, authLoading } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [joining, setJoining] = useState(false);

  if (authLoading) return null;
  if (!authed) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setJoining(true);
    try {
      await joinByCode(code);
      nav('/app');
    } catch (e2) {
      setErr(t('join_bad_code'));
      setJoining(false);
    }
  };

  if (joining) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '4px solid var(--border)', borderTopColor: 'var(--green-600)', animation: 'spin .8s linear infinite' }} />
        <div className="serif" style={{ fontSize: 20, color: 'var(--green-ink)' }}>{t('join_prepare')}</div>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  return (
    <AuthShell title={t('join_title')} sub={t('join_sub')}
      footer={<Link to="/create" style={{ color: 'var(--green-600)', fontWeight: 700, fontSize: 14 }}>{t('join_create')}</Link>}>
      <form onSubmit={submit}>
        <label className="field-label">{t('join_code_label')}</label>
        <input className="input" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }}
          placeholder="CASTANI-12"
          style={{ marginBottom: 16, fontSize: 20, fontWeight: 700, letterSpacing: '1.5px', textAlign: 'center', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }} />
        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={!code.trim()}>{t('join_cta')}</button>
      </form>
    </AuthShell>
  );
}
