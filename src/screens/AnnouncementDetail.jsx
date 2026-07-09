import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';
import { Avatar } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

export default function AnnouncementDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data, t, L, lang, userById, isStaff, actions } = useApp();
  const a = data.announcements.find((x) => x.id === id);
  if (!a) return <div className="screen"><ScreenHeader title={t('ann_title')} onBack={() => nav(-1)} /><div className="pad" style={{ paddingTop: 20 }}>—</div></div>;
  const author = userById(a.authorId);

  return (
    <div className="screen">
      <ScreenHeader title={t('ann_title')} onBack={() => nav('/app/announcements')}
        right={isStaff ? <button onClick={() => actions.togglePin(a.id)} style={{ background: 'none', border: 'none', fontSize: 18, color: a.pinned ? 'var(--amber)' : 'var(--ink-300)' }}>📌</button> : null} />
      <div className="pad" style={{ paddingTop: 20 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--status-done-bg)', color: 'var(--green-500)', padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>📢 {t('ann_official')}</span>
          {a.pinned && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>📌 {t('ann_pinned')}</span>}
        </div>
        <h1 className="display" style={{ fontSize: 26, lineHeight: 1.15, margin: '0 0 16px' }}>{L(a, 'title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid var(--border)' }}>
          <Avatar user={author} size={42} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{author.name}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>{t('ann_published_by')} · {formatDate(a.createdAt, lang)}</div>
          </div>
        </div>
        <div style={{ fontSize: 15.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#3f433b' }}>{L(a, 'body')}</div>
      </div>
    </div>
  );
}
