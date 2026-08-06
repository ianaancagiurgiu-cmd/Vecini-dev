import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';

export default function CommunitySettings() {
  const nav = useNavigate();
  const { data, t, lang, role, actions, showToast } = useApp();
  const c = data.community;
  const [name, setName] = useState(c?.name || '');
  const [desc, setDesc] = useState(c?.description || '');
  const [joinMode, setJoinMode] = useState(c?.joinMode || 'invite');
  const [confirmRegen, setConfirmRegen] = useState(false);
  if (role !== 'admin') { nav('/app/admin'); return null; }
  if (!c) return null;

  const joinModes = [
    { k: 'open', label: t('admin_join_open') },
    { k: 'invite', label: t('admin_join_invite') },
    { k: 'approval', label: t('admin_join_approval') },
  ];

  const save = async () => { await actions.saveCommunity({ name: name.trim() || c.name, description: desc.trim(), joinMode }); };
  const copy = () => { navigator.clipboard?.writeText(c.code); showToast(t('admin_invite_copied')); };
  const regen = async () => { setConfirmRegen(false); await actions.regenCode(); showToast(t('admin_saved')); };

  return (
    <div className="screen">
      <ScreenHeader title={t('admin_settings')} onBack={() => nav('/app/admin')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        {/* invite code card */}
        <div className="card" style={{ background: 'linear-gradient(135deg,#2f6b4f,#245840)', border: 'none', color: '#eaf3ed', marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.5px', color: '#bcd4c5', marginBottom: 10 }}>{t('admin_invite').toUpperCase()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 24, fontWeight: 700, letterSpacing: '1px' }}>{c.code}</div>
            <button onClick={copy} style={{ border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', borderRadius: 11, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>⧉ {t('admin_invite_copy')}</button>
          </div>
          <div style={{ fontSize: 12, color: '#bcd4c5', marginTop: 10 }}>vecini.app/join/{c.code}</div>
          {confirmRegen ? (
            <div style={{ marginTop: 14, background: 'rgba(0,0,0,.2)', borderRadius: 11, padding: 12 }}>
              <div style={{ fontSize: 12.5, marginBottom: 10 }}>{t('admin_invite_regen_confirm')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmRegen(false)} style={{ flex: 1, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 10, padding: 9, fontSize: 13, fontWeight: 700 }}>{t('cancel')}</button>
                <button onClick={regen} style={{ flex: 1, border: 'none', background: '#fff', color: 'var(--green-700)', borderRadius: 10, padding: 9, fontSize: 13, fontWeight: 700 }}>{t('confirm')}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmRegen(true)} style={{ marginTop: 12, border: '1px solid rgba(255,255,255,.3)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, fontWeight: 600, width: '100%' }}>↻ {t('admin_invite_regen')}</button>
          )}
        </div>

        <label className="field-label">{t('admin_s_name')}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 16 }} />

        <label className="field-label">{t('admin_s_desc')}</label>
        <textarea className="input" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} style={{ marginBottom: 16 }} />

        <label className="field-label">{t('admin_s_join')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {joinModes.map((jm) => (
            <button key={jm.k} onClick={() => setJoinMode(jm.k)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 11, border: joinMode === jm.k ? '2px solid var(--green-600)' : '1px solid var(--input-border)', background: joinMode === jm.k ? 'var(--status-done-bg)' : '#fff', borderRadius: 13, padding: '13px 15px' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', border: joinMode === jm.k ? 'none' : '2px solid var(--input-border)', background: joinMode === jm.k ? 'var(--green-600)' : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{joinMode === jm.k ? '✓' : ''}</span>
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>{jm.label}</span>
            </button>
          ))}
        </div>

        <button className="btn btn--primary" onClick={save}>{t('save')}</button>
      </div>
    </div>
  );
}
