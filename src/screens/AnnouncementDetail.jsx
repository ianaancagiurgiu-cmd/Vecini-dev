import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar, PriorityBadge } from '../components/ui.jsx';
import { formatDate, isPriority, eventDay, eventTime, isPast } from '../lib/format.js';
import { useBack } from '../lib/useBack.js';

/*
  One announcement — which, if it carries a date, is what used to be an event.

  Staff can hold it at the top of the list, but only until a day they name —
  there is no untimed version. That is the whole change: a flag somebody has to
  remember to clear becomes a statement about how long the notice matters, and
  the list tidies itself.

  Editing and deleting arrived here with the calendar. Announcements never had
  either, because a notice that turned out wrong was answered with another
  notice. Meetings are not like that: they get called off, and one left standing
  on the calendar is worse than no calendar.
*/

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span className="muted" style={{ fontSize: 13, flexShrink: 0, minWidth: 74 }}>{label}</span>
      <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{value}</span>
    </div>
  );
}

// <input type="date"> speaks YYYY-MM-DD and nothing else.
const asInputDate = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// End of the chosen day, not its first second: "until Thursday" includes Thursday.
const endOfDay = (value) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
};

export default function AnnouncementDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data, t, L, lang, userById, isStaff, actions } = useApp();
  const a = data.announcements.find((x) => x.id === id);
  // Two doors now: the noticeboard and the calendar. Naming one of them as
  // "back" would be right from one and wrong from the other.
  const goBack = useBack('/app/announcements');

  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!a) return <div className="screen"><ScreenHeader title={t('ann_title')} onBack={goBack} /><div className="pad" style={{ paddingTop: 20 }}>—</div></div>;
  const author = userById(a.authorId);
  const priority = isPriority(a);
  const dated = !!a.startsAt;
  const past = dated && isPast(a);

  const open = () => {
    setWhen(priority ? asInputDate(a.pinnedUntil) : asInputDate(Date.now() + 7 * 86400000));
    setErr('');
    setEditing(true);
  };

  const save = async () => {
    if (!when) return setErr(t('ann_priority_need'));
    const until = endOfDay(when);
    if (until <= Date.now()) return setErr(t('ann_priority_past'));
    setBusy(true);
    try { await actions.setPriority(a.id, until); setEditing(false); }
    catch { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  const release = async () => {
    setBusy(true);
    try { await actions.setPriority(a.id, null); setEditing(false); }
    catch { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await actions.removeAnnouncement(a.id); nav('/app/announcements'); }
    catch { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('ann_title')} onBack={goBack} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--status-done-bg)', color: 'var(--green-500)', padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>📢 {t('ann_official')}</span>
          {priority && <PriorityBadge until={a.pinnedUntil} t={t} lang={lang} />}
          {/* When it is, in the words the list uses — "Mâine", "joi", "A trecut". */}
          {dated && (
            <span className="badge" style={{ background: past ? 'var(--section-bg)' : 'var(--status-done-bg)', color: past ? 'var(--ink-400)' : 'var(--green-500)' }}>
              📅 {past ? t('ev_passed') : eventDay(a.startsAt, lang, t)}
            </span>
          )}
        </div>

        <h1 className="display" style={{ fontSize: 26, lineHeight: 1.15, margin: '0 0 16px' }}>{L(a, 'title')}</h1>

        {/* The when and the where, spelled out, above the message rather than
            buried in it — which is the whole reason the date became a field. */}
        {dated && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <Row label={t('ev_f_date')} value={
              a.allDay ? formatDate(a.startsAt, lang)
                : `${formatDate(a.startsAt, lang)} · ${eventTime(a.startsAt, lang)}`
            } />
            {a.endsAt && a.endsAt !== a.startsAt && (
              <Row label={t('ev_f_end')} value={
                a.allDay ? formatDate(a.endsAt, lang)
                  : `${formatDate(a.endsAt, lang)} · ${eventTime(a.endsAt, lang)}`
              } />
            )}
            {a.allDay && <Row label={t('ev_f_time')} value={t('ev_f_allday')} />}
            {a.location && <Row label={t('ev_f_loc')} value={a.location} />}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
          <Avatar user={author} size={42} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{author.name}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>{t('ann_published_by')} · {formatDate(a.createdAt, lang)}</div>
          </div>
        </div>

        <div style={{ fontSize: 15.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#3f433b' }}>{L(a, 'body')}</div>

        {/* The control used to be a bare pin emoji in the header, with no label
            and its state told only by colour. */}
        {isStaff && (
          <div style={{ marginTop: 26, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
            {!editing ? (
              // Stacked rather than side by side: at half a phone's width these
              // labels wrap to three cramped lines each.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => nav(`/app/announcements/${a.id}/edit`)} className="btn btn--ghost" style={{ padding: '12px', fontSize: 13.5 }}>
                  {t('ann_edit_title')}
                </button>
                <button onClick={open} className="btn btn--ghost" style={{ padding: '12px', fontSize: 13.5 }}>
                  {priority ? t('ann_priority_edit') : t('ann_priority_set')}
                </button>
                {priority && (
                  <button onClick={release} disabled={busy} className="btn btn--ghost"
                    style={{ padding: '12px', fontSize: 13.5, color: 'var(--terracotta)', opacity: busy ? .5 : 1 }}>
                    {t('ann_priority_clear')}
                  </button>
                )}
                {/* Behind a confirmation, because it is the one thing on this
                    screen that cannot be undone. */}
                {!confirming ? (
                  <button onClick={() => setConfirming(true)} className="btn btn--ghost"
                    style={{ padding: '12px', fontSize: 13.5, color: 'var(--terracotta)' }}>
                    {t('ann_remove')}
                  </button>
                ) : (
                  <div style={{ background: 'var(--section-bg)', borderRadius: 12, padding: 13 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{t('ann_remove_confirm')}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setConfirming(false)} className="btn btn--ghost" style={{ flex: 1, padding: '9px', fontSize: 13 }}>{t('cancel')}</button>
                      <button onClick={remove} disabled={busy} className="btn btn--terracotta"
                        style={{ flex: 1, padding: '9px', fontSize: 13, opacity: busy ? .5 : 1 }}>{t('ann_remove')}</button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: 'var(--section-bg)', borderRadius: 12, padding: 14 }}>
                <label htmlFor="prio-until" style={{ display: 'block', fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                  {t('ann_priority_label')}
                </label>
                <input id="prio-until" type="date" className="input" value={when}
                  min={asInputDate(Date.now())}
                  onChange={(e) => { setWhen(e.target.value); setErr(''); }} />
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginTop: 8 }}>{t('ann_priority_hint')}</div>
                {err && <div style={{ color: 'var(--terracotta)', fontSize: 13, fontWeight: 600, marginTop: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setEditing(false)} className="btn btn--ghost" style={{ flex: 1, padding: '10px', fontSize: 13.5 }}>{t('cancel')}</button>
                  <button onClick={save} disabled={busy || !when} className="btn btn--primary"
                    style={{ flex: 1, padding: '10px', fontSize: 13.5, opacity: (busy || !when) ? .5 : 1 }}>
                    {t('save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
