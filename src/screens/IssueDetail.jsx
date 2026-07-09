import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Badge, Avatar } from '../components/ui.jsx';
import { timeAgo, formatDate, CATEGORIES, catLabel, STATUS } from '../lib/format.js';

const NEXT = { new: ['progress', 'resolved'], progress: ['resolved', 'new'], resolved: ['progress'] };

export default function IssueDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const numId = /^\d+$/.test(id) ? Number(id) : id;
  const { data, t, L, lang, userById, currentUser, isStaff, actions } = useApp();
  const [comment, setComment] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [note, setNote] = useState('');

  const i = data.issues.find((x) => x.id === numId);
  if (!i) return <div className="screen"><ScreenHeader title={t('iss_title')} onBack={() => nav('/app/issues')} /></div>;
  const st = STATUS[i.status];
  const cInfo = CATEGORIES[i.category] || CATEGORIES.other;
  const supported = i.supporters.includes(currentUser.id);

  const sendComment = () => { if (!comment.trim()) return; actions.addIssueComment(i.id, comment.trim()); setComment(''); };
  const applyStatus = () => { if (!newStatus || !note.trim()) return; actions.updateIssueStatus(i.id, newStatus, note.trim()); setNewStatus(''); setNote(''); };

  return (
    <div className="screen">
      <ScreenHeader title={`${t('iss_title')} #${i.id}`} onBack={() => nav('/app/issues')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Badge bg={st.bg} fg={st.fg} dot>{t(st.key)}</Badge>
          <Badge bg={cInfo.bg} fg={cInfo.fg}>{cInfo.icon} {catLabel(i.category, t)}</Badge>
        </div>
        <h1 className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.25, margin: '0 0 10px' }}>{L(i, 'title')}</h1>
        <div className="faint" style={{ fontSize: 13, marginBottom: 14 }}>📍 {i.location} · {t('iss_reported_by')} {userById(i.reporterId).name} · {formatDate(i.createdAt, lang)}</div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: '#3f433b', whiteSpace: 'pre-wrap', marginBottom: 16 }}>{L(i, 'description')}</div>
        {i.photo && <img src={i.photo} alt="" style={{ width: '100%', borderRadius: 14, marginBottom: 16 }} />}

        {/* support */}
        <button onClick={() => actions.toggleSupport(i.id)} className="btn" style={{ background: supported ? 'var(--green-600)' : '#fff', color: supported ? '#fff' : 'var(--green-600)', border: supported ? 'none' : '1px solid var(--input-border)', fontWeight: 700 }}>
          👍 {t('iss_support')} · {i.supporters.length}
        </button>
      </div>

      {/* staff: status update */}
      {isStaff && (
        <div className="pad" style={{ paddingTop: 20 }}>
          <div className="card" style={{ background: '#13211b', border: 'none', color: '#eaf3ed' }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.5px', color: '#7fd1a8', marginBottom: 12 }}>{t('iss_change_status')}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {(NEXT[i.status] || []).map((s) => (
                <button key={s} onClick={() => setNewStatus(s)} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, background: newStatus === s ? '#2f8c5f' : 'rgba(255,255,255,.1)', color: '#fff' }}>{t(STATUS[s].key)}</button>
              ))}
            </div>
            {newStatus && (
              <>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('iss_status_note')} style={{ width: '100%', borderRadius: 11, border: 'none', padding: 12, fontSize: 14, resize: 'vertical', marginBottom: 10, fontFamily: 'var(--font-ui)' }} />
                <button className="btn btn--primary" onClick={applyStatus} disabled={!note.trim()}>{t('iss_update_cta')}</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* history */}
      <div className="pad" style={{ paddingTop: 20 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#5a5e54', marginBottom: 14 }}>{t('iss_status_history')}</div>
        <div style={{ position: 'relative', paddingLeft: 8 }}>
          {i.history.slice().reverse().map((h, idx, arr) => (
            <div key={idx} style={{ display: 'flex', gap: 12, paddingBottom: idx === arr.length - 1 ? 0 : 16, position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: STATUS[h.status].fg, marginTop: 3, flexShrink: 0 }} />
                {idx !== arr.length - 1 && <span style={{ width: 2, flex: 1, background: 'var(--border)', marginTop: 3 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: STATUS[h.status].fg }}>{t(STATUS[h.status].key)}</span>
                  <span className="faint" style={{ fontSize: 11.5, marginLeft: 'auto' }}>{timeAgo(h.at, t, lang)}</span>
                </div>
                <div style={{ fontSize: 13.5, color: '#3f433b', marginTop: 3, lineHeight: 1.45 }}>{L(h, 'note')}</div>
                <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{userById(h.byId).name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* comments */}
      <div className="pad" style={{ paddingTop: 20 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#5a5e54', marginBottom: 14 }}>💬 {i.comments.length}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
          {i.comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10 }}>
              <Avatar user={userById(c.authorId)} size={32} />
              <div style={{ flex: 1, background: '#fff', border: '1px solid var(--border)', borderRadius: 13, padding: '10px 13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{userById(c.authorId).name}</span>
                  <span className="faint" style={{ fontSize: 11.5 }}>{timeAgo(c.createdAt, t, lang)}</span>
                </div>
                <div style={{ fontSize: 13.5, color: '#3f433b', lineHeight: 1.45 }}>{L(c, 'body')}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: 'var(--app-bg)', borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', gap: 9 }}>
        <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('iss_comment_ph')} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && sendComment()} />
        <button className="btn btn--primary" onClick={sendComment} disabled={!comment.trim()} style={{ width: 'auto', padding: '0 18px' }}>➤</button>
      </div>
    </div>
  );
}
