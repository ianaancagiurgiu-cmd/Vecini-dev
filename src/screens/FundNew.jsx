import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store.jsx';
import { useBack } from '../lib/useBack.js';
import { ScreenHeader } from '../components/ui.jsx';
import { lei, baniFromInput } from '../lib/format.js';

/*
  Opening a collection.

  What is asked for is the amount one home owes, not the total to raise. The
  total is the multiplication of that by the homes, and showing it as it is
  typed is worth more than a second field: an administrator who means to raise
  five thousand can see immediately that 250 a home comes to exactly that, and
  a target stored separately would be one more number able to disagree with
  the quotas underneath it.
*/
export default function FundNew() {
  const nav = useNavigate();
  const back = useBack('/app/funds');
  const { data, t, lang, counted, isStaff, actions } = useApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isStaff) return <div className="screen"><ScreenHeader title={t('fund_new')} onBack={back} /></div>;

  const homes = data.members.length;
  const bani = baniFromInput(amount);
  const ready = title.trim().length > 1 && bani !== null && bani > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const id = await actions.addFund({
        title: title.trim(), description: description.trim(), amountBani: bani, dueOn: due || null,
      });
      nav('/app/funds/' + id, { replace: true });
    } catch (e) { /* the store has already said so */ }
    finally { setBusy(false); }
  };

  return (
    <div className="screen">
      <ScreenHeader title={t('fund_new')} onBack={back} />
      <div className="pad" style={{ paddingTop: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{t('fund_f_title')}</div>
        <input id="fund-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={t('fund_f_title_ph')} />

        <div className="eyebrow" style={{ margin: '18px 0 6px' }}>{t('fund_f_amount')}</div>
        <input id="fund-amount" className="input" inputMode="decimal" value={amount}
          onChange={(e) => setAmount(e.target.value)} placeholder="250" />
        {/*
          The multiplication, as it is typed. It is also the only place the
          number of homes appears, which matters: a collection opened in a
          block of twenty raises a different sum from the same amount in a
          block of four, and the administrator should see which they are in.
        */}
        <div className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.45 }}>
          {bani !== null && bani > 0
            ? `${counted('fund_homes', homes)} × ${lei(bani, lang)} = `
            : t('fund_f_amount_hint')}
          {bani !== null && bani > 0 && (
            <strong id="fund-total" style={{ color: 'var(--green-600)' }}>{lei(bani * homes, lang)}</strong>
          )}
        </div>

        <div className="eyebrow" style={{ margin: '18px 0 6px' }}>{t('fund_f_due')}</div>
        <input id="fund-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{t('fund_f_due_hint')}</div>

        <div className="eyebrow" style={{ margin: '18px 0 6px' }}>{t('fund_f_desc')}</div>
        <textarea id="fund-desc" className="input" rows={4} value={description}
          onChange={(e) => setDescription(e.target.value)} placeholder={t('fund_f_desc_ph')} />

        <button className="btn btn--primary" style={{ marginTop: 20 }} disabled={!ready || busy} onClick={submit}>
          {t('fund_publish')}
        </button>
      </div>
    </div>
  );
}
