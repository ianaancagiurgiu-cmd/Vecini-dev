import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';

/*
  Every association this account is in, and the way between them.

  One account can be in several: someone who owns a flat in one block and
  lives in another, an administrator who looks after two buildings. Until this
  screen the app only ever showed one of them — whichever had been opened last
  — and joining a second made the first unreachable, with no way back short of
  clearing the browser.

  Each row says what is yours there: your role, your flat, and whether
  something new is waiting. The one on screen is marked, and leaving is
  offered for that one only, so it is always clear which is meant.
*/
export default function Communities() {
  const nav = useNavigate();
  const { t, data, activeCommunityId, myCommunities, switchCommunity, leaveCommunity, loadMyCommunities, showToast } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Unread counts change while you are elsewhere; ask again on arrival.
  useEffect(() => { loadMyCommunities(); }, [loadMyCommunities]);

  const list = myCommunities || [];
  const fill = (key, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), t(key));
  const roleLabel = (r) => (r === 'admin' ? t('role_admin') : r === 'moderator' ? t('role_moderator') : t('role_member'));
  const here = data.community?.name || '';

  const open = (c) => {
    if (c.id === activeCommunityId) { nav('/app'); return; }
    switchCommunity(c.id);
    showToast(fill('com_switched', { name: c.name }));
    nav('/app');
  };

  const leave = async () => {
    setBusy(true);
    try {
      const next = await leaveCommunity();
      showToast(fill('com_left', { name: here }));
      nav(next ? '/app' : '/join', { replace: true });
    } catch (e) {
      showToast(t(/last_admin/.test(e?.message || '') ? 'com_leave_last_admin' : 'com_leave_error'));
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('com_title')} onBack={() => nav('/app/settings')} />
      <div className="pad" style={{ paddingTop: 16 }}>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: '0 0 14px' }}>{t('com_intro')}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {list.map((c) => {
            const current = c.id === activeCommunityId;
            return (
              <button key={c.id} onClick={() => open(c)} className="card" data-community={c.id}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, borderColor: current ? 'var(--green-600)' : undefined }}>
                <span style={{ fontSize: 22 }}>{c.kind === 'houses' ? '🏡' : '🏢'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, overflowWrap: 'anywhere' }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {roleLabel(c.role)}{c.apartment ? ` · ${c.apartment}` : ''}
                  </div>
                </div>
                {current ? (
                  <span className="badge" style={{ background: 'var(--status-done-bg)', color: 'var(--green-500)' }}>{t('com_current')}</span>
                ) : c.unread > 0 ? (
                  <span className="badge" style={{ background: 'var(--terracotta)', color: '#fff' }}>{fill('com_unread', { n: c.unread })}</span>
                ) : (
                  <span className="faint" style={{ fontSize: 18 }}>›</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 18 }}>
          <button className="btn btn--ghost" onClick={() => nav('/join')}>{t('com_join')}</button>
          <button className="btn btn--ghost" onClick={() => nav('/create')}>{t('com_create')}</button>
        </div>

        {here && (
          <div style={{ marginTop: 28 }}>
            {confirming ? (
              <div style={{ background: 'var(--section-bg)', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10, lineHeight: 1.45 }}>{t('com_leave_confirm')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirming(false)} className="btn btn--ghost" style={{ flex: 1, padding: '10px', fontSize: 13.5 }}>{t('cancel')}</button>
                  <button onClick={leave} disabled={busy} className="btn btn--terracotta"
                    style={{ flex: 1, padding: '10px', fontSize: 13.5, opacity: busy ? 0.5 : 1 }}>{t('com_leave_yes')}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)}
                style={{ background: 'none', border: 'none', color: 'var(--terracotta)', fontSize: 14, fontWeight: 600, width: '100%', textAlign: 'center', padding: 8 }}>
                {fill('com_leave', { name: here })}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/*
  A line pointing at new notifications in another of your communities. Shown
  where you would look for news — the home screen and the notifications list —
  because those are counted per community and would otherwise say nothing.
*/
export function ElsewhereNotice() {
  const nav = useNavigate();
  const { t, activeCommunityId, myCommunities, switchCommunity } = useApp();
  const other = (myCommunities || []).find((c) => c.id !== activeCommunityId && c.unread > 0);
  if (!other) return null;
  return (
    <button onClick={() => { switchCommunity(other.id); nav('/app/notifications'); }} className="card" data-elsewhere={other.id}
      style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--status-new-bg)', borderColor: 'transparent', width: '100%' }}>
      <span style={{ fontSize: 18 }}>🔔</span>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--status-new-fg)' }}>
        {t('com_elsewhere').replace('{name}', other.name)}
      </span>
      <span className="badge" style={{ background: 'var(--terracotta)', color: '#fff' }}>{other.unread}</span>
    </button>
  );
}
