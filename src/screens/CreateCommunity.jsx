import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell } from './AuthShell.jsx';

export default function CreateCommunity() {
  const nav = useNavigate();
  const { t, setAuthed, actions } = useApp();
  const [name, setName] = useState('');
  const [addr, setAddr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    actions.saveCommunity({ name: name.trim(), address: addr.trim() || name.trim() });
    setAuthed(true);
    nav('/app');
  };

  return (
    <AuthShell title={t('create_title')} sub={t('create_sub')}
      footer={<Link to="/join" style={{ color: 'var(--green-600)', fontWeight: 700, fontSize: 14 }}>{t('back')}</Link>}>
      <form onSubmit={submit}>
        <label className="field-label">{t('create_name')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aleea Castanilor 12" style={{ marginBottom: 14 }} />
        <label className="field-label">{t('create_addr')}</label>
        <input className="input" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="Str. …" style={{ marginBottom: 18 }} />
        <button className="btn btn--primary" type="submit" disabled={!name.trim()}>{t('create_cta')}</button>
      </form>
    </AuthShell>
  );
}
