import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, AddButton, Avatar, Empty } from '../components/ui.jsx';
import { timeAgo, CATEGORIES, catLabel, DISC_CATS } from '../lib/format.js';

export default function Discussions() {
  const nav = useNavigate();
  const { data, t, L, lang, userById } = useApp();
  const [cat, setCat] = useState('all');

  const visible = data.discussions.filter((d) => d.status === 'approved');
  const cats = ['all', ...DISC_CATS.filter((c) => visible.some((d) => d.category === c))];
  const list = visible
    .filter((d) => cat === 'all' || d.category === cat)
    .sort((a, b) => {
      const la = a.replies.length ? a.replies[a.replies.length - 1].createdAt : a.createdAt;
      const lb = b.replies.length ? b.replies[b.replies.length - 1].createdAt : b.createdAt;
      return lb - la;
    });

  return (
    <div className="screen">
      <ScreenHeader title={t('disc_title')} right={<AddButton onClick={() => nav('/app/discussions/new')} label={t('disc_new')} />} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 4px' }}>
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={'pill' + (cat === c ? ' pill--active' : '')}>
            {c === 'all' ? t('all') : `${CATEGORIES[c]?.icon || ''} ${catLabel(c, t)}`}
          </button>
        ))}
      </div>
      <div className="pad" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {list.length === 0 && <Empty icon="💬">{t('disc_empty')}</Empty>}
        {list.map((d) => {
          const cInfo = CATEGORIES[d.category] || CATEGORIES.general;
          const last = d.replies.length ? d.replies[d.replies.length - 1].createdAt : d.createdAt;
          return (
            <button key={d.id} onClick={() => nav('/app/discussions/' + d.id)} className="card" style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}>
                <span className="badge" style={{ background: cInfo.bg, color: cInfo.fg }}>{cInfo.icon} {catLabel(d.category, t)}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.3, marginBottom: 9 }}>{L(d, 'title')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Avatar user={userById(d.authorId)} size={26} />
                <span className="muted" style={{ fontSize: 12.5 }}>{userById(d.authorId).name}</span>
                <span className="faint" style={{ fontSize: 12.5, marginLeft: 'auto' }}>💬 {d.replies.length} · {timeAgo(last, t, lang)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
