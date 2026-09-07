import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Empty, PriorityBadge } from '../components/ui.jsx';
import ArchiveButton from '../components/ArchiveButton.jsx';
import { timeAgo, isPriority, eventDay, eventTime, isPast, daysBetween } from '../lib/format.js';

/*
  Everything the association says, and two ways of looking at it.

  "Toate" is the noticeboard, newest first, priority on top. "Calendar" is the
  same announcements filtered to the ones with a date, in date order. Not a
  second section with a second table behind it — the calendar was that once, and
  it meant deciding, for every notice, which of the two places it belonged in.
  Nobody answers that consistently, and then neither list can be trusted.

  The two orders are why this is a view and not a merge: a noticeboard reads
  backwards from now, a calendar reads forwards. Sorted together, either the
  newest notice buries next week's meeting or a meeting written three months ago
  sits at the top of a list called "recent".
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

function DatedCard({ a, past, t, lang, L, onClick }) {
  return (
    <button onClick={onClick} className="card"
      style={{ textAlign: 'left', display: 'flex', gap: 13, alignItems: 'flex-start', opacity: past ? .72 : 1 }}>
      <DateBlock ts={a.startsAt} dim={past} lang={lang} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{L(a, 'title')}</div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
          {eventDay(a.startsAt, lang, t)}
          {!a.allDay && ` · ${eventTime(a.startsAt, lang)}`}
          {a.allDay && ` · ${t('ev_f_allday').toLowerCase()}`}
        </div>
        {a.location && (
          <div className="faint" style={{ fontSize: 12.5, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📍 {a.location}
          </div>
        )}
      </div>
    </button>
  );
}

export default function Announcements() {
  const nav = useNavigate();
  const loc = useLocation();
  const { data, t, L, lang, isStaff, userById } = useApp();
  const [showArchived, setShowArchived] = useState(false);

  const calendar = loc.pathname.endsWith('/calendar');
  const archivedIds = new Set(data.archived.announcement);
  const archivedCount = data.announcements.filter((a) => archivedIds.has(a.id)).length;
  const viewingArchive = !calendar && showArchived && archivedCount > 0;

  const list = data.announcements
    .filter((a) => archivedIds.has(a.id) === viewingArchive)
    .sort((a, b) => (isPriority(b) - isPriority(a)) || (b.createdAt - a.createdAt));

  const dated = data.announcements.filter((a) => a.startsAt);
  const upcoming = dated.filter((a) => !isPast(a)).sort((a, b) => a.startsAt - b.startsAt);
  // Most recent first going backwards, which is the order you look for them in.
  const past = dated.filter(isPast).sort((a, b) => b.startsAt - a.startsAt);

  const Pill = ({ on, onClick, children }) => (
    <button onClick={onClick} className={'pill' + (on ? ' pill--active' : '')}>{children}</button>
  );

  return (
    <div className="screen">
      <ScreenHeader title={t('ann_title')} kicker={t('ann_only_official')}
        right={isStaff ? <AddButton onClick={() => nav('/app/announcements/new' + (calendar ? '?date=1' : ''))} label={calendar ? t('ev_new') : t('ann_new')} /> : null} />

      {/*
        The calendar has no place in the bottom bar and never will — this row is
        its front door, so it is here whether or not anything is in it. The
        archive pill still only appears once there is an archive to go to.
      */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 0' }}>
        <Pill on={!calendar && !viewingArchive} onClick={() => { setShowArchived(false); if (calendar) nav('/app/announcements'); }}>{t('all')}</Pill>
        <Pill on={calendar} onClick={() => nav('/app/announcements/calendar')}>{t('ann_tab_dated')}</Pill>
        {archivedCount > 0 && !calendar && (
          <Pill on={viewingArchive} onClick={() => setShowArchived(true)}>{t('arch_archived')}</Pill>
        )}
      </div>

      {calendar ? (
        <div className="pad" style={{ paddingTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{t('ev_upcoming')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {upcoming.length === 0 && <Empty icon="📅">{t('ev_empty')}</Empty>}
            {upcoming.map((a) => (
              <DatedCard key={a.id} a={a} t={t} lang={lang} L={L}
                onClick={() => nav('/app/announcements/' + a.id)} />
            ))}
          </div>

          {past.length > 0 && (
            <>
              <div className="eyebrow" style={{ margin: '26px 0 12px' }}>{t('ev_past')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {past.map((a) => (
                  <DatedCard key={a.id} a={a} past t={t} lang={lang} L={L}
                    onClick={() => nav('/app/announcements/' + a.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {viewingArchive && (
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 2 }}>{t('arch_note')}</div>
          )}
          {list.length === 0 && <Empty icon="📢">{viewingArchive ? t('arch_empty') : t('ann_empty')}</Empty>}
          {list.map((a) => (
            <div key={a.id} style={{ position: 'relative' }}>
              <button onClick={() => nav('/app/announcements/' + a.id)} className="card" style={{ textAlign: 'left', width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9, paddingRight: 42, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--status-done-bg)', color: 'var(--green-500)', padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700 }}>📢 {t('ann_official')}</span>
                  {isPriority(a) && <PriorityBadge until={a.pinnedUntil} t={t} lang={lang} />}
                  {/* So the noticeboard says when, without being sorted by it. */}
                  {a.startsAt && (
                    <span className="badge" style={{ background: isPast(a) ? 'var(--section-bg)' : 'var(--status-done-bg)', color: isPast(a) ? 'var(--ink-400)' : 'var(--green-500)' }}>
                      📅 {isPast(a) ? t('ev_passed') : eventDay(a.startsAt, lang, t)}
                    </span>
                  )}
                </div>
                <div className="serif" style={{ fontSize: 17.5, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 }}>{L(a, 'title')}</div>
                {L(a, 'body') && (
                  <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{L(a, 'body')}</div>
                )}
                <div className="faint" style={{ fontSize: 12.5 }}>{userById(a.authorId).name} · {timeAgo(a.createdAt, t, lang)}</div>
              </button>
              <ArchiveButton kind="announcement" id={a.id} archived={archivedIds.has(a.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
