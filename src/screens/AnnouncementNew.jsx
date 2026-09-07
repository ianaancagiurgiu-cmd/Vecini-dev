import { useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';
import { useBack } from '../lib/useBack.js';

/*
  Writing an announcement, and editing one, in the same form — they ask for
  exactly the same things, and two copies of a form is how the two drift apart.

  The date is optional and folded in rather than kept behind a separate screen.
  There used to be two forms, and so a decision to make before you could start
  typing: is "Adunarea generală pe 10" an announcement or an event? Nobody
  answers that consistently, and then neither list is complete. Now you write
  the notice, and if it happens at a particular moment you say when.

  On the clock: an all-day date is stored at midday rather than at midnight. The
  column holds absolute time, and a date pinned to midnight falls back onto the
  previous day for anyone whose device sits an hour behind. Midday survives a
  twelve-hour shift in either direction.
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

function Switch({ on, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', border: '1px solid var(--input-border)', borderRadius: 13, cursor: 'pointer' }}>
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        style={{ width: 46, height: 27, borderRadius: 999, border: 'none', padding: 0, background: on ? 'var(--green-600)' : 'var(--input-border)', position: 'relative', transition: '.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
      </button>
    </label>
  );
}

export default function AnnouncementNew() {
  const nav = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, t, actions, isStaff } = useApp();

  const existing = id ? data.announcements.find((a) => a.id === id) : null;
  const editing = !!existing;

  const [title, setTitle] = useState(existing?.title || '');
  const [body, setBody] = useState(existing?.body || '');
  // Open already when the writer came here to put something in the calendar,
  // so that entry point still leads somewhere that looks like what it promised.
  const [dated, setDated] = useState(editing ? !!existing.startsAt : params.get('date') === '1');
  const [allDay, setAllDay] = useState(existing?.allDay || false);
  const [date, setDate] = useState(
    existing?.startsAt ? toDateInput(existing.startsAt) : toDateInput(Date.now() + 7 * 86400000),
  );
  const [time, setTime] = useState(
    existing?.startsAt && !existing.allDay ? toTimeInput(existing.startsAt) : '18:00',
  );
  const [endDate, setEndDate] = useState(existing?.endsAt ? toDateInput(existing.endsAt) : '');
  const [endTime, setEndTime] = useState(existing?.endsAt && !existing.allDay ? toTimeInput(existing.endsAt) : '');
  const [loc, setLoc] = useState(existing?.location || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  /*
    Opened from the noticeboard, from the calendar, or from the dashboard, so
    there is no one address that is the way back. Retrace the step instead.

    Above the redirects below, not beside the handlers: a hook skipped on the
    renders that return early is a different number of hooks each time, which
    React counts rather than names.
  */
  const back = useBack(editing ? `/app/announcements/${id}` : '/app/announcements');

  // Someone who types the address in is sent back, rather than shown a form
  // whose save the database would refuse anyway.
  if (!isStaff) return <Navigate to="/app/announcements" replace />;
  if (id && !existing) return <Navigate to="/app/announcements" replace />;

  const submit = async () => {
    setErr('');
    if (!title.trim()) return setErr(t('ann_need_title'));
    if (dated && !date) return setErr(t('ev_need_date'));

    const startsAt = dated ? combine(date, time, allDay) : null;
    const endsAt = dated && endDate ? combine(endDate, endTime || time, allDay) : null;
    if (endsAt && endsAt < startsAt) return setErr(t('ev_end_before'));

    const payload = {
      title: title.trim(),
      body: body.trim(),
      startsAt,
      endsAt,
      allDay: dated && allDay,
      location: dated ? loc.trim() : '',
    };
    setBusy(true);
    try {
      if (editing) { await actions.updateAnnouncement(id, payload); nav('/app/announcements/' + id); }
      else { const newId = await actions.addAnnouncement(payload); nav('/app/announcements/' + newId); }
    } catch { /* the store has already said so */ }
    finally { setBusy(false); }
  };


  return (
    <div className="screen">
      <ScreenHeader title={editing ? t('ann_edit_title') : t('ann_create_title')} onBack={back} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <label className="field-label" htmlFor="ann-title">
          {t('ann_f_title')} <span className="faint">· {t('required')}</span>
        </label>
        <input id="ann-title" className="input" value={title}
          onChange={(e) => { setTitle(e.target.value); setErr(''); }}
          placeholder="Ex: Adunarea generală" style={{ marginBottom: 16 }} />

        {/* Optional now. With a date attached the title often says the whole
            thing — "Deratizare la subsol" needs no paragraph under it. */}
        <label className="field-label" htmlFor="ann-body">
          {t('ann_f_body')} <span className="faint">· {t('optional')}</span>
        </label>
        <textarea id="ann-body" className="input" rows={7} value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scrie mesajul pentru vecini…" style={{ marginBottom: 20, resize: 'vertical' }} />

        <Switch on={dated} onChange={(v) => { setDated(v); setErr(''); }} label={t('ann_has_date')} />
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, margin: '6px 0 18px' }}>{t('ann_date_hint')}</div>

        {dated && (
          <>
            <label className="field-label" htmlFor="ann-date">
              {t('ev_f_date')} <span className="faint">· {t('required')}</span>
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input id="ann-date" className="input" type="date" value={date}
                onChange={(e) => { setDate(e.target.value); setErr(''); }} style={{ flex: 1 }} />
              {!allDay && (
                <input id="ann-time" className="input" type="time" value={time}
                  onChange={(e) => setTime(e.target.value)} style={{ width: 122 }} aria-label={t('ev_f_time')} />
              )}
            </div>

            <Switch on={allDay} onChange={setAllDay} label={t('ev_f_allday')} />
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, margin: '6px 0 18px' }}>{t('ev_allday_hint')}</div>

            <label className="field-label" htmlFor="ann-end">
              {t('ev_f_end')} <span className="faint">· {t('optional')}</span>
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <input id="ann-end" className="input" type="date" value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setErr(''); }} style={{ flex: 1 }} />
              {!allDay && endDate && (
                <input className="input" type="time" value={endTime}
                  onChange={(e) => setEndTime(e.target.value)} style={{ width: 122 }} aria-label={t('ev_f_end')} />
              )}
            </div>

            <label className="field-label" htmlFor="ann-loc">
              {t('ev_f_loc')} <span className="faint">· {t('optional')}</span>
            </label>
            <input id="ann-loc" className="input" value={loc} onChange={(e) => setLoc(e.target.value)}
              placeholder="Ex: Holul scării A" style={{ marginBottom: 18 }} />
          </>
        )}

        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{err}</div>}

        <button className="btn btn--primary" onClick={submit} disabled={busy || !title.trim()}>
          {editing ? t('ann_save') : t('ann_publish')}
        </button>
      </div>
    </div>
  );
}
