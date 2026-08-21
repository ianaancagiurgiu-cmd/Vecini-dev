import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { Avatar } from '../components/ui.jsx';
import { timeAgo } from '../lib/format.js';

function TopBar() {
  const nav = useNavigate();
  const { data, currentUser } = useApp();
  const unread = data.notifications.filter((n) => !n.read).length;
  const IconBtn = ({ onClick, children, badge }) => (
    <button onClick={onClick} style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border)', background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
      {badge > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 999, background: 'var(--terracotta)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
    </button>
  );
  return (
    <div className="pad" style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 10 }}>
      <button onClick={() => nav('/app/settings')}><Avatar user={currentUser} size={40} /></button>
      <div style={{ flex: 1 }} />
      <IconBtn onClick={() => nav('/app/search')}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#5a5e54" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="#5a5e54" strokeWidth="2" strokeLinecap="round"/></svg>
      </IconBtn>
      <IconBtn onClick={() => nav('/app/notifications')} badge={unread}>
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
  const { data, t, L, lang, counted, currentUser, userById } = useApp();

  const anns = [...data.announcements].sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt)).slice(0, 3);
  const openIssues = data.issues.filter((i) => i.status !== 'resolved').length;
  const activePolls = data.polls.filter((p) => !p.closed && p.endsAt > Date.now()).length;
  const discs = data.discussions.filter((d) => d.status === 'approved').sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);

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

      {/* recent announcements */}
      <div className="pad">
        <div className="section-head">
          <h2>{t('dash_recent_ann')}</h2>
          <button className="see-all" onClick={() => nav('/app/announcements')} style={{ background: 'none', border: 'none' }}>{t('dash_see_all')}</button>
        </div>
        {anns.length === 0 ? <div className="muted" style={{ fontSize: 14 }}>{t('ann_empty')}</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {anns.map((a, i) => (
              <button key={a.id} onClick={() => nav('/app/announcements/' + a.id)}
                style={{ textAlign: 'left', border: 'none', borderRadius: 17, padding: 17, color: '#eaf3ed', background: i === 0 ? 'linear-gradient(135deg,#2f6b4f,#245840)' : '#fff', ...(i !== 0 ? { color: 'var(--ink-900)', border: '1px solid var(--border)' } : {}) }}>
                <div style={{ display: 'flex', gap: 7, marginBottom: 9, alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: i === 0 ? 'rgba(255,255,255,.16)' : 'var(--status-done-bg)', color: i === 0 ? '#eaf3ed' : 'var(--green-500)', padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700 }}>📢 {t('ann_official')}</span>
                  {a.pinned && <span style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? '#bcd4c5' : 'var(--ink-300)' }}>📌 {t('ann_pinned')}</span>}
                </div>
                <div className="serif" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 }}>{L(a, 'title')}</div>
                <div style={{ fontSize: 12.5, color: i === 0 ? '#bcd4c5' : 'var(--ink-300)' }}>{userById(a.authorId).name} · {timeAgo(a.createdAt, t, lang)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

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
