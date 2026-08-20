import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { ScreenHeader } from '../components/ui.jsx';

/*
  Giving up an account.

  Nothing about this screen tries to talk anyone out of it. What it does try to
  do is make sure the decision is an informed one, because the two halves are
  easy to get wrong in opposite directions: people expect their name to vanish
  and it does, and they expect everything they ever wrote to vanish with it,
  which it does not. Saying both plainly, before the button, is the whole job.

  The confirmation is typed rather than tapped. This cannot be undone by us or
  by anyone else, and a stray tap on a phone is not a decision.
*/

function Panel({ tone, title, children }) {
  const bg = tone === 'warn' ? 'var(--status-prog-bg)' : 'var(--status-done-bg)';
  const fg = tone === 'warn' ? 'var(--amber)' : 'var(--green-600)';
  return (
    <div className="card" style={{ background: bg, border: 'none', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: fg, marginBottom: 5 }}>{title}</div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-900)' }}>{children}</p>
    </div>
  );
}

export default function DeleteAccount() {
  const nav = useNavigate();
  const { t, role, deleteAccount, showToast } = useApp();
  const [typed, setTyped] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const word = t('del_confirm_word');
  // Case and diacritics are not the point; intent is.
  const matches = typed.trim().toUpperCase() === word.toUpperCase();

  const submit = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setErr('');
    try {
      await deleteAccount();
      showToast(t('del_done'));
      nav('/', { replace: true });
    } catch (e) {
      setErr(t('del_error'));
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('del_title')} onBack={() => nav('/app/settings/account')} />
      <div className="pad" style={{ paddingTop: 18 }}>
        <p style={{ margin: '0 0 18px', fontSize: 15, lineHeight: 1.55, fontWeight: 600 }}>{t('del_lead')}</p>

        <Panel title={t('del_gone_title')} tone="warn">{t('del_gone_body')}</Panel>
        <Panel title={t('del_keep_title')}>{t('del_keep_body')}</Panel>

        {/* Only an admin needs to know this, and they need to know it here. */}
        {role === 'admin' && (
          <p className="muted" style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.5 }}>
            {t('del_admin_note')}
          </p>
        )}

        <label className="field-label" style={{ marginTop: 6 }}>
          {t('del_confirm_label').replace('{word}', word)}
        </label>
        <input className="input" value={typed} autoCapitalize="characters" autoCorrect="off" spellCheck="false"
          onChange={(e) => { setTyped(e.target.value); setErr(''); }} style={{ marginBottom: 16 }} />

        {err && <div style={{ color: 'var(--terracotta)', fontSize: 13.5, fontWeight: 600, marginBottom: 12 }}>{err}</div>}

        <button className="btn btn--terracotta" disabled={!matches || busy} onClick={submit}
          style={{ opacity: matches ? 1 : .45 }}>
          {t('del_cta')}
        </button>
        <button onClick={() => nav('/app/settings/account')} style={{
          background: 'none', border: 'none', width: '100%', marginTop: 12,
          color: 'var(--ink-400)', fontSize: 14, fontWeight: 600, padding: 8,
        }}>{t('cancel')}</button>
      </div>
    </div>
  );
}
