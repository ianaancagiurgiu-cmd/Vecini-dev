import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Empty } from '../components/ui.jsx';
import { daysUntil } from '../lib/format.js';

function PollCard({ p, onClick }) {
  const { t, L, counted, currentUser } = useApp();
  const total = p.options.reduce((s, o) => s + o.votes, 0);
  const voted = !!p.voters[currentUser.id];
  const closed = p.closed || p.endsAt < Date.now();
  const days = daysUntil(p.endsAt);
  return (
    <button onClick={onClick} className="card" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        {closed ? <span className="badge" style={{ background: 'var(--section-bg)', color: 'var(--ink-400)' }}>{t('poll_ended')}</span>
          : <span className="badge" style={{ background: 'var(--status-new-bg)', color: 'var(--status-new-fg)' }} >🗳️ {t('poll_vote_now')}</span>}
        {voted && <span className="badge" style={{ background: 'var(--status-done-bg)', color: 'var(--green-500)' }}>✓ {t('poll_voted')}</span>}
      </div>
      <div className="serif" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3, marginBottom: 12 }}>{L(p, 'question')}</div>
      <div className="faint" style={{ fontSize: 12.5, display: 'flex', justifyContent: 'space-between' }}>
        <span>{counted('poll_total_voted', total)}</span>
        {!closed && <span>{t('poll_ends_in')} {counted('poll_days', days)}</span>}
      </div>
    </button>
  );
}

export default function Polls() {
  const nav = useNavigate();
  const { data, t, isStaff } = useApp();
  const active = data.polls.filter((p) => !p.closed && p.endsAt > Date.now());
  const closed = data.polls.filter((p) => p.closed || p.endsAt <= Date.now());

  return (
    <div className="screen">
      <ScreenHeader title={t('poll_title')} right={isStaff ? <AddButton onClick={() => nav('/app/polls/new')} label={t('poll_new')} /> : null} />
      <div className="pad" style={{ paddingTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>{t('poll_active')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {active.length === 0 && <Empty icon="🗳️">{t('poll_empty')}</Empty>}
          {active.map((p) => <PollCard key={p.id} p={p} onClick={() => nav('/app/polls/' + p.id)} />)}
        </div>
        {closed.length > 0 && (
          <>
            <div className="eyebrow" style={{ margin: '26px 0 12px' }}>{t('poll_closed')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {closed.map((p) => <PollCard key={p.id} p={p} onClick={() => nav('/app/polls/' + p.id)} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
