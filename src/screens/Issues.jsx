import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Badge, Empty } from '../components/ui.jsx';
import ArchiveButton from '../components/ArchiveButton.jsx';
import { timeAgo, CATEGORIES, catLabel, STATUS } from '../lib/format.js';

export default function Issues() {
  const nav = useNavigate();
  const { data, t, L, lang, userById } = useApp();
  const [chosen, setChosen] = useState(null);

  const archivedIds = new Set(data.archived.issue);
  const active = data.issues.filter((i) => !archivedIds.has(i.id));
  const archived = data.issues.filter((i) => archivedIds.has(i.id));

  /*
    Which tab to open on, when nobody has said. Somebody arriving at this screen
    is nearly always here for what has just been reported, so that is where they
    land — but landing on an empty list is worse than landing on the wrong one,
    so it falls back through what is actually there.

    Settled once, on the first load that has anything in it, and then left
    alone. Recomputing it would move the tab under someone who has just resolved
    the last new issue, which is a strange thing for a screen to do while you
    are looking at it.
  */
  const settled = useRef(null);
  if (settled.current === null && data.issues.length > 0) {
    settled.current = active.some((i) => i.status === 'new') ? 'new'
      : active.some((i) => i.status === 'progress') ? 'progress'
      : 'all';
  }
  const filter = chosen ?? settled.current ?? 'all';

  // Offered only once there is something in there, so it stays out of the way
  // of anyone who never uses it.
  const tabs = ['all', 'new', 'progress', 'resolved', ...(archived.length ? ['archived'] : [])];

  const list = (filter === 'archived' ? archived : active)
    .filter((i) => filter === 'all' || filter === 'archived' || i.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="screen">
      <ScreenHeader title={t('iss_title')} right={<AddButton onClick={() => nav('/app/issues/new')} label={t('iss_new')} />} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 4px' }}>
        {tabs.map((s) => (
          <button key={s} onClick={() => setChosen(s)} className={'pill' + (filter === s ? ' pill--active' : '')}>
            {s === 'all' ? t('all') : s === 'archived' ? t('arch_archived') : t(`iss_tab_${s}`)}
          </button>
        ))}
      </div>
      <div className="pad" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {filter === 'archived' && (
          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 2 }}>{t('arch_note')}</div>
        )}
        {list.length === 0 && <Empty icon="🌿">{filter === 'archived' ? t('arch_empty') : t('iss_empty')}</Empty>}
        {list.map((i) => {
          const cInfo = CATEGORIES[i.category] || CATEGORIES.other;
          const st = STATUS[i.status];
          return (
            <div key={i.id} style={{ position: 'relative' }}>
              <button onClick={() => nav('/app/issues/' + i.id)} className="card" style={{ textAlign: 'left', width: '100%', paddingRight: 50 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}>
                  <Badge bg={st.bg} fg={st.fg} dot>{t(st.key)}</Badge>
                  <Badge bg={cInfo.bg} fg={cInfo.fg}>{cInfo.icon} {catLabel(i.category, t)}</Badge>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.3, marginBottom: 6 }}>{L(i, 'title')}</div>
                <div className="faint" style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>📍 {i.location}</span>
                  <span>·</span>
                  <span>{userById(i.reporterId).name.split(' ')[0]}</span>
                  <span style={{ marginLeft: 'auto' }}>👍 {i.supporters.length}</span>
                </div>
              </button>
              <ArchiveButton kind="issue" id={i.id} archived={archivedIds.has(i.id)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
