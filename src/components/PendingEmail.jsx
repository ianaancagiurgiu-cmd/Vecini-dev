import { useState } from 'react';
import { useApp } from '../state/store.jsx';

/*
  Shown while an address change is waiting to be confirmed from an inbox.

  It says more than "we sent you a link" because the next few minutes are
  genuinely confusing on a phone. The link opens in the browser, which is a
  separate copy of the app with its own storage, so it shows up signed out —
  looking for all the world like the confirmation failed. Apple gives no way for
  a link to open an installed web app, so this cannot be smoothed over; it can
  only be explained, and then undone by coming back here.

  Returning does it automatically. The button is for the moment when someone
  is standing there watching, and wants to be the one who decides.
*/
export default function PendingEmail({ email }) {
  const { t, recheckEmail, showToast } = useApp();
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    try {
      const { pending } = await recheckEmail();
      // A change that went through announces itself elsewhere, when the address
      // on the session changes. Only the still-waiting case needs saying here.
      if (pending) showToast(t('email_still_pending'));
    } catch (e) {
      showToast(t('email_still_pending'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ background: 'var(--status-new-bg)', border: 'none', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--status-new-fg)', marginBottom: 5 }}>
        {t('email_change_pending')}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--status-new-fg)' }}>
        {t('email_change_pending_body').replace('{email}', email)}
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, color: 'var(--status-new-fg)', opacity: .85 }}>
        {t('email_change_browser')}
      </p>
      <button className="btn btn--primary" disabled={busy} onClick={check} style={{ fontSize: 14, padding: '12px 16px' }}>
        {t('email_recheck')}
      </button>
    </div>
  );
}
