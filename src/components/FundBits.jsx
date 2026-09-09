import { useApp } from '../state/store.jsx';
import { lei } from '../lib/format.js';

/*
  The pieces both fund screens draw, kept in one place so the list and the
  detail cannot drift into describing the same collection differently.
*/

/*
  How far along the collection is.

  Capped at 100%: people overpay by rounding up, and a bar sticking out past
  its own track reads as a bug rather than as good news. The number beside it
  is not capped, so the overpayment is still visible where it belongs.
*/
export function Progress({ collected, target }) {
  const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;
  return (
    <div style={{ height: 8, borderRadius: 999, background: 'var(--section-bg)', overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 999,
        background: pct >= 100 ? 'var(--green-500)' : 'var(--green-600)',
        transition: 'width .3s ease',
      }} />
    </div>
  );
}

/*
  What the collection has raised, said twice: in money and in homes.

  Both, because either alone misleads. Money alone hides that one household
  paid half of it; homes alone hide that the half still missing is the
  expensive half.
*/
export function FundTotals({ fund }) {
  const { t, lang, counted } = useApp();
  return (
    <>
      <Progress collected={fund.collectedBani} target={fund.targetBani} />
      <div className="muted" style={{ fontSize: 12.5, marginTop: 7, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <span><strong style={{ color: 'var(--green-600)' }}>{lei(fund.collectedBani, lang)}</strong> {t('fund_of')} {lei(fund.targetBani, lang)}</span>
        <span style={{ flexShrink: 0 }}>{fund.homesPaid} {t('fund_of')} {counted('fund_homes', fund.homes)}</span>
      </div>
    </>
  );
}

/*
  Your own line.

  Three states, and the third is the one worth having: a home that owes
  nothing towards this collection has to say so, or its owner reads "ai de
  plătit 0 lei" and wonders what they have missed.
*/
export function MyLine({ fund, compact }) {
  const { t, lang } = useApp();
  const rest = Math.max(0, fund.myDueBani - fund.myPaidBani);

  if (fund.myDueBani === 0) {
    return <span className="muted" style={{ fontSize: compact ? 13 : 14 }}>{t('fund_me_exempt')}</span>;
  }
  if (rest === 0) {
    return (
      <span style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: 'var(--green-600)' }}>
        ✓ {t('fund_me_settled')}
      </span>
    );
  }
  return (
    <span style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: 'var(--terracotta)' }}>
      {t('fund_me_owes')} {lei(rest, lang)}
      {fund.myPaidBani > 0 && (
        <span className="muted" style={{ fontWeight: 500 }}> · {t('fund_me_paid_so_far')} {lei(fund.myPaidBani, lang)}</span>
      )}
    </span>
  );
}
