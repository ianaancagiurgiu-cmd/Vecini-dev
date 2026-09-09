import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { Avatar, PriorityBadge } from '../components/ui.jsx';
import { timeAgo, isPriority, eventDay, eventWhen, isPast, daysBetween, lei } from '../lib/format.js';
import { Progress } from '../components/FundBits.jsx';

function TopBar() {
  const nav = useNavigate();
  const { data, t, currentUser } = useApp();
  const unread = data.notifications.filter((n) => !n.read).length;
  // Icon-only, so it needs a name of its own — there is no text to read out.
  const IconBtn = ({ onClick, children, badge, label }) => (
    <button onClick={onClick} aria-label={label} style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border)', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
      {badge > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
    </button>
  );
  return (
    <div className="pad" style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 10 }}>
      <button onClick={() => nav('/app/settings')}><Avatar user={currentUser} size={40} /></button>
      <div style={{ flex: 1 }} />
      <IconBtn onClick={() => nav('/app/search')} label={t('search_title')}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#5a5e54" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="#5a5e54" strokeWidth="2" strokeLinecap="round"/></svg>
      </IconBtn>
      <IconBtn onClick={() => nav('/app/notifications')} badge={unread} label={t('notif_title')}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" stroke="#5a5e54" strokeWidth="2" strokeLinejoin="round"/><path d="M10 20a2 2 0 004 0" stroke="#5a5e54" strokeWidth="2"/></svg>
      </IconBtn>
    </div>
  );
}

