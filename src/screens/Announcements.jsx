import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Empty } from '../components/ui.jsx';
import ArchiveButton from '../components/ArchiveButton.jsx';
import { timeAgo } from '../lib/format.js';

export default function Announcements() {
  const nav = useNavigate();
  const { data, t, L, lang, isStaff, userById } = useApp();
  const [showArchived, setShowArchived] = useState(false);

  const archivedIds = new Set(data.archived.announcement);
  const archivedCount = data.announcements.filter((a) => archivedIds.has(a.id)).length;
  const viewingArchive = showArchived && archivedCount > 0;

  const list = data.announcements
    .filter((a) => archivedIds.has(a.id) === viewingArchive)
    .sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));

  return (
    <div className="screen">
      <ScreenHeader title={t('ann_title')} kicker={t('ann_only_official')}
        right={isStaff ? <AddButton onClick={() => nav('/app/announcements/new')} label={t('ann_new')} /> : null} />

      {/* No filter row at all until there is an archive to filter to. */}
      {archivedCount > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 0' }}>
          <button onClick={() => setShowArchived(false)} className={'pill' + (!viewingArchive ? ' pill--active' : '')}>{t('all')}</button>
          <button onClick={() => setShowArchived(true)} className={'pill' + (viewingArchive ? ' pill--active' : '')}>{t('arch_archived')}</button>
        </div>
      )}

      <div className="pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {viewingArchive && (
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 2 }}>{t('arch_note')}</div>
        )}
        {list.length === 0 && <Empty icon="📢">{viewingArchive ? t('arch_empty') : t('ann_empty')}</Empty>}
        {list.map((a) => (
          <div key={a.id} style={{ position: 'relative' }}>
            <button onClick={() => nav('/app/announcements/' + a.id)} className="card" style={{ textAlign: 'left', width: '100%' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9, paddingRight: 42 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--status-done-bg)', color: 'var(--green-500)', padding: '4px 9px', borderRadius: 7, fontSize: 11, fontWeight: 700 }}>📢 {t('ann_official')}</span>
                {a.pinned && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>📌 {t('ann_pinned')}</span>}
              </div>
              <div className="serif" style={{ fontSize: 17.5, fontWeight: 600, lineHeight: 1.25, marginBottom: 6 }}>{L(a, 'title')}</div>
              <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.45, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{L(a, 'body')}</div>
              <div className="faint" style={{ fontSize: 12.5 }}>{userById(a.authorId).name} · {timeAgo(a.createdAt, t, lang)}</div>
            </button>
            <ArchiveButton kind="announcement" id={a.id} archived={archivedIds.has(a.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
