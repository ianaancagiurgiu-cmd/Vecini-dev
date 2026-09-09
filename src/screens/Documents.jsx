import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { useBack } from '../lib/useBack.js';
import { ScreenHeader, Empty } from '../components/ui.jsx';
import { ActionMenu } from '../components/MessageMenu.jsx';
import { formatDate } from '../lib/format.js';

/*
  Documentele asociației.

  The answer to "unde e procesul-verbal de la ultima adunare?", which in most
  associations is "at the administrator's, in a folder" — and therefore, in
  practice, nowhere.

  Everybody reads; only staff add. Files live in a private bucket and are
  opened through a link that expires, because a permanent public address for a
  contract is forwardable to anyone for ever.

  Naming and filing happen after the upload rather than before it. A form in
  front of the file picker is a form in front of a task that does not need one,
  so the upload takes the file's own name and the "⋯" fixes it — and the panel
  opens by itself on something just uploaded, which is the one moment somebody
  actually knows what the thing is called.
*/

export const KINDS = ['minutes', 'decision', 'contract', 'invoice', 'other'];
const ICON = { minutes: '📝', decision: '⚖️', contract: '📄', invoice: '🧾', other: '📎' };

const kb = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

const Dots = ({ onClick, label }) => (
  <button aria-label={label} title={label} onClick={onClick}
    style={{
      width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'none',
      border: 'none', padding: 0, color: 'var(--ink-300)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
    </svg>
  </button>
);

const Stroke = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const PencilIcon = () => <Stroke d="M4 20h4L19.5 8.5a2.1 2.1 0 00-3-3L5 17v3zM14.5 6.5l3 3" />;
const TagIcon = () => <Stroke d="M4 12.5V5h7.5l8 8-7 7-8.5-8.5zM8 8.5h.01" />;
const TrashIcon = () => <Stroke d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5" />;

export default function Documents() {
  const nav = useNavigate();
  const back = useBack('/app/settings');
  const [params] = useSearchParams();
  const { data, t, lang, isStaff, actions } = useApp();

  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(null);
  const [menu, setMenu] = useState(null);          // { id, anchor }
  const [editing, setEditing] = useState(null);    // { id, mode: 'title' | 'kind' }
  const [draft, setDraft] = useState('');
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
      const id = await actions.addDocument({
        file, title: file.name.replace(/\.[^.]+$/, ''), kind: 'other', fundId,
      });
      // Straight into naming it: the file's own name is a starting point, not
      // a title, and this is the moment somebody knows the difference.
      if (id) { setEditing({ id, mode: 'title' }); setDraft(file.name.replace(/\.[^.]+$/, '')); }
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

  const saveTitle = async (doc) => {
    if (!draft.trim()) return;
    try { await actions.updateDocument(doc.id, { title: draft }); setEditing(null); }
    catch (err) { /* said already */ }
  };

  const items = (doc) => [
    {
      label: t('doc_rename'),
      icon: <PencilIcon />,
      onSelect: () => { setEditing({ id: doc.id, mode: 'title' }); setDraft(doc.title); },
    },
    {
      label: t('doc_kind_set'),
      icon: <TagIcon />,
      onSelect: () => setEditing({ id: doc.id, mode: 'kind' }),
    },
    {
      label: t('doc_remove'), icon: <TrashIcon />, tone: 'danger',
      onSelect: () => actions.removeDocument(doc.id).catch(() => {}),
    },
  ];

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
          <div key={d.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
              {/* One button rather than a row of icons, as everywhere else in
                  the app: the actions get their names inside the menu. */}
              {isStaff && (
                <Dots label={t('doc_actions')}
                  onClick={(e) => setMenu({ id: d.id, anchor: e.currentTarget.getBoundingClientRect() })} />
              )}
            </div>

            {isStaff && editing?.id === d.id && editing.mode === 'title' && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>{t('doc_rename')}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={draft} aria-label={t('doc_rename')}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTitle(d)} style={{ flex: 1 }} />
                  <button className="btn btn--primary" style={{ width: 'auto', padding: '0 16px' }}
                    disabled={!draft.trim()} onClick={() => saveTitle(d)}>{t('ann_save')}</button>
                </div>
              </div>
            )}

            {isStaff && editing?.id === d.id && editing.mode === 'kind' && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>{t('doc_kind_set')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {KINDS.map((k) => (
                    <button key={k} className={'pill' + (d.kind === k ? ' pill--active' : '')}
                      onClick={async () => {
                        try { await actions.updateDocument(d.id, { kind: k }); setEditing(null); }
                        catch (err) { /* said already */ }
                      }}>
                      {t('doc_k_' + k)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Said once, at the foot, rather than on every row. */}
      <div className="pad muted" style={{ fontSize: 12.5, lineHeight: 1.5, paddingTop: 4 }}>
        {t('doc_privacy_note')}
      </div>

      {menu && (
        <ActionMenu anchor={menu.anchor} onClose={() => setMenu(null)}
          items={items(data.documents.find((x) => x.id === menu.id) || {})} />
      )}
    </div>
  );
}