function StatTile({ n, label, tint, onClick }) {
  return (
    /* A hairline edge, like the cards further down the screen: without it these
       read as flat coloured panels rather than as something you can tap.
       Neutral rather than tinted, so the one rule works on every tile colour. */
    <button onClick={onClick} style={{ flex: 1, textAlign: 'left', background: tint.bg, border: '1px solid rgba(35,38,32,.09)', borderRadius: 16, padding: '15px 16px' }}>
      <div className="display" style={{ fontSize: 30, color: tint.fg, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: tint.fg, marginTop: 5, opacity: .9 }}>{label}</div>
    </button>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const { data, t, L, lang, counted, currentUser, userById, isStaff } = useApp();

  const openIssues = data.issues.filter((i) => i.status !== 'resolved').length;
  const activePolls = data.polls.filter((p) => !p.closed && p.endsAt > Date.now()).length;
  /*
    One list of announcements, and above it a single line for anything
    imminent.

    This screen used to carry two sections of cards: what was coming, and what
    had been said. Since a meeting became an announcement carrying a date, they
    were the same list cut in two on a distinction — "does it have a date" —
    that means nothing to anyone reading it. Nobody opens the app wondering
    which notices have dates.

    The cut was made by dropping the dated ones out of the list below, which
    produced the thing that gave it away: a noticeboard with two notices on it,
    announcing "no announcements yet". That is not a wording bug to patch. It
    is what a false distinction does when you build on it.

    So the list is whole, and a dated notice simply shows its date where the
    others show how long ago they were posted. What is coming up is a line
    rather than a section: it answers "anything this week?" without spending a
    quarter of the screen, and it is absent when the answer is no. The nearest
    thing shows up both there and in the list, which is not the duplication
    that was worth removing — a one-line pointer into the calendar and a card
    on the noticeboard are different shapes doing different jobs.
  */
  const nextUp = data.announcements
    .filter((a) => a.startsAt && !isPast(a) && daysBetween(a.startsAt) <= 7)
    .sort((a, b) => a.startsAt - b.startsAt)[0];

  // Held-at-the-top first, then newest. sort() mutates, so not on the store's
  // own array.
  const anns = [...data.announcements]
    .sort((a, b) => (isPriority(b) - isPriority(a)) || (b.createdAt - a.createdAt))
    .slice(0, 3);
  const discs = data.discussions.filter((d) => d.status === 'approved').sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  /*
    Collections still running, yours first.

    Ordered by whether you owe anything rather than by date: money you have
    not handed over is the reason to look at this screen at all, and a
    collection you have already settled is somebody else's problem now.
  */
  const funds = data.funds
    .filter((f) => !f.closedAt)
    .sort((a, b) => (Math.max(0, b.myDueBani - b.myPaidBani) > 0) - (Math.max(0, a.myDueBani - a.myPaidBani) > 0))
    .slice(0, 2);

  return (
    <div className="screen screen-anim">
      <TopBar />

      {/* greeting */}
      <div className="pad" style={{ paddingTop: 18 }}>
        <h1 className="display" style={{ fontSize: 28, margin: '0 0 4px' }}>{t('dash_hi')}, {currentUser.name.split(' ')[0]}</h1>
        <div className="muted" style={{ fontSize: 14 }}>
          {data.community.name} ·{' '}
          {/* The neighbour count is the natural way in to the list of them. */}
          <button onClick={() => nav('/app/neighbours')} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--green-600)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {counted('dash_members', data.community.memberCount)}
          </button>
          {/* Staircases only mean something in a block of flats. */}
          {data.community.kind === 'bloc' && ` · ${counted('dash_scari', data.community.staircases)}`}
        </div>
        {/* The slogan follows the kind of place this is: an admin who says
            "houses" should not be told this is all about their building. */}
        <div className="serif" style={{ fontSize: 14.5, color: 'var(--green-600)', marginTop: 8, lineHeight: 1.4 }}>
          {t(`tagline_${data.community.kind || 'bloc'}`)}
        </div>
      </div>

      {/* stat tiles */}
      <div className="pad" style={{ paddingTop: 18, display: 'flex', gap: 11 }}>
        <StatTile n={openIssues} label={t('dash_open_issues')} tint={{ bg: 'var(--status-prog-bg)', fg: 'var(--status-prog-fg)' }} onClick={() => nav('/app/issues')} />
        <StatTile n={activePolls} label={t('dash_active_polls')} tint={{ bg: 'var(--status-new-bg)', fg: 'var(--status-new-fg)' }} onClick={() => nav('/app/polls')} />
      </div>

      {/*
        The next thing coming, when there is one inside the week. Also the only
        way into the calendar from this screen — which is why the whole line
        goes there rather than to the notice it names: it is labelled as the
        agenda, and the agenda is what it opens.
      */}
      {nextUp && (
        <div className="pad" style={{ paddingTop: 18 }}>
          <button onClick={() => nav('/app/announcements/calendar')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                     background: 'var(--status-done-bg)', border: '1px solid rgba(35,38,32,.09)',
                     borderRadius: 13, padding: '11px 13px' }}>
            <span aria-hidden="true" style={{ fontSize: 16 }}>📅</span>
            {/*
              Two lines rather than one. On one line the label and the day are
              fixed and the title is what gives way, so "Curățenie generală
              scara A" arrived as "Curățenie generală…" — which does not say
              which of them it is, and that is the entire content of the row.
              Stacked, the title gets the full width and the strip still costs
              about a quarter of what the section of cards did.
            */}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="eyebrow" style={{ display: 'block', fontSize: 11, color: 'var(--green-600)' }}>
                {t('dash_upcoming')} · {eventDay(nextUp.startsAt, lang, t)}
              </span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginTop: 2,
                             whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {L(nextUp, 'title')}
              </span>
            </span>
            <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 16, color: 'var(--green-600)' }}>›</span>
          </button>
        </div>
      )}

      {/* everything the administration has said, dated or not */}
      <div className="pad" style={{ paddingTop: 22 }}>
        <div className="section-head">
          <h2>{t('dash_from_admin')}</h2>
          <button className="see-all" onClick={() => nav('/app/announcements')} style={{ background: 'none', border: 'none' }}>{t('dash_see_all')}</button>
        </div>
        {anns.length === 0 ? <div className="muted" style={{ fontSize: 14 }}>{t('ann_empty')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {anns.map((a, i) => (
              <button key={a.id} onClick={() => nav('/app/announcements/' + a.id)}
                style={{ textAlign: 'left', border: 'none', borderRadius: 17, padding: 17, color: '#eaf3ed', background: i === 0 ? 'linear-gradient(135deg,#2f6b4f,#245840)' : '#fff', ...(i !== 0 ? { color: 'var(--ink-900)', border: '1px solid var(--border)' } : {}) }}>
                <div style={{ display: 'flex', gap: 7, marginBottom: 9, alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: i === 0 ? 'rgba(255,255,255,.16)' : 'var(--status-done-bg)', color: i === 0 ? '#eaf3ed' : 'var(--green-500)', padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700 }}>📢 {t('ann_official')}</span>
                  {isPriority(a) && <PriorityBadge until={a.pinnedUntil} t={t} lang={lang} tone={i === 0 ? '#e8c98a' : 'var(--amber)'} />}
                </div>
                <div className="serif" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 }}>{L(a, 'title')}</div>
                {/* When it happens, if it happens on a day; otherwise who said
                    it and when. One line either way — the date is what the
                    dated ones are for, and the author is on the notice itself. */}
                <div style={{ fontSize: 12.5, color: i === 0 ? '#bcd4c5' : 'var(--ink-300)' }}>
                  {a.startsAt
                    ? `📅 ${eventWhen(a, lang, t)}${a.location ? ` · ${a.location}` : ''}`
                    : `${userById(a.authorId).name} · ${timeAgo(a.createdAt, t, lang)}`}
                </div>
              </button>
            ))}
          </div>
        )}
        {/*
          The calendar has no place in the bottom bar, and this is the only
          create button on the screen now that there is one kind of thing to
          create. Quiet rather than primary: it is what this section can do,
          not what the screen is for. Outside the empty check on purpose — an
          empty noticeboard is exactly when an admin needs it.
        */}
        {isStaff && (
          <button className="btn btn--ghost" style={{ marginTop: 12 }}
            onClick={() => nav('/app/announcements/new')}>
            + {t('ann_new')}
          </button>
        )}
      </div>

      /*
        The collections.

        Absent for a neighbour when there are none — a section explaining that
        nobody is collecting money never earns the room it takes. Present for
        staff whether or not there is anything in it, which is not an
        inconsistency but the same rule as the noticeboard above: the empty
        state is exactly when somebody needs the button, and the first
        collection of all was otherwise reachable only from the admin panel two
        screens away. That was the calendar's mistake, reported in these words:
        "nu vad niciun plus, nu inteleg cum adaug ceva ca admin".
      */
      {(funds.length > 0 || isStaff) && (
        <div className="pad" style={{ paddingTop: 22 }}>
          <div className="section-head">
            <h2>{t('fund_title')}</h2>
            <button className="see-all" onClick={() => nav('/app/funds')} style={{ background: 'none', border: 'none' }}>{t('dash_see_all')}</button>
          </div>
          {funds.length === 0 && (
            <div className="muted" style={{ fontSize: 14 }}>{t('fund_empty_staff')}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {funds.map((f) => {
              const rest = Math.max(0, f.myDueBani - f.myPaidBani);
              return (
                <button key={f.id} onClick={() => nav('/app/funds/' + f.id)} className="card"
                  style={{ textAlign: 'left', display: 'block', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>{f.title}</span>
                    <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: rest > 0 ? 'var(--terracotta)' : 'var(--green-600)' }}>
                      {f.myDueBani === 0 ? '—' : (rest > 0 ? lei(rest, lang) : '✓')}
                    </span>
                  </div>
                  <Progress collected={f.collectedBani} target={f.targetBani} />
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {lei(f.collectedBani, lang)} {t('fund_of')} {lei(f.targetBani, lang)}
                  </div>
                </button>
              );
            })}
          </div>
          {/* Outside the empty check, for the same reason as the one on the
              noticeboard: no collection yet is exactly when it is needed. */}
          {isStaff && (
            <button className="btn btn--ghost" style={{ marginTop: 12 }}
              onClick={() => nav('/app/funds/new')}>
              + {t('fund_new')}
            </button>
          )}
        </div>
      )}

      {/* recent discussions */}
      <div className="pad">
        <div className="section-head">
          <h2>{t('dash_recent_disc')}</h2>
          <button className="see-all" onClick={() => nav('/app/discussions')} style={{ background: 'none', border: 'none' }}>{t('dash_see_all')}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {discs.map((d) => (
            <button key={d.id} onClick={() => nav('/app/discussions/' + d.id)} className="card" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar user={userById(d.authorId)} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{L(d, 'title')}</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>💬 {counted('disc_replies', d.replies.length)} · {timeAgo(d.createdAt, t, lang)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* quick report */}
      <div className="pad" style={{ paddingTop: 22 }}>
        <button className="btn btn--terracotta" onClick={() => nav('/app/issues/new')}>+ {t('dash_quick_report')}</button>
      </div>
    </div>
  );
}
