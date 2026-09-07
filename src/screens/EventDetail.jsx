import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar } from '../components/ui.jsx';
import { eventDay, eventTime, isPast, formatDate } from '../lib/format.js';

export default function EventDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data, t, lang, userById, isStaff, actions } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const ev = data.events.find((e) => e.id === id);
  if (!ev) {
    return (
      <div className="screen">
        <ScreenHeader title={t('ev_title')} onBack={() => nav('/app/calendar')} />
        <div className="pad" style={{ paddingTop: 20 }}>—</div>
      </div>
    );
  }

  const author = userById(ev.authorId);
  const past = isPast(ev);

  const remove = async () => {
    setBusy(true);
    try { await actions.removeEvent(ev.id); nav('/app/calendar'); }
    catch { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('ev_title')} onBack={() => nav('/app/calendar')} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <span className="badge" style={{ background: past ? 'var(--section-bg)' : 'var(--status-done-bg)', color: past ? 'var(--ink-400)' : 'var(--green-500)' }}>
            📅 {past ? t('ev_passed') : eventDay(ev.startsAt, lang, t)}
          </span>
          {ev.allDay && <span className="badge" style={{ background: 'var(--section-bg)', color: 'var(--ink-400)' }}>{t('ev_f_allday')}</span>}
        </div>

        <h1 className="display" style={{ fontSize: 26, lineHeight: 1.15, margin: '0 0 16px' }}>{ev.title}</h1>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <Row label={t('ev_f_date')} value={
            ev.allDay
              ? formatDate(ev.startsAt, lang)
              : `${formatDate(ev.startsAt, lang)} · ${eventTime(ev.startsAt, lang)}`
          } />
          {ev.endsAt && ev.endsAt !== ev.startsAt && (
            <Row label={t('ev_f_end')} value={
              ev.allDay ? formatDate(ev.endsAt, lang) : `${formatDate(ev.endsAt, lang)} · ${eventTime(ev.endsAt, lang)}`
            } />
          )}
          {ev.location && <Row label={t('ev_f_loc')} value={ev.location} />}
        </div>

        {ev.description && (
          <div style={{ fontSize: 15.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#3f433b', marginBottom: 20 }}>
            {ev.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Avatar user={author} size={38} />
          <div className="faint" style={{ fontSize: 12.5 }}>
            {t('ev_added_by')} {author.name}
          </div>
        </div>

        {isStaff && (
          <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => nav(`/app/calendar/${ev.id}/edit`)} className="btn btn--ghost" style={{ padding: '12px', fontSize: 13.5 }}>
              {t('ev_edit_title')}
            </button>
            {!confirming ? (
              <button onClick={() => setConfirming(true)} className="btn btn--ghost"
                style={{ padding: '12px', fontSize: 13.5, color: 'var(--terracotta)' }}>
                {t('ev_remove')}
              </button>
            ) : (
              <div style={{ background: 'var(--section-bg)', borderRadius: 12, padding: 13 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{t('ev_remove_confirm')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirming(false)} className="btn btn--ghost" style={{ flex: 1, padding: '9px', fontSize: 13 }}>{t('cancel')}</button>
                  <button onClick={remove} disabled={busy} className="btn btn--terracotta"
                    style={{ flex: 1, padding: '9px', fontSize: 13, opacity: busy ? .5 : 1 }}>{t('ev_remove')}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
      <span className="muted" style={{ fontSize: 13, flexShrink: 0, minWidth: 74 }}>{label}</span>
      <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{value}</span>
    </div>
  );
}
