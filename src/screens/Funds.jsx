import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { useBack } from '../lib/useBack.js';
import { ScreenHeader, AddButton, Empty } from '../components/ui.jsx';
import { FundTotals, MyLine } from '../components/FundBits.jsx';
import { formatDate } from '../lib/format.js';

/*
  The association's collections.

  Open ones first, finished ones underneath and quieter — a collection that is
  over is not news, but it is the answer to "what happened with the money for
  the roof", which is a question people ask a year later.
*/
export default function Funds() {
  const nav = useNavigate();
  const back = useBack('/app');
  const { data, t, lang, isStaff } = useApp();

  const open = data.funds.filter((f) => !f.closedAt);
  const closed = data.funds.filter((f) => f.closedAt);

  const Card = ({ f, dim }) => (
    <button onClick={() => nav('/app/funds/' + f.id)} className="card"
      style={{ textAlign: 'left', display: 'block', width: '100%', opacity: dim ? .72 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
        <span className="serif" style={{ fontSize: 16.5, fontWeight: 600 }}>{f.title}</span>
        {f.dueOn && !f.closedAt && (
          <span className="faint" style={{ fontSize: 11.5, flexShrink: 0 }}>{formatDate(f.dueOn, lang)}</span>
        )}
      </div>
      <FundTotals fund={f} />
      <div style={{ marginTop: 10 }}><MyLine fund={f} compact /></div>
    </button>
  );

  return (
    <div className="screen">
      <ScreenHeader title={t('fund_title')} onBack={back}
        right={isStaff ? <AddButton onClick={() => nav('/app/funds/new')} label={t('fund_new')} /> : null} />

      <div className="pad" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {data.funds.length === 0 && <Empty icon="💶">{t('fund_empty')}</Empty>}
        {open.map((f) => <Card key={f.id} f={f} />)}

        {closed.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginTop: 12 }}>{t('fund_closed_head')}</div>
            {closed.map((f) => <Card key={f.id} f={f} dim />)}
          </>
        )}
      </div>
    </div>
  );
}
