import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Badge, Empty } from '../components/ui.jsx';
import { timeAgo, CATEGORIES, catLabel, STATUS } from '../lib/format.js';

export default function Issues() {
  const nav = useNavigate();
  const { data, t, L, lang, userById } = useApp();
  const [filter, setFilter] = useState('all');

  const statuses = ['all', 'new', 'progress', 'resolved'];
  const list = data.issues
    .filter((i) => filter === 'all' || i.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="screen">
      <ScreenHeader title={t('iss_title')} right={<AddButton onClick={() => nav('/app/issues/new')} label={t('iss_new')} />} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 4px' }}>
        {statuses.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={'pill' + (filter === s ? ' pill--active' : '')}>
            {s === 'all' ? t('all') : t(STATUS[s].key)}
          </button>
        ))}
      </div>
      <div className="pad" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {list.length === 0 && <Empty icon="🌿">{t('iss_empty')}</Empty>}
        {list.map((i) => {
          const cInfo = CATEGORIES[i.category] || CATEGORIES.other;
          const st = STATUS[i.status];
          return (
            <button key={i.id} onClick={() => nav('/app/issues/' + i.id)} className="card" style={{ textAlign: 'left' }}>
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
          );
        })}
      </div>
    </div>
  );
}
