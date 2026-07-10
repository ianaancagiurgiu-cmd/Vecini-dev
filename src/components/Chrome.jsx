import { useState } from 'react';
import { useApp } from '../state/store.jsx';

function StatusBar() {
  return (
    <div className="statusbar">
      <span className="statusbar__time">9:41</span>
      <span className="statusbar__icons" aria-hidden>
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none"><rect x="0" y="7" width="3" height="5" rx="1" fill="#232620"/><rect x="4.5" y="4.5" width="3" height="7.5" rx="1" fill="#232620"/><rect x="9" y="2" width="3" height="10" rx="1" fill="#232620"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#232620" opacity=".35"/></svg>
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><path d="M8.5 2.5c2.3 0 4.4.9 6 2.4M8.5 2.5c-2.3 0-4.4.9-6 2.4M8.5 6.2c1.2 0 2.3.5 3.1 1.3M8.5 6.2c-1.2 0-2.3.5-3.1 1.3" stroke="#232620" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8.5" cy="10" r="1.1" fill="#232620"/></svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none"><rect x="1" y="1" width="21" height="11" rx="3" stroke="#232620" strokeWidth="1.2" opacity=".5"/><rect x="2.5" y="2.5" width="16" height="8" rx="1.6" fill="#232620"/><rect x="23.5" y="4.5" width="1.6" height="4" rx=".8" fill="#232620" opacity=".5"/></svg>
      </span>
    </div>
  );
}

// Floating pill: switch role (member/mod/admin) and language.
function RoleLangBar() {
  const { role, setRoleOverride, lang, setLang, t, authed } = useApp();
  const [open, setOpen] = useState(false);
  if (!authed) {
    // Only language toggle before login
    return (
      <button onClick={() => setLang(lang === 'ro' ? 'en' : 'ro')}
        style={floatBtn} title="Language">
        {lang === 'ro' ? '🇷🇴 RO' : '🇬🇧 EN'}
      </button>
    );
  }
  const roles = [
    { k: 'member', label: t('role_member') },
    { k: 'moderator', label: t('role_moderator') },
    { k: 'admin', label: t('role_admin') },
  ];
  return (
    <div style={{ position: 'absolute', left: 12, bottom: 118, zIndex: 120, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      {open && (
        <div style={{ background: '#13211b', color: '#eaf3ed', borderRadius: 16, padding: 12, width: 210, boxShadow: '0 18px 40px -10px rgba(0,0,0,.5)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7fd1a8', marginBottom: 8 }}>{t('rolebar_hint')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {roles.map((r) => (
              <button key={r.k} onClick={() => setRoleOverride(r.k)}
                style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 10, border: 'none', fontSize: 13.5, fontWeight: 700,
                  background: role === r.k ? '#2f8c5f' : 'rgba(255,255,255,.08)', color: role === r.k ? '#fff' : '#cfe6d8' }}>
                {role === r.k ? '● ' : ''}{r.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7fd1a8', marginBottom: 8 }}>{t('set_lang')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ro', 'en'].map((l) => (
              <button key={l} onClick={() => setLang(l)}
                style={{ flex: 1, padding: '8px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                  background: lang === l ? '#2f8c5f' : 'rgba(255,255,255,.08)', color: lang === l ? '#fff' : '#cfe6d8' }}>
                {l === 'ro' ? '🇷🇴 RO' : '🇬🇧 EN'}
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} style={{ ...floatBtn, background: '#13211b', color: '#7fd1a8', display: 'flex', alignItems: 'center', gap: 6 }}>
        {open ? '✕' : '⚙︎'} <span style={{ fontSize: 12 }}>{role === 'admin' ? t('role_admin') : role === 'moderator' ? t('role_moderator') : t('role_member')}</span>
      </button>
    </div>
  );
}

const floatBtn = {
  position: 'absolute', left: 12, bottom: 24, zIndex: 120,
  border: 'none', borderRadius: 999, padding: '10px 14px',
  background: '#13211b', color: '#eaf3ed', fontSize: 13, fontWeight: 700,
  boxShadow: '0 10px 24px -8px rgba(0,0,0,.5)', cursor: 'pointer',
};

export function PhoneChrome({ children }) {
  return (
    <div className="stage">
      <div className="phone">
        <div className="phone__notch" />
        <StatusBar />
        <div className="phone__scroll">
          {children}
        </div>
        <RoleLangBar />
      </div>
    </div>
  );
}
