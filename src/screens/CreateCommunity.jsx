import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function CreateCommunity() {
  const nav = useNavigate();
  const { t, createCommunity, authed, authLoading } = useApp();
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (authLoading) return null;
  if (!authed) return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createCommunity(name.trim(), addr.trim());
      nav('/app');
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t('create_title')} sub={t('create_sub')}
      footer={<Link to="/join" style={{ color: 'var(--green-600)', fontWeight: 700, fontSize: 14 }}>{t('back')}</Link>}>
      <form onSubmit={submit}>
        <label className="field-label">{t('create_name')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aleea Castanilor 12" style={{ marginBottom: 14 }} />
        <label className="field-label">{t('create_addr')}</label>
        <input className="input" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Str. …" style={{ marginBottom: 18 }} />
        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={!name.trim() || busy}>{t('create_cta')}</button>
      </form>
    </AuthShell>
  );
}
