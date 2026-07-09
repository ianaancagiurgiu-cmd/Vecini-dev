import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Badge } from '../components/ui.jsx';
import { timeAgo, formatDate, STATUS, CATEGORIES, catLabel } from '../lib/format.js';

function highlight(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (<>{text.slice(0, i)}<mark style={{ background: '#fbe7c2', color: 'inherit', borderRadius: 3, padding: '0 2px' }}>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>);
}

export default function Search() {
  const nav = useNavigate();
  const { data, t, L, lang } = useApp();
  const [tab, setTab] = useState('search'); // search | archive
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const ql = q.trim().toLowerCase();
  const match = (s) => s && s.toLowerCase().includes(ql);

  const annHits = data.announcements.filter((a) => ql && (match(L(a, 'title')) || match(L(a, 'body'))));
  const discHits = data.discussions.filter((d) => ql && d.status !== 'hidden' && (match(L(d, 'title')) || match(L(d, 'body'))));
  const issueHits = data.issues.filter((i) => ql && (match(L(i, 'title')) || match(L(i, 'description'))));
  const totalHits = annHits.length + discHits.length + issueHits.length;

  // archive = resolved issues + closed polls + old announcements
  const archIssues = data.issues.filter((i) => i.status === 'resolved');
  const archPolls = data.polls.filter((p) => p.closed || p.endsAt <= Date.now());

  const Row = ({ icon, title, sub, onClick, right }) => (
    <button onClick={onClick} className="card" style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.3 }}>{title}</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>{sub}</div>
      </div>
      {right}
    </button>
  );

  const Group = ({ label, items }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{label} · {items.length}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{items}</div>
    </div>
  );

  return (
    <div className="screen">
      <ScreenHeader title={t('search_title')} />
      {/* tabs */}
      <div className="pad" style={{ paddingTop: 14, display: 'flex', gap: 8 }}>
        <button onClick={() => setTab('search')} className={'pill' + (tab === 'search' ? ' pill--active' : '')}>🔎 {t('search')}</button>
        <button onClick={() => setTab('archive')} className={'pill' + (tab === 'archive' ? ' pill--active' : '')}>🗂️ {t('archive_title')}</button>
      </div>

      {tab === 'search' ? (
        <div className="pad" style={{ paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--input-border)', borderRadius: 13, padding: '12px 15px', marginBottom: 16 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#9a9586" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="#9a9586" strokeWidth="2" strokeLinecap="round"/></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_ph')} autoFocus style={{ border: 'none', outline: 'none', flex: 1, fontSize: 15, background: 'transparent' }} />
            {q && <button onClick={() => setQ('')} style={{ border: 'none', background: 'none', color: 'var(--ink-300)', fontSize: 18 }}>×</button>}
          </div>

          {!ql && <div className="empty"><div className="empty__icon">🔎</div><div>{t('search_start')}</div></div>}
          {ql && totalHits === 0 && <div className="empty"><div className="empty__icon">🕊️</div><div>{t('search_none')}</div></div>}
          {ql && totalHits > 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{totalHits} {t('search_results_for')} „{q}”</div>}

          <Group label={t('ann_title')} items={annHits.map((a) => (
            <Row key={a.id} icon="📢" title={highlight(L(a, 'title'), q)} sub={timeAgo(a.createdAt, t, lang)} onClick={() => nav('/app/announcements/' + a.id)} />
          ))} />
          <Group label={t('disc_title')} items={discHits.map((d) => (
            <Row key={d.id} icon="💬" title={highlight(L(d, 'title'), q)} sub={`${d.replies.length} ${t('disc_replies')}`} onClick={() => nav('/app/discussions/' + d.id)} />
          ))} />
          <Group label={t('iss_title')} items={issueHits.map((i) => (
            <Row key={i.id} icon={(CATEGORIES[i.category] || CATEGORIES.other).icon} title={highlight(L(i, 'title'), q)} sub={i.location}
              right={<Badge bg={STATUS[i.status].bg} fg={STATUS[i.status].fg} dot>{t(STATUS[i.status].key)}</Badge>} onClick={() => nav('/app/issues/' + i.id)} />
          ))} />
        </div>
      ) : (
        <div className="pad" style={{ paddingTop: 14 }}>
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>{t('archive_sub')}</div>
          {archIssues.length === 0 && archPolls.length === 0 && <div className="empty"><div className="empty__icon">🗂️</div><div>{t('archive_empty')}</div></div>}
          <Group label={`${t('st_resolved')} · ${t('iss_title')}`} items={archIssues.map((i) => (
            <Row key={i.id} icon="✅" title={L(i, 'title')} sub={formatDate(i.createdAt, lang)} onClick={() => nav('/app/issues/' + i.id)} />
          ))} />
          <Group label={t('poll_closed')} items={archPolls.map((p) => (
            <Row key={p.id} icon="🗳️" title={L(p, 'question')} sub={`${p.options.reduce((s, o) => s + o.votes, 0)} ${t('poll_total_voted')}`} onClick={() => nav('/app/polls/' + p.id)} />
          ))} />
        </div>
      )}
    </div>
  );
}
