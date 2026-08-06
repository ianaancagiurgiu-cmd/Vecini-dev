import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';
import { CATEGORIES, catLabel, ISSUE_CATS } from '../lib/format.js';

export default function IssueNew() {
  const nav = useNavigate();
  const { t, actions } = useApp();
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('');
  const [loc, setLoc] = useState('');
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  const valid = title.trim() && desc.trim() && cat;
  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const id = await actions.addIssue({ title: title.trim(), category: cat, location: loc.trim() || '—', description: desc.trim(), photo });
      nav('/app/issues/' + id);
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      // Downscale to keep the image small enough for browser storage.
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        let { width, height } = img;
        if (width > max || height > max) {
          const s = max / Math.max(width, height);
          width = Math.round(width * s); height = Math.round(height * s);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        setPhoto(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => setPhoto(r.result);
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('iss_report_title')} onBack={() => nav('/app/issues')} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <label className="field-label">{t('iss_f_title')} <span className="faint">· {t('required')}</span></label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Bec ars pe scara A" style={{ marginBottom: 16 }} />

        <label className="field-label">{t('iss_f_type')} <span className="faint">· {t('required')}</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {ISSUE_CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={'pill' + (cat === c ? ' pill--active' : '')}>{CATEGORIES[c].icon} {catLabel(c, t)}</button>
          ))}
        </div>

        <label className="field-label">{t('iss_f_loc')} <span className="faint">· {t('optional')}</span></label>
        <input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ex: Scara A, parter" style={{ marginBottom: 16 }} />

        <label className="field-label">{t('iss_f_desc')} <span className="faint">· {t('required')}</span></label>
        <textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="Descrie problema…" style={{ marginBottom: 16 }} />

        <label className="field-label">{t('iss_f_photo')} <span className="faint">· {t('optional')}</span></label>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed var(--input-border)', borderRadius: 13, padding: photo ? 8 : 22, marginBottom: 20, cursor: 'pointer', background: 'var(--app-bg)' }}>
          {photo ? <img src={photo} alt="" style={{ maxHeight: 160, borderRadius: 10 }} /> : <span className="muted" style={{ fontSize: 14 }}>📷 {t('iss_f_photo')}</span>}
          <input type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
        </label>

        <button className="btn btn--terracotta" onClick={submit} disabled={!valid || busy}>{t('iss_submit')}</button>
      </div>
    </div>
  );
}
