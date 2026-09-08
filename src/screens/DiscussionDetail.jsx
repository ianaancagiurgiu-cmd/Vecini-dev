import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader, Avatar, HeartButton, Composer } from '../components/ui.jsx';
import { useLongPress, ActionMenu, PencilIcon } from '../components/MessageMenu.jsx';
import { timeAgo, CATEGORIES, catLabel, canStillEdit } from '../lib/format.js';

export default function DiscussionDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { data, t, L, lang, counted, userById, currentUser, actions } = useApp();
  const [reply, setReply] = useState('');
  // Which of your own replies you are correcting, and the menu that offered.
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null);
  const bindHold = useLongPress();
  const d = data.discussions.find((x) => x.id === id);
  if (!d) return <div className="screen"><ScreenHeader title={t('disc_title')} onBack={() => nav('/app/discussions')} /></div>;
  const cInfo = CATEGORIES[d.category] || CATEGORIES.general;

  // One button, doing whichever of the two things is in front of it.
  const send = async () => {
    const body = reply.trim();
    if (!body) return;
    setReply('');
    if (editing) {
      const id = editing;
      setEditing(null);
      await actions.editMessage('reply', id, body);
      return;
    }
    await actions.addReply(d.id, body);
  };
  const startEdit = (r) => { setEditing(r.id); setReply(r.body); };
  const cancelEdit = () => { setEditing(null); setReply(''); };

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
          {d.replies.map((r) => {
            const hearts = r.reactions || [];
            const mine = hearts.includes(currentUser.id);
            // Only where there is something to offer — see IssueDetail.
            const editable = r.authorId === currentUser.id && canStillEdit(r.createdAt);
            return (
              <div key={r.id} style={{ display: 'flex', gap: 11 }}>
                <Avatar user={userById(r.authorId)} size={34} />
                <div className="comment-col">
                  <div className={`comment-bubble${editable ? ' comment-bubble--held' : ''}`}
                    {...bindHold((el) => setMenu({ id: r.id, anchor: el.getBoundingClientRect() }), editable)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13.5 }}>{userById(r.authorId).name}</span>
                      <span className="faint" style={{ fontSize: 11.5 }}>
                        {timeAgo(r.createdAt, t, lang)}{r.editedAt ? ` · ${t('msg_edited')}` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, color: '#3f433b' }}>{L(r, 'body')}</div>
                    <HeartButton on={mine} count={hearts.length}
                      label={mine ? t('react_remove') : t('react_add')}
                      onClick={() => actions.toggleReaction('reply', r.id)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* reply box */}
      <Composer value={reply} onChange={setReply} onSend={send} placeholder={t('disc_reply_ph')}
        style={{ marginTop: 20 }} editing={!!editing} onCancel={cancelEdit} />

      {menu && (
        <ActionMenu
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          items={[{
            label: t('msg_edit'),
            icon: <PencilIcon />,
            onSelect: () => startEdit(d.replies.find((x) => x.id === menu.id)),
          }]}
        />
      )}
    </div>
  );
}
