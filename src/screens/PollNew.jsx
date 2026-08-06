import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';

export default function PollNew() {
  const nav = useNavigate();
  const { t, actions, isStaff } = useApp();
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [end, setEnd] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  if (!isStaff) { nav('/app/polls'); return null; }

  const setOpt = (i, v) => setOpts((cur) => cur.map((o, idx) => (idx === i ? v : o)));
  const addOpt = () => setOpts((cur) => [...cur, '']);
  const removeOpt = (i) => setOpts((cur) => cur.filter((_, idx) => idx !== i));
  const [busy, setBusy] = useState(false);
  const valid = q.trim() && opts.filter((o) => o.trim()).length >= 2 && end;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const id = await actions.addPoll({ question: q.trim(), options: opts.map((o) => o.trim()).filter(Boolean), multi, endsAt: new Date(end).getTime() });
      nav('/app/polls/' + id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('poll_create_title')} onBack={() => nav('/app/polls')} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <label className="field-label">{t('poll_f_q')} <span className="faint">· {t('required')}</span></label>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex: Schimbăm firma de curățenie?" style={{ marginBottom: 18 }} />

        <label className="field-label">{t('poll_f_opt')} <span className="faint">· min. 2</span></label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 10 }}>
          {opts.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Opțiunea ${i + 1}`} style={{ flex: 1 }} />
              {opts.length > 2 && <button onClick={() => removeOpt(i)} style={{ border: '1px solid var(--input-border)', background: '#fff', borderRadius: 11, width: 46, color: 'var(--ink-300)', fontSize: 18 }}>×</button>}
            </div>
          ))}
        </div>
        <button onClick={addOpt} style={{ background: 'none', border: 'none', color: 'var(--green-600)', fontWeight: 700, fontSize: 14, marginBottom: 18 }}>+ {t('poll_add_opt')}</button>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', border: '1px solid var(--input-border)', borderRadius: 13, marginBottom: 16, cursor: 'pointer' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t('poll_f_multi')}</span>
          <span onClick={() => setMulti(!multi)} style={{ width: 46, height: 27, borderRadius: 999, background: multi ? 'var(--green-600)' : 'var(--input-border)', position: 'relative', transition: '.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: multi ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
          </span>
        </label>

        <label className="field-label">{t('poll_f_end')} <span className="faint">· {t('required')}</span></label>
        <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ marginBottom: 20 }} />

        <button className="btn btn--primary" onClick={submit} disabled={!valid || busy}>{t('poll_launch')}</button>
      </div>
    </div>
  );
}
