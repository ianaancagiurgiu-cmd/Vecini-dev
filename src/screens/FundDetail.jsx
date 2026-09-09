import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { useBack } from '../lib/useBack.js';
import { ScreenHeader, Avatar } from '../components/ui.jsx';
import { ActionMenu } from '../components/MessageMenu.jsx';
import { FundTotals, MyLine } from '../components/FundBits.jsx';
import { formatDate, lei, baniFromInput } from '../lib/format.js';

const Stroke = ({ d }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={d} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LockIcon = () => <Stroke d="M6 11h12v9H6v-9zM9 11V8a3 3 0 016 0v3" />;
const OpenIcon = () => <Stroke d="M6 11h12v9H6v-9zM9 11V8a3 3 0 015.9-.8" />;
const TrashIcon = () => <Stroke d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5" />;

/*
  One collection.

  Two readings of the same screen. A neighbour sees what the whole building has
  raised and what they themselves owe — never who else is behind, which is the
  decision the database enforces and this screen only reflects. Staff see the
  same totals plus the list they are keeping.
*/
export default function FundDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const back = useBack('/app/funds');
  const { data, t, lang, counted, userById, currentUser, isStaff, actions } = useApp();

  const [menu, setMenu] = useState(null);
  const [openRow, setOpenRow] = useState(null);   // which neighbour's panel is open
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [quota, setQuota] = useState('');
  const [busy, setBusy] = useState(false);

  const f = data.funds.find((x) => x.id === id);
  if (!f) return <div className="screen"><ScreenHeader title={t('fund_title')} onBack={back} /></div>;

  const mine = f.payments.filter((p) => p.userId === currentUser.id);
  const closed = !!f.closedAt;

  const dueFor = (userId) => (userId in f.quotas ? f.quotas[userId] : f.amountBani);
  const paidBy = (userId) => f.payments.filter((p) => p.userId === userId)
    .reduce((s, p) => s + p.amountBani, 0);

  const openPanel = (m) => {
    const rest = Math.max(0, dueFor(m.userId) - paidBy(m.userId));
    setOpenRow(openRow === m.userId ? null : m.userId);
    // Prefilled with what is still owed, which is what gets handed over nine
    // times in ten — and still typed over freely when it is not.
    setAmount(rest > 0 ? String(rest / 100) : '');
    setPaidOn('');
    setQuota(String(dueFor(m.userId) / 100));
  };

  const save = async (forUserId) => {
    const bani = baniFromInput(amount);
    if (!bani || busy) return;
    setBusy(true);
    try {
      await actions.recordPayment(f.id, forUserId, bani, paidOn || null, '');
      setOpenRow(null);
    } catch (e) { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  const saveQuota = async (forUserId) => {
    const bani = baniFromInput(quota);
    if (bani === null || busy) return;
    setBusy(true);
    try { await actions.setQuota(f.id, forUserId, bani === f.amountBani ? null : bani); }
    catch (e) { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  const items = [
    {
      label: closed ? t('fund_reopen') : t('fund_close'),
      icon: closed ? <OpenIcon /> : <LockIcon />,
      onSelect: () => actions.setFundClosed(f.id, !closed).catch(() => {}),
    },
    {
      label: t('fund_remove'), icon: <TrashIcon />, tone: 'danger',
      onSelect: async () => {
        try { await actions.removeFund(f.id); nav('/app/funds'); } catch (e) { /* said already */ }
      },
    },
  ];

  return (
    <div className="screen">
      <ScreenHeader title={t('fund_title')} onBack={back}
        right={isStaff ? (
          <button aria-label={t('fund_actions')} title={t('fund_actions')}
            onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}
            style={{
              width: 38, height: 38, borderRadius: 11, marginRight: -8, background: 'none',
              border: 'none', color: 'var(--ink-300)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
        ) : null} />

      <div className="pad" style={{ paddingTop: 18 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {closed && <span className="badge" style={{ background: 'var(--section-bg)', color: 'var(--ink-400)' }}>{t('fund_closed_badge')}</span>}
          {f.dueOn && !closed && (
            <span className="badge" style={{ background: 'var(--status-done-bg)', color: 'var(--green-600)' }}>
              📅 {t('fund_due_by')} {formatDate(f.dueOn, lang)}
            </span>
          )}
        </div>

        <h1 className="serif" style={{ fontSize: 23, fontWeight: 600, lineHeight: 1.25, margin: '0 0 16px' }}>{f.title}</h1>

        <div className="card" style={{ marginBottom: 14 }}>
          <FundTotals fund={f} />
        </div>

        {/* your own line, and the receipts behind it */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{t('fund_me_head')}</div>
          <MyLine fund={f} />
          {mine.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mine.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span className="muted">{formatDate(p.paidOn, lang)}</span>
                  <span style={{ fontWeight: 700 }}>{lei(p.amountBani, lang)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {f.description && (
          <div style={{ fontSize: 15, lineHeight: 1.6, color: '#3f433b', whiteSpace: 'pre-wrap', marginBottom: 18 }}>
            {f.description}
          </div>
        )}

        {/*
          The register itself, for the people keeping it.

          Everyone is listed, including those who owe nothing and those who are
          done — a list of debtors only would answer "who is behind" and not
          "have I written down what Ana gave me", which is the question an
          administrator actually has in front of them.
        */}
        {isStaff && (
          <>
            <div className="eyebrow" style={{ margin: '4px 0 10px' }}>{t('fund_register')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.members.map((m) => {
                const u = userById(m.userId);
                const due = dueFor(m.userId);
                const paid = paidBy(m.userId);
                const rest = Math.max(0, due - paid);
                const theirs = f.payments.filter((p) => p.userId === m.userId);
                return (
                  <div key={m.userId} className="card" style={{ padding: 12 }}>
                    <button onClick={() => openPanel(m)}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}>
                      <Avatar user={u} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {u.name}
                          {u.apartment && <span className="faint" style={{ fontWeight: 500 }}> · {u.apartment}</span>}
                        </div>
                        <div className="muted" style={{ fontSize: 12.5, marginTop: 1 }}>
                          {due === 0
                            ? t('fund_me_exempt')
                            : `${lei(paid, lang)} ${t('fund_of')} ${lei(due, lang)}`}
                        </div>
                      </div>
                      {due > 0 && (
                        <span style={{
                          flexShrink: 0, fontSize: 12.5, fontWeight: 700,
                          color: rest === 0 ? 'var(--green-600)' : 'var(--terracotta)',
                        }}>
                          {rest === 0 ? '✓' : lei(rest, lang)}
                        </span>
                      )}
                    </button>

                    {openRow === m.userId && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        {theirs.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                            {theirs.map((p) => (
                              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                                <span className="muted">{formatDate(p.paidOn, lang)}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <strong>{lei(p.amountBani, lang)}</strong>
                                  <button aria-label={t('fund_payment_remove')} title={t('fund_payment_remove')}
                                    onClick={() => actions.removePayment(p.id).catch(() => {})}
                                    style={{ background: 'none', border: 'none', color: 'var(--ink-300)', padding: 4 }}>
                                    <TrashIcon />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="eyebrow" style={{ marginBottom: 6 }}>{t('fund_record')}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="input" inputMode="decimal" value={amount} placeholder="0"
                            aria-label={t('fund_f_paid_amount')}
                            onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
                          <input className="input" type="date" value={paidOn}
                            aria-label={t('fund_f_paid_on')}
                            onChange={(e) => setPaidOn(e.target.value)} style={{ flex: 1 }} />
                        </div>
                        <button className="btn btn--primary" style={{ marginTop: 10 }}
                          disabled={!baniFromInput(amount) || busy} onClick={() => save(m.userId)}>
                          {t('fund_record_cta')}
                        </button>

                        {/* The exception, in the same place as the payment: an
                            administrator who opens this row is looking at one
                            household, and both things they might do to it
                            belong here rather than on a screen of their own. */}
                        <div className="eyebrow" style={{ margin: '16px 0 6px' }}>{t('fund_quota')}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="input" inputMode="decimal" value={quota}
                            aria-label={t('fund_quota')}
                            onChange={(e) => setQuota(e.target.value)} style={{ flex: 1 }} />
                          <button className="btn" style={{ width: 'auto', padding: '0 16px', background: '#fff', border: '1px solid var(--input-border)', color: 'var(--green-600)' }}
                            disabled={baniFromInput(quota) === null || busy} onClick={() => saveQuota(m.userId)}>
                            {t('ann_save')}
                          </button>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{t('fund_quota_hint')}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 14 }}>
              {t('fund_privacy_note')}
            </div>
          </>
        )}
      </div>

      {menu && <ActionMenu anchor={menu} items={items} onClose={() => setMenu(null)} />}
    </div>
  );
}
