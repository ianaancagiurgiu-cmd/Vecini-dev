import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar } from '../components/ui.jsx';
import { CATEGORIES, catLabel, DISC_CATS, timeAgo } from '../lib/format.js';

export default function DiscussionNew() {
  const nav = useNavigate();
  const { t, actions, currentUser, lang } = useApp();
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);

  const valid = title.trim() && cat && body.trim();
  const submit = () => { if (!valid) return; const id = actions.addDiscussion({ title: title.trim(), category: cat, body: body.trim() }); nav('/app/discussions/' + id); };

  return (
    <div className="screen">
      <ScreenHeader title={t('disc_create_title')} onBack={() => nav('/app/discussions')} />
      <div className="pad" style={{ paddingTop: 20 }}>
        {preview ? (
          <>
            <div className="card">
              <span className="badge" style={{ background: (CATEGORIES[cat] || CATEGORIES.general).bg, color: (CATEGORIES[cat] || CATEGORIES.general).fg, marginBottom: 10 }}>{(CATEGORIES[cat] || {}).icon} {catLabel(cat, t)}</span>
              <h2 className="serif" style={{ fontSize: 19, fontWeight: 600, margin: '10px 0 12px' }}>{title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Avatar user={currentUser} size={32} />
                <span className="muted" style={{ fontSize: 13 }}>{currentUser.name} · {timeAgo(Date.now(), t, lang)}</span>
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, color: '#3f433b', whiteSpace: 'pre-wrap' }}>{body}</div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn--ghost" onClick={() => setPreview(false)} style={{ flex: 1 }}>{t('edit')}</button>
              <button className="btn btn--primary" onClick={submit} style={{ flex: 1 }}>{t('disc_publish')}</button>
            </div>
          </>
        ) : (
          <>
            <label className="field-label">{t('disc_f_title')} <span className="faint">· {t('required')}</span></label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Idei pentru locul de joacă" style={{ marginBottom: 16 }} />
            <label className="field-label">{t('disc_f_cat')} <span className="faint">· {t('required')}</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {DISC_CATS.map((c) => (
                <button key={c} onClick={() => setCat(c)} className={'pill' + (cat === c ? ' pill--active' : '')}>{CATEGORIES[c].icon} {catLabel(c, t)}</button>
              ))}
            </div>
            <label className="field-label">{t('disc_f_body')} <span className="faint">· {t('required')}</span></label>
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Descrie subiectul…" style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn--ghost" onClick={() => setPreview(true)} disabled={!valid} style={{ flex: 1 }}>{t('disc_preview')}</button>
              <button className="btn btn--primary" onClick={submit} disabled={!valid} style={{ flex: 1 }}>{t('disc_publish')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
