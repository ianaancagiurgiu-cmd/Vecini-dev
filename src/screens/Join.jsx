import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { AuthShell } from './AuthShell.jsx';
import { savePendingInvite, readPendingInvite, clearPendingInvite } from '../lib/invite.js';

/*
  Joining by invitation code, in the order people actually arrive:

    code -> confirm which community -> account -> inside

  This screen deliberately works while signed out. Someone holding a code has
  no account yet, so requiring one first sent them to the login screen and threw
  the code away. The code is checked first — cheap, and it catches a typo before
  they fill in a whole sign-up form — then parked until they have an account,
  and applied automatically the moment they do.

  Reached either by typing a code or by opening /#/join/CODE from a shared link.
*/
export default function Join() {
  const nav = useNavigate();
  const { code: codeFromLink } = useParams();
  const { t, joinByCode, findCommunityByCode, authed, authLoading } = useApp();

  const [code, setCode] = useState(codeFromLink || '');
  const [community, setCommunity] = useState(null);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);

  const check = useCallback(async (raw) => {
    const clean = (raw || '').trim();
    if (!clean) return null;
    setErr('');
    setChecking(true);
    try {
      const found = await findCommunityByCode(clean);
      if (!found) {
        setErr(t('join_bad_code'));
        setCommunity(null);
        return null;
      }
      setCommunity(found);
      return found;
    } catch (e) {
      setErr(t('join_bad_code'));
      return null;
    } finally {
      setChecking(false);
    }
  }, [findCommunityByCode, t]);

  const join = useCallback(async (raw) => {
    setJoining(true);
    try {
      await joinByCode(raw);
      clearPendingInvite();
      nav('/app');
    } catch (e) {
      setErr(t('join_bad_code'));
      setJoining(false);
    }
  }, [joinByCode, nav, t]);

  // Opened from a shared link: check the code straight away, no typing.
  useEffect(() => {
    if (codeFromLink) check(codeFromLink);
  }, [codeFromLink, check]);

  /*
    Signed in with a code waiting — the usual case right after signing up, since
    a member without a community is sent here. Join without asking again.
  */
  useEffect(() => {
    if (authLoading || !authed) return;
    const pending = codeFromLink || readPendingInvite();
    if (pending) join(pending);
  }, [authed, authLoading, codeFromLink, join]);

  if (authLoading) return null;

  if (joining) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', border: '4px solid var(--border)', borderTopColor: 'var(--green-600)', animation: 'spin .8s linear infinite' }} />
        <div className="serif" style={{ fontSize: 20, color: 'var(--green-ink)' }}>{t('join_prepare')}</div>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  // Code checked out: name the community so they can be sure before going on.
  if (community) {
    return (
      <AuthShell title={t('join_found_title')} sub={t('join_found_sub')}>
        <div className="card" style={{ textAlign: 'center', padding: '22px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🏡</div>
          <div className="serif" style={{ fontSize: 21, color: 'var(--green-ink)', lineHeight: 1.3 }}>{community.name}</div>
        </div>

        {authed ? (
          <button className="btn btn--primary" onClick={() => join(code || codeFromLink)}>{t('join_cta')}</button>
        ) : (
          <>
            <button className="btn btn--primary" style={{ marginBottom: 10 }}
              onClick={() => { savePendingInvite(code || codeFromLink); nav('/signup'); }}>
              {t('join_signup_cta')}
            </button>
            <button className="btn btn--ghost"
              onClick={() => { savePendingInvite(code || codeFromLink); nav('/login'); }}>
              {t('join_login_cta')}
            </button>
          </>
        )}

        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginTop: 12, textAlign: 'center' }}>{err}</div>}

        <button onClick={() => { setCommunity(null); setCode(''); setErr(''); nav('/join', { replace: true }); }}
          style={{ background: 'none', border: 'none', color: 'var(--ink-400)', fontSize: 13.5, fontWeight: 600, marginTop: 16, width: '100%', textAlign: 'center' }}>
          {t('join_other_code')}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('join_title')} sub={t('join_sub')}
      footer={<Link to="/create" style={{ color: 'var(--green-600)', fontWeight: 700, fontSize: 14 }}>{t('join_create')}</Link>}>
      <form onSubmit={(e) => { e.preventDefault(); check(code); }}>
        <label className="field-label">{t('join_code_label')}</label>
        <input className="input" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }}
          placeholder="TEILOR-15" autoCapitalize="characters" autoCorrect="off" spellCheck="false"
          style={{ marginBottom: 16, fontSize: 20, fontWeight: 700, letterSpacing: '1.5px', textAlign: 'center', textTransform: 'uppercase', fontFamily: 'ui-monospace, monospace' }} />
        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{err}</div>}
        <button className="btn btn--primary" type="submit" disabled={!code.trim() || checking}>
          {checking ? t('join_checking') : t('join_check_cta')}
        </button>
      </form>
    </AuthShell>
  );
}
