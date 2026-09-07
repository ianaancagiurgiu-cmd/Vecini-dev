import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Empty } from '../components/ui.jsx';
import { eventDay, eventTime, isPast, daysBetween } from '../lib/format.js';

/*
  What the association has coming up.

  Until this existed, the date of a general meeting lived inside the sentence of
  an announcement, so nothing could sort by it and a meeting held last month
  looked exactly like one next week. Here the date is the thing the list is
  built on.
*/

function DateBlock({ ts, dim, lang }) {
  const d = new Date(ts);
  const soon = !dim && daysBetween(ts) <= 1;
  return (
    <div style={{
      width: 52, flexShrink: 0, borderRadius: 12, padding: '7px 0', textAlign: 'center',
      background: dim ? 'var(--section-bg)' : soon ? 'var(--green-600)' : 'var(--status-done-bg)',
      color: dim ? 'var(--ink-300)' : soon ? '#fff' : 'var(--green-500)',
    }}>
      <div className="display" style={{ fontSize: 21, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
        {d.getDate()}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginTop: 1 }}>
        {d.toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'hu' ? 'hu-HU' : 'ro-RO', { month: 'short' }).replace('.', '')}
      </div>
    </div>
  );
}

function EventCard({ ev, past, onClick }) {
  const { t, lang } = useApp();
  return (
    <button onClick={onClick} className="card"
      style={{ textAlign: 'left', display: 'flex', gap: 13, alignItems: 'flex-start', opacity: past ? .72 : 1 }}>
      <DateBlock ts={ev.startsAt} dim={past} lang={lang} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{ev.title}</div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
          {eventDay(ev.startsAt, lang, t)}
          {!ev.allDay && ` · ${eventTime(ev.startsAt, lang)}`}
          {ev.allDay && ` · ${t('ev_f_allday').toLowerCase()}`}
        </div>
        {ev.location && (
          <div className="faint" style={{ fontSize: 12.5, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📍 {ev.location}
          </div>
        )}
      </div>
    </button>
  );
}

export default function Calendar() {
  const nav = useNavigate();
  const { data, t, isStaff } = useApp();

  const upcoming = data.events.filter((e) => !isPast(e));
  // Most recent first going backwards, which is the order you look for them in.
  const past = data.events.filter(isPast).slice().reverse();

  return (
    <div className="screen">
      <ScreenHeader title={t('ev_title')}
        right={isStaff ? <AddButton onClick={() => nav('/app/calendar/new')} label={t('ev_new')} /> : null} />
      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>{t('ev_upcoming')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {upcoming.length === 0 && <Empty icon="📅">{t('ev_empty')}</Empty>}
          {upcoming.map((e) => (
            <EventCard key={e.id} ev={e} onClick={() => nav('/app/calendar/' + e.id)} />
          ))}
        </div>

        {past.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '26px 0 12px' }}>{t('ev_past')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {past.map((e) => (
                <EventCard key={e.id} ev={e} past onClick={() => nav('/app/calendar/' + e.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
