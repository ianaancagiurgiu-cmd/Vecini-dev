import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Empty } from '../components/ui.jsx';
import { timeAgo } from '../lib/format.js';

export default function Announcements() {
  const nav = useNavigate();
  const { data, t, L, lang, isStaff, userById } = useApp();
  const list = [...data.announcements].sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));

  return (
    <div className="screen">
      <ScreenHeader title={t('ann_title')} kicker={t('ann_only_official')}
        right={isStaff ? <AddButton onClick={() => nav('/app/announcements/new')} label={t('ann_new')} /> : null} />
      <div className="pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {list.length === 0 && <Empty icon="📢">{t('ann_empty')}</Empty>}
        {list.map((a) => (
          <button key={a.id} onClick={() => nav('/app/announcements/' + a.id)} className="card" style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--status-done-bg)', color: 'var(--green-500)', padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700 }}>📢 {t('ann_official')}</span>
              {a.pinned && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>📌 {t('ann_pinned')}</span>}
            </div>
            <div className="serif" style={{ fontSize: 17.5, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 }}>{L(a, 'title')}</div>
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{L(a, 'body')}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>{userById(a.authorId).name} · {timeAgo(a.createdAt, t, lang)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
