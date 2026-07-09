import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';

export default function AnnouncementNew() {
  const nav = useNavigate();
  const { t, actions, isStaff } = useApp();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  if (!isStaff) { nav('/app/announcements'); return null; }

  const submit = () => {
    if (!title.trim() || !body.trim()) return;
    const id = actions.addAnnouncement({ title: title.trim(), body: body.trim() });
    nav('/app/announcements/' + id);
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('ann_create_title')} onBack={() => nav('/app/announcements')} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <label className="field-label">{t('ann_f_title')} <span className="faint">· {t('required')}</span></label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Curățenie generală scara A" style={{ marginBottom: 16 }} />
        <label className="field-label">{t('ann_f_body')} <span className="faint">· {t('required')}</span></label>
        <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Scrie mesajul pentru vecini…" style={{ marginBottom: 20 }} />
        <button className="btn btn--primary" onClick={submit} disabled={!title.trim() || !body.trim()}>{t('ann_publish')}</button>
      </div>
    </div>
  );
}
