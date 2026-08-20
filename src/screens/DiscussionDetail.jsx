import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar } from '../components/ui.jsx';
import { timeAgo, CATEGORIES, catLabel } from '../lib/format.js';

export default function DiscussionDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data, t, L, lang, counted, userById, actions } = useApp();
  const [reply, setReply] = useState('');
  const d = data.discussions.find((x) => x.id === id);
  if (!d) return <div className="screen"><ScreenHeader title={t('disc_title')} onBack={() => nav('/app/discussions')} /></div>;
  const cInfo = CATEGORIES[d.category] || CATEGORIES.general;

  const send = async () => { if (!reply.trim()) return; const body = reply.trim(); setReply(''); await actions.addReply(d.id, body); };

  return (
    <div className="screen">
      <ScreenHeader title={t('disc_title')} onBack={() => nav('/app/discussions')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        <span className="badge" style={{ background: cInfo.bg, color: cInfo.fg, marginBottom: 12 }}>{cInfo.icon} {catLabel(d.category, t)}</span>
        <h1 className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25, margin: '12px 0 14px' }}>{L(d, 'title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
          <Avatar user={userById(d.authorId)} size={40} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{userById(d.authorId).name}</div>
            <div className="faint" style={{ fontSize: 12.5 }}>{timeAgo(d.createdAt, t, lang)}</div>
          </div>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: '#3f433b', whiteSpace: 'pre-wrap' }}>{L(d, 'body')}</div>
      </div>

      <div style={{ height: 8, background: 'var(--section-bg)', margin: '22px 0 0' }} />

      <div className="pad" style={{ paddingTop: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#5a5e54', marginBottom: 14 }}>💬 {counted('disc_replies', d.replies.length)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {d.replies.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: 11 }}>
              <Avatar user={userById(r.authorId)} size={34} />
              <div style={{ flex: 1, background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '11px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{userById(r.authorId).name}</span>
                  <span className="faint" style={{ fontSize: 11.5 }}>{timeAgo(r.createdAt, t, lang)}</span>
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: '#3f433b' }}>{L(r, 'body')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* reply box */}
      <div className="composer-bar" style={{ marginTop: 20 }}>
        <input className="input" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('disc_reply_ph')} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn btn--primary" onClick={send} disabled={!reply.trim()} style={{ width: 'auto', padding: '0 18px' }}>➤</button>
      </div>
    </div>
  );
}
