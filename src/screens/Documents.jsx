import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { useBack } from '../lib/useBack.js';
import { ScreenHeader, Empty } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';

/*
  Documentele asociației.

  The answer to "unde e procesul-verbal de la ultima adunare?", which in most
  associations is "at the administrator's, in a folder" — and therefore, in
  practice, nowhere.

  Everybody reads; only staff add. Files live in a private bucket and are
  opened through a link that expires, because a permanent public address for a
  contract is forwardable to anyone for ever.
*/

export const KINDS = ['minutes', 'decision', 'contract', 'invoice', 'other'];
const ICON = { minutes: '📝', decision: '⚖️', contract: '📄', invoice: '🧾', other: '📎' };

const kb = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function Documents() {
  const nav = useNavigate();
  const back = useBack('/app/settings');
  const [params] = useSearchParams();
  const { data, t, lang, userById, isStaff, actions } = useApp();

  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(null);
  const fileRef = useRef(null);

  // Arriving from a collection: what gets added here belongs to it.
  const fundId = params.get('fund') || null;
  const fund = fundId ? data.funds.find((f) => f.id === fundId) : null;

  const list = data.documents
    .filter((d) => (fundId ? d.fundId === fundId : true))
    .filter((d) => (filter === 'all' ? true : d.kind === filter));

  /*
    The file dialogue is opened by a hidden input rather than by a styled one:
    a file input cannot be made to look like anything else, and it is the only
    element allowed to open the picker.
  */
  const pick = () => fileRef.current?.click();

  const onPicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';           // so the same file can be chosen twice
    if (!file || busy) return;
    setBusy(true);
    try {
      await actions.addDocument({
        // The file's own name is the title unless somebody renames it later —
        // asking for one before the upload is a form in front of a task that
        // does not need it.
        file, title: file.name.replace(/\.[^.]+$/, ''), kind: 'other', fundId,
      });
    } catch (err) { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  const open = async (doc) => {
    if (opening) return;
    setOpening(doc.id);
    const url = await actions.documentUrl(doc.path);
    setOpening(null);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('doc_title')} onBack={back}
        kicker={fund ? fund.title : null} />

      {isStaff && (
        <div className="pad" style={{ paddingTop: 14 }}>
          <input ref={fileRef} type="file" onChange={onPicked} style={{ display: 'none' }}
            accept="application/pdf,image/*" aria-hidden="true" tabIndex={-1} />
          <button className="btn btn--primary" onClick={pick} disabled={busy}>
            {busy ? t('doc_uploading') : `+ ${t('doc_add')}`}
          </button>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.45 }}>{t('doc_add_hint')}</div>
        </div>
      )}

      {!fundId && (
        <div className="pad" style={{ paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setFilter('all')} className={'pill' + (filter === 'all' ? ' pill--active' : '')}>
            {t('doc_k_all')}
          </button>
          {KINDS.filter((k) => k !== 'other').map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={'pill' + (filter === k ? ' pill--active' : '')}>
              {t('doc_k_' + k)}
            </button>
          ))}
        </div>
      )}

      <div className="pad" style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {list.length === 0 && <Empty icon="📄">{t(isStaff ? 'doc_empty_staff' : 'doc_empty')}</Empty>}
        {list.map((d) => (
          <div key={d.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => open(d)}
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, textAlign: 'left' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{ICON[d.kind] || ICON.other}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.title}
                </span>
                <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>
                  {t('doc_k_' + d.kind)} · {formatDate(d.createdAt, lang)} · {kb(d.sizeBytes)}
                </span>
              </span>
            </button>
            {isStaff && (
              <button aria-label={t('doc_remove')} title={t('doc_remove')}
                onClick={() => actions.removeDocument(d.id).catch(() => {})}
                style={{ background: 'none', border: 'none', color: 'var(--ink-300)', padding: 6, flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5"
                    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Said once, at the foot, rather than on every row. */}
      <div className="pad muted" style={{ fontSize: 12.5, lineHeight: 1.5, paddingTop: 4 }}>
        {t('doc_privacy_note')}
      </div>
    </div>
  );
}
