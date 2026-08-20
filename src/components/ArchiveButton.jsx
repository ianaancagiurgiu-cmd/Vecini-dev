import { useState } from 'react';
import { useApp } from '../state/store.jsx';

/*
  The put-away control that sits on a list card.

  It is a sibling of the card, laid over its top-right corner, rather than a
  child of it: the card is itself a button, and a button inside a button is
  invalid and behaves unpredictably about which one a tap belongs to.

  Quiet by default. A row of loud icons down the side of a list is the opposite
  of what someone reaching for this wants.
*/

const BoxIcon = ({ out }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="4.5" rx="1.4" />
    <path d="M4.6 8.5V19a1.4 1.4 0 0 0 1.4 1.4h12a1.4 1.4 0 0 0 1.4-1.4V8.5" />
    {/* An arrow out of the box when it is already in there, into it when not. */}
    {out
      ? <path d="M12 17.2v-5.4M9.6 14.2 12 11.8l2.4 2.4" />
      : <path d="M12 11.8v5.4M9.6 14.8 12 17.2l2.4-2.4" />}
  </svg>
);

export default function ArchiveButton({ kind, id, archived }) {
  const { t, actions, showToast } = useApp();
  const [busy, setBusy] = useState(false);

  // No stopPropagation needed, and none here: being a sibling rather than a
  // child means a tap on this never reaches the card in the first place.
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await actions.setArchived(kind, id, !archived);
      showToast(t(archived ? 'arch_restored' : 'arch_done'));
    } catch (e2) {
      showToast(t('arch_error'));
    } finally {
      setBusy(false);
    }
  };

  const label = t(archived ? 'arch_unarchive' : 'arch_archive');
  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      disabled={busy}
      style={{
        position: 'absolute', top: 6, right: 6,
        width: 38, height: 38, borderRadius: 11,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', padding: 0,
        color: archived ? 'var(--green-600)' : 'var(--ink-300)',
        opacity: busy ? .5 : 1,
      }}
    >
      <BoxIcon out={archived} />
    </button>
  );
}
