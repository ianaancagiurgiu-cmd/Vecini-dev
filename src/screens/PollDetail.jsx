import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';
import { daysUntil } from '../lib/format.js';

export default function PollDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data, t, L, currentUser, isStaff, actions } = useApp();
  const p = data.polls.find((x) => x.id === id);
  const [picked, setPicked] = useState([]);
  if (!p) return <div className="screen"><ScreenHeader title={t('poll_title')} onBack={() => nav('/app/polls')} /></div>;

  const total = p.options.reduce((s, o) => s + o.votes, 0);
  const voted = !!p.voters[currentUser.id];
  const closed = p.closed || p.endsAt < Date.now();
  const showResults = voted || closed;
  const maxVotes = Math.max(...p.options.map((o) => o.votes), 0);

  const toggle = (oid) => {
    if (p.multi) setPicked((cur) => cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid]);
    else setPicked([oid]);
  };
  const submit = () => { if (picked.length === 0) return; actions.votePoll(p.id, picked); };

  return (
    <div className="screen">
      <ScreenHeader title={t('poll_title')} onBack={() => nav('/app/polls')}
        right={isStaff && !closed ? <button onClick={() => actions.closePoll(p.id)} style={{ background: 'none', border: 'none', color: 'var(--terracotta)', fontSize: 13, fontWeight: 700 }}>{t('poll_close_early')}</button> : null} />
      <div className="pad" style={{ paddingTop: 18 }}>
        {closed && <span className="badge" style={{ background: 'var(--section-bg)', color: 'var(--ink-400)', marginBottom: 12 }}>{t('poll_ended')}</span>}
        <h1 className="serif" style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.25, margin: '8px 0 6px' }}>{L(p, 'question')}</h1>
        <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {total} {t('poll_total_voted')}{!closed && ` · ${t('poll_ends_in')} ${daysUntil(p.endsAt)} ${t('poll_days')}`}{p.multi && ' · ' + t('poll_f_multi').toLowerCase()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {p.options.map((o) => {
            const pct = total ? Math.round((o.votes / total) * 100) : 0;
            const isWinner = closed && o.votes === maxVotes && maxVotes > 0;
            if (showResults) {
              return (
                <div key={o.id} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', background: '#fff', padding: '13px 15px' }}>
                  <div style={{ position: 'absolute', inset: 0, width: pct + '%', background: isWinner ? 'var(--status-done-bg)' : 'var(--section-bg)', transition: 'width .5s ease' }} />
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: isWinner ? 700 : 600, fontSize: 14.5 }}>{isWinner && '🏆 '}{L(o, 'label')}</span>
                    <span style={{ fontWeight: 700, fontSize: 14.5, color: isWinner ? 'var(--green-500)' : 'var(--ink-400)' }}>{pct}%</span>
                  </div>
                </div>
              );
            }
            const sel = picked.includes(o.id);
            return (
              <button key={o.id} onClick={() => toggle(o.id)} style={{ textAlign: 'left', border: sel ? '2px solid var(--green-600)' : '1px solid var(--input-border)', borderRadius: 14, background: sel ? 'var(--status-done-bg)' : '#fff', padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: p.multi ? 6 : '50%', border: sel ? 'none' : '2px solid var(--input-border)', background: sel ? 'var(--green-600)' : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{sel ? '✓' : ''}</span>
                <span style={{ fontWeight: 600, fontSize: 14.5 }}>{L(o, 'label')}</span>
              </button>
            );
          })}
        </div>

        {!showResults && (
          <button className="btn btn--primary" onClick={submit} disabled={picked.length === 0} style={{ marginTop: 18 }}>{t('poll_vote_cta')}</button>
        )}
        {voted && !closed && <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 16 }}>🔒 {t('poll_anon')}</div>}
        {closed && <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 16 }}>{t('poll_winner')}: <b style={{ color: 'var(--green-500)' }}>{L(p.options.find((o) => o.votes === maxVotes), 'label')}</b></div>}
      </div>
    </div>
  );
}
