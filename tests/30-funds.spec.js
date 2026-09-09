import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  Fonduri — the collections, and the record of who has paid into them.

  The thing worth guarding here is not the arithmetic, it is the wall down the
  middle of it. A neighbour is shown what the building has raised and what they
  themselves owe, and must never be shown who else is behind: publishing a list
  of debtors to everyone is the part of this feature that can do harm, and it
  is one careless map() away at all times.

  The database enforces it — a member cannot read another member's payment row
  at all, and the totals come from a function that computes them behind that
  wall. These tests are about the screens keeping their side of the bargain,
  with the harness standing in for the policies.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

const ANA = 'aaaaaaaa-1111-1111-1111-111111111111';
const BOGDAN = 'bbbbbbbb-2222-2222-2222-222222222222';
const day = 86400000;
const iso = (ts) => new Date(ts).toISOString().slice(0, 10);

/*
  Four homes, 250 lei each, except Bogdan who owes nothing this time. Me: paid
  100 of my 250. Ana: settled. So 350 of 750 lei is in, and two of four homes
  are done — Ana because she paid, Bogdan because he owed nothing.

  The summary is computed here rather than derived from the payment rows on
  purpose: in the real thing it comes from a database function precisely
  because the browser cannot see the rows it would need. A fixture that
  recomputed it from the rows would be testing a wall that was not there.
*/
async function withFunds(page, { role = 'member', over = {}, funds, summary, payments } = {}) {
  const me = fakeUser();
  const fund = {
    id: 'f1', community_id: 'c1', title: 'Reparație acoperiș',
    description: 'S-a hotărât în adunarea generală.',
    amount_bani: 25000, due_on: iso(Date.now() + 20 * day),
    created_by: ANA, created_at: new Date(Date.now() - 3 * day).toISOString(), closed_at: null,
    ...over,
  };

  const rpc = { calls: [] };

  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [
        { id: 'm0', user_id: me.id, community_id: 'c1', role, joined_at: new Date().toISOString() },
        { id: 'm1', user_id: ANA, community_id: 'c1', role: 'admin', joined_at: new Date().toISOString() },
        { id: 'm2', user_id: BOGDAN, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() },
      ],
      profiles: [
        { id: me.id, full_name: me.user_metadata.full_name, apartment: 'Ap. 12', avatar_color: '#8c3c52' },
        { id: ANA, full_name: 'Ana Vecin', apartment: 'Ap. 3', avatar_color: '#2f6b4f' },
        { id: BOGDAN, full_name: 'Bogdan Ionescu', apartment: 'Ap. 8', avatar_color: '#b4532a' },
      ],
      funds: funds === undefined ? [fund] : funds,
      fund_quotas: [{ fund_id: 'f1', user_id: BOGDAN, amount_bani: 0 }],
      // Only what this person is allowed to see: their own, unless staff.
      fund_payments: payments === undefined
        ? [{ id: 'p1', fund_id: 'f1', user_id: me.id, amount_bani: 10000, paid_on: iso(Date.now() - 2 * day), note: '', recorded_by: ANA }]
        : payments,
    },
  });

  await page.route(/\/rest\/v1\/rpc\/fund_summary/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    rpc.calls.push(JSON.parse(req.postData() || '{}'));
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(summary === undefined ? [{
        fund_id: 'f1', target_bani: 75000, collected_bani: 35000,
        homes: 4, homes_paid: 2, my_due_bani: 25000, my_paid_bani: 10000,
      }] : summary),
    });
  });

  return { me, rpc };
}

