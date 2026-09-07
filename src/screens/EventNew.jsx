import { useState } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';

/*
  Creating and editing are the same form, because they ask for exactly the same
  things and keeping two copies of a form is how the two drift apart.

  On the clock: an all-day event is stored at midday rather than at midnight.
  The column holds absolute time, and a date pinned to midnight falls back onto
  the previous day for anyone whose device sits an hour behind. Midday survives
  a twelve-hour shift in either direction.
*/

const NOON = 12;

const toDateInput = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toTimeInput = (ts) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const combine = (date, time, allDay) => {
  const [y, m, d] = date.split('-').map(Number);
  if (allDay) return new Date(y, m - 1, d, NOON, 0, 0, 0).getTime();
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
};

export default function EventNew() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data, t, actions, isStaff } = useApp();

  const existing = id ? data.events.find((e) => e.id === id) : null;
  const editing = !!existing;

  const [title, setTitle] = useState(existing?.title || '');
  const [desc, setDesc] = useState(existing?.description || '');
  const [loc, setLoc] = useState(existing?.location || '');
  const [allDay, setAllDay] = useState(existing?.allDay || false);
  const [date, setDate] = useState(
    existing ? toDateInput(existing.startsAt) : toDateInput(Date.now() + 7 * 86400000),
  );
  const [time, setTime] = useState(existing && !existing.allDay ? toTimeInput(existing.startsAt) : '18:00');
  const [endDate, setEndDate] = useState(existing?.endsAt ? toDateInput(existing.endsAt) : '');
  const [endTime, setEndTime] = useState(
    existing?.endsAt && !existing.allDay ? toTimeInput(existing.endsAt) : '',
  );
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // A member who types the address in gets sent back rather than shown a form
  // whose save the database would refuse.
  if (!isStaff) return <Navigate to="/app/calendar" replace />;
  if (id && !existing) return <Navigate to="/app/calendar" replace />;

  const submit = async () => {
    setErr('');
    if (!title.trim()) return setErr(t('ev_need_title'));
    if (!date) return setErr(t('ev_need_date'));

    const startsAt = combine(date, time, allDay);
    const endsAt = endDate ? combine(endDate, endTime || time, allDay) : null;
    if (endsAt && endsAt < startsAt) return setErr(t('ev_end_before'));

    const payload = {
      title: title.trim(), description: desc.trim(), location: loc.trim(),
      startsAt, endsAt, allDay,
    };
    setBusy(true);
    try {
      if (editing) { await actions.updateEvent(id, payload); nav('/app/calendar/' + id); }
      else { const newId = await actions.addEvent(payload); nav('/app/calendar/' + newId); }
    } catch { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  const back = () => nav(editing ? `/app/calendar/${id}` : '/app/calendar');

  return (
    <div className="screen">
      <ScreenHeader title={editing ? t('ev_edit_title') : t('ev_create_title')} onBack={back} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <label className="field-label" htmlFor="ev-title">
          {t('ev_f_title')} <span className="faint">· {t('required')}</span>
        </label>
        <input id="ev-title" className="input" value={title} onChange={(e) => { setTitle(e.target.value); setErr(''); }}
          placeholder="Ex: Adunarea generală" style={{ marginBottom: 18 }} />

        <label className="field-label" htmlFor="ev-date">
          {t('ev_f_date')} <span className="faint">· {t('required')}</span>
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input id="ev-date" className="input" type="date" value={date}
            onChange={(e) => { setDate(e.target.value); setErr(''); }} style={{ flex: 1 }} />
          {!allDay && (
            <input id="ev-time" className="input" type="time" value={time}
              onChange={(e) => setTime(e.target.value)} style={{ width: 122 }} aria-label={t('ev_f_time')} />
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', border: '1px solid var(--input-border)', borderRadius: 13, marginBottom: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t('ev_f_allday')}</span>
          <button type="button" role="switch" aria-checked={allDay} aria-label={t('ev_f_allday')}
            onClick={() => setAllDay(!allDay)}
            style={{ width: 46, height: 27, borderRadius: 999, border: 'none', padding: 0, background: allDay ? 'var(--green-600)' : 'var(--input-border)', position: 'relative', transition: '.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, left: allDay ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
          </button>
        </label>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 18 }}>{t('ev_allday_hint')}</div>

        <label className="field-label" htmlFor="ev-end">
          {t('ev_f_end')} <span className="faint">· {t('optional')}</span>
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <input id="ev-end" className="input" type="date" value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setErr(''); }} style={{ flex: 1 }} />
          {!allDay && endDate && (
            <input className="input" type="time" value={endTime}
              onChange={(e) => setEndTime(e.target.value)} style={{ width: 122 }} aria-label={t('ev_f_end')} />
          )}
        </div>

        <label className="field-label" htmlFor="ev-loc">
          {t('ev_f_loc')} <span className="faint">· {t('optional')}</span>
        </label>
        <input id="ev-loc" className="input" value={loc} onChange={(e) => setLoc(e.target.value)}
          placeholder="Ex: Holul scării A" style={{ marginBottom: 18 }} />

        <label className="field-label" htmlFor="ev-desc">
          {t('ev_f_desc')} <span className="faint">· {t('optional')}</span>
        </label>
        <textarea id="ev-desc" className="input" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="Ex: Pe ordinea de zi: bugetul pentru acoperiș." style={{ marginBottom: 18, resize: 'vertical' }} />

        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{err}</div>}

        <button className="btn btn--primary" onClick={submit} disabled={busy}>
          {editing ? t('ev_save') : t('ev_publish')}
        </button>
      </div>
    </div>
  );
}
