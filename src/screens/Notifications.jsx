import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { useBack } from '../lib/useBack.js';
import { ScreenHeader, Empty } from '../components/ui.jsx';
import { timeAgo } from '../lib/format.js';

const ICON = { announcement: '📢', issue: '🛠️', reply: '💬', poll: '🗳️' };

function Toggle({ on, onChange }) {
  return (
    <span onClick={onChange} style={{ width: 46, height: 27, borderRadius: 999, background: on ? 'var(--green-600)' : 'var(--input-border)', position: 'relative', transition: '.2s', flexShrink: 0, cursor: 'pointer' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 21, height: 21, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
    </span>
  );
}

export default function Notifications() {
  const nav = useNavigate();
  const back = useBack('/app');
  const { data, t, lang, actions, showToast } = useApp();
  const [tab, setTab] = useState('list');
  const list = [...data.notifications].sort((a, b) => b.createdAt - a.createdAt);
  const prefs = data.notifPrefs;

  const prefRows = [
    { key: 'announcements', label: t('notif_p_ann') },
    { key: 'replies', label: t('notif_p_replies') },
    { key: 'issues', label: t('notif_p_issues') },
    { key: 'polls', label: t('notif_p_polls') },
  ];

  // Push needs a browser permission prompt, so it can fail in ways a plain
  // preference cannot. Surface the reason instead of silently flipping back.
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState(null);
  const REASON_STRING = {
    'ios-install': 'push_ios_install',
    denied: 'push_denied',
    unsupported: 'push_unsupported',
    'no-key': 'push_no_key',
    error: 'push_error',
  };
  /*
    Nothing is explained up front any more. This card used to carry the
    home-screen instructions permanently, for every iPhone visitor, whether or
    not they had shown any interest in notifications; the onboarding sheet now
    walks people through installing the app, so the paragraph was both stale and
    in the way. A reason still appears the moment someone taps and it does not
    work, which is when it is actually worth reading.
  */
  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushNote(null);
    const next = !prefs.push;
    const reason = await actions.setPushEnabled(next);
    if (reason && reason !== 'dismissed') {
      setPushNote(t(REASON_STRING[reason] || 'push_error'));
    } else if (!reason) {
      showToast(next ? t('push_enabled') : t('push_disabled'));
    }
    setPushBusy(false);
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('notif_title')} onBack={back}
        right={tab === 'list' && list.some((n) => !n.read) ? <button onClick={actions.markAllRead} style={{ background: 'none', border: 'none', color: 'var(--green-600)', fontSize: 12.5, fontWeight: 700 }}>{t('notif_mark_all')}</button> : null} />
      <div className="pad" style={{ paddingTop: 14, display: 'flex', gap: 8 }}>
        <button onClick={() => setTab('list')} className={'pill' + (tab === 'list' ? ' pill--active' : '')}>{t('notif_title')}</button>
        <button onClick={() => setTab('prefs')} className={'pill' + (tab === 'prefs' ? ' pill--active' : '')}>⚙︎ {t('notif_prefs')}</button>
      </div>

      {tab === 'list' ? (
        <div className="pad" style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {list.length === 0 && <Empty icon="🔔">{t('notif_empty')}</Empty>}
          {list.map((n) => (
            <button key={n.id} onClick={() => { actions.markRead(n.id); nav(n.link); }}
              className="card" style={{ textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', background: n.read ? '#fff' : 'var(--status-done-bg)', borderColor: n.read ? 'var(--border)' : 'transparent' }}>
              <span style={{ fontSize: 20 }}>{ICON[n.type] || '🔔'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--terracotta)' }} />}
                  {(lang === 'en' && n.titleEn) ? n.titleEn : n.title}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>{(lang === 'en' && n.bodyEn) ? n.bodyEn : n.body}</div>
                <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>{timeAgo(n.createdAt, t, lang)}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="pad" style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {prefRows.map((r) => (
            <div key={r.key} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{r.label}</span>
              <Toggle on={prefs[r.key]} onChange={() => actions.setNotifPref(r.key, !prefs[r.key])} />
            </div>
          ))}

          <div className="card" style={{ opacity: pushBusy ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t('notif_push')}</span>
              <Toggle on={prefs.push} onChange={togglePush} />
            </div>
            {(pushNote || prefs.push) && (
              <div className="muted" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.45 }}>
                {pushNote || t('push_hint_on')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