test.describe('Fonduri', () => {
  test('a neighbour sees the total, and their own line', async ({ page }) => {
    await withFunds(page);
    await page.goto('/#/app/funds/f1');

    await expect(page.getByText('Reparație acoperiș')).toBeVisible();
    // Money and homes, because either alone misleads.
    await expect(page.getByText('350 lei')).toBeVisible();
    await expect(page.getByText('750 lei')).toBeVisible();
    await expect(page.getByText('2 din 4 apartamente')).toBeVisible();

    /*
      250 owed, 100 given, so 150 to go — and the instalment is listed under
      it. Anchored with a regex rather than a substring: getByText('Ai de
      plătit') also matches inside "Nu ai de plătit la această colectă", which
      is the opposite state, and "100 lei" legitimately appears twice — once in
      the summary line and once as the payment it came from.
    */
    await expect(page.getByText(/^Ai de plătit/)).toContainText('150 lei');
    await expect(page.getByText(/^Ai de plătit/)).toContainText('100 lei');
    await expect(page.getByText('100 lei', { exact: true })).toBeVisible();
  });

  test('and is shown nobody else at all', async ({ page }) => {
    /*
      The one that matters. A member must not see the register, the names, or
      any way to write in it — this is the promise the whole design rests on,
      and the promise a stray isStaff check would break silently.
    */
    await withFunds(page);
    await page.goto('/#/app/funds/f1');
    await expect(page.getByText(/^Ai de plătit/)).toBeVisible();

    await expect(page.getByText('Pe apartamente')).toHaveCount(0);
    await expect(page.getByText('Ana Vecin')).toHaveCount(0);
    await expect(page.getByText('Bogdan Ionescu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Acțiuni pentru colectă' })).toHaveCount(0);
    await expect(page.getByText('Înregistrează o plată')).toHaveCount(0);
  });

  test('a home that owes nothing is told so, not shown a nought', async ({ page }) => {
    // "Ai de plătit 0 lei" reads as something gone wrong. It has to say the
    // thing it means.
    await withFunds(page, {
      summary: [{
        fund_id: 'f1', target_bani: 75000, collected_bani: 35000,
        homes: 4, homes_paid: 2, my_due_bani: 0, my_paid_bani: 0,
      }],
      payments: [],
    });
    await page.goto('/#/app/funds/f1');

    await expect(page.getByText('Nu ai de plătit la această colectă.')).toBeVisible();
    await expect(page.getByText(/^Ai de plătit/)).toHaveCount(0);
  });

  test('somebody who has paid in full is told that instead', async ({ page }) => {
    await withFunds(page, {
      summary: [{
        fund_id: 'f1', target_bani: 75000, collected_bani: 75000,
        homes: 4, homes_paid: 4, my_due_bani: 25000, my_paid_bani: 25000,
      }],
    });
    await page.goto('/#/app/funds/f1');

    await expect(page.getByText('Ai achitat integral')).toBeVisible();
    await expect(page.getByText(/^Ai de plătit/)).toHaveCount(0);
  });

  test('the administration sees the register, home by home', async ({ page }) => {
    await withFunds(page, {
      role: 'admin',
      payments: [
        { id: 'p1', fund_id: 'f1', user_id: ANA, amount_bani: 25000, paid_on: iso(Date.now() - 5 * day), note: '', recorded_by: ANA },
        { id: 'p2', fund_id: 'f1', user_id: BOGDAN, amount_bani: 5000, paid_on: iso(Date.now() - day), note: '', recorded_by: ANA },
      ],
    });
    await page.goto('/#/app/funds/f1');

    await expect(page.getByText('Pe apartamente')).toBeVisible();
    await expect(page.getByText('Ana Vecin')).toBeVisible();
    await expect(page.getByText('Bogdan Ionescu')).toBeVisible();
    // Ana is done; Bogdan owes nothing, so his 50 lei is not a shortfall.
    await expect(page.getByText('Nu ai de plătit la această colectă.')).toBeVisible();
  });

  test('recording a payment sends what was typed, for the right person', async ({ page }) => {
    await withFunds(page, { role: 'admin', payments: [] });

    const writes = [];
    await page.route(/\/rest\/v1\/fund_payments/, async (route) => {
      const req = route.request();
      if (req.method() === 'POST') writes.push(JSON.parse(req.postData() || '{}'));
      if (req.method() === 'POST' || req.method() === 'DELETE') {
        return route.fulfill({
          status: 201, contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/1' },
          body: '[]',
        });
      }
      return route.fallback();
    });

    await page.goto('/#/app/funds/f1');
    await page.getByText('Bogdan Ionescu').click();

    const amount = page.getByLabel('Suma primită (lei)');
    await expect(amount).toBeVisible();
    await amount.fill('120,50');
    await page.getByRole('button', { name: 'Salvează plata' }).click();

    await expect.poll(() => writes.length).toBe(1);
    // Bani, not lei: a comma from a Romanian keyboard is a decimal point, and
    // the amount that reaches the database is a whole number of bani.
    expect(writes[0]).toMatchObject({ fund_id: 'f1', user_id: BOGDAN, amount_bani: 12050 });
  });

  test('the composer shows what the collection will raise', async ({ page }) => {
    /*
      The multiplication is the whole reason there is no separate target field:
      an administrator who means to raise five thousand can see that 250 a home
      does it, and there is no second number able to disagree with the quotas.
    */
    await withFunds(page, { role: 'admin', funds: [] });
    await page.goto('/#/app/funds/new');

    await page.locator('#fund-title').fill('Poartă nouă');
    await page.locator('#fund-amount').fill('250');

    await expect(page.locator('#fund-total')).toHaveText('750 lei');
    // Three homes here, not four: the fixture has three members.
    await expect(page.getByText('3 apartamente × 250 lei')).toBeVisible();
  });

  test('a member cannot reach the composer by typing the address', async ({ page }) => {
    await withFunds(page, { funds: [] });
    await page.goto('/#/app/funds/new');
    // The screen renders its own header and nothing else: no fields to fill.
    await expect(page.locator('#fund-amount')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deschide colecta' })).toHaveCount(0);
  });

  test('a finished collection is still readable, and says it is finished', async ({ page }) => {
    // The answer to "what happened with the money for the roof" is worth more
    // a year later than it is now.
    await withFunds(page, { over: { closed_at: new Date(Date.now() - day).toISOString() } });
    await page.goto('/#/app/funds');

    await expect(page.getByText('Încheiate')).toBeVisible();
    await page.getByText('Reparație acoperiș').click();
    await expect(page.getByText('Încheiat')).toBeVisible();
  });

  test('the list says so plainly when there is nothing to pay', async ({ page }) => {
    await withFunds(page, { funds: [], summary: [] });
    await page.goto('/#/app/funds');
    await expect(page.getByText('Nicio colectă deschisă. Când administrația începe una, o vezi aici.')).toBeVisible();
  });

  test('an open collection with something owing reaches the dashboard', async ({ page }) => {
    await withFunds(page);
    await page.goto('/#/app/');

    await expect(page.getByText('Fonduri')).toBeVisible();
    const card = page.getByRole('button', { name: /Reparație acoperiș/ });
    await expect(card).toContainText('150 lei');   // what you still owe
    await expect(card).toContainText('350 lei');   // what the building has in
  });

  test('and a closed one does not', async ({ page }) => {
    await withFunds(page, { over: { closed_at: new Date().toISOString() } });
    await page.goto('/#/app/');

    await expect(page.getByText('Anunțuri', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Reparație acoperiș/ })).toHaveCount(0);
  });

  /*
    The empty state on the dashboard, which is where the calendar went wrong
    once: a section that vanishes when it is empty is right for a neighbour and
    wrong for the person whose job it is to fill it, because the empty state is
    exactly when they need the button. Reported at the time as "nu vad niciun
    plus, nu inteleg cum adaug ceva ca admin".
  */
  test('an administrator with no collection still sees the section, and the way in', async ({ page }) => {
    await withFunds(page, { role: 'admin', funds: [], summary: [] });
    await page.goto('/#/app/');

    await expect(page.getByRole('heading', { name: 'Fonduri' })).toBeVisible();
    await expect(page.getByText('Nicio colectă deschisă acum.')).toBeVisible();
    await page.getByRole('button', { name: '+ Fond nou' }).click();
    await expect.poll(() => new URL(page.url()).hash).toContain('/app/funds/new');
  });

  test('a neighbour with no collection sees no section at all', async ({ page }) => {
    // Nothing to read and nothing to do: a heading saying so is worse than
    // the space it takes.
    await withFunds(page, { funds: [], summary: [] });
    await page.goto('/#/app/');

    await expect(page.getByText('De la administrație')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fonduri' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Fond nou' })).toHaveCount(0);
  });

  test('and the button is there for staff even when a collection exists', async ({ page }) => {
    await withFunds(page, { role: 'admin' });
    await page.goto('/#/app/');

    await expect(page.getByRole('button', { name: /Reparație acoperiș/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Fond nou' })).toBeVisible();
  });

  test('the switch for these notifications exists and is its own', async ({ page }) => {
    // A notification type with no switch reaches everybody with no way to
    // decline, which is exactly how the calendar slipped through once.
    await withFunds(page);
    await page.goto('/#/app/notifications');
    await page.getByRole('button', { name: /Preferințe/ }).click();

    await expect(page.getByText('Fonduri și plăți')).toBeVisible();
  });
});
