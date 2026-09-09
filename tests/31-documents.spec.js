import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  Documentele asociației.

  Two things are worth guarding, and neither is the list.

  The first is who may add. Reading is open to every member on purpose — an
  association owes its members sight of its own records — but a document
  anybody could upload is not a record, it is a noticeboard.

  The second is how a file is reached. The bucket is private, so there is no
  permanent address: the app asks for a link that expires, every time. If that
  ever quietly became a public URL the screens would look identical and a
  contract would become forwardable to anyone, for ever, which is the failure
  worth a test rather than a comment.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

const day = 86400000;

async function withDocuments(page, { role = 'member', docs, funds = [] } = {}) {
  const me = fakeUser();

  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm0', user_id: me.id, community_id: 'c1', role, joined_at: new Date().toISOString() }],
      funds,
      documents: docs === undefined ? [
        { id: 'd1', community_id: 'c1', title: 'Proces-verbal adunare august', kind: 'minutes',
          path: 'c1/pv-august.pdf', mime: 'application/pdf', size_bytes: 240000, fund_id: null,
          uploaded_by: me.id, created_at: new Date(Date.now() - 10 * day).toISOString() },
        { id: 'd2', community_id: 'c1', title: 'Factura acoperiș', kind: 'invoice',
          path: 'c1/factura.pdf', mime: 'application/pdf', size_bytes: 1800000, fund_id: 'f1',
          uploaded_by: me.id, created_at: new Date(Date.now() - 2 * day).toISOString() },
      ] : docs,
    },
  });

  // Where a signed link would be asked for, and what came back.
  const signed = [];
  await page.route(/\/storage\/v1\/object\/sign\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    signed.push({ url: req.url(), body: JSON.parse(req.postData() || '{}') });
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ signedURL: '/storage/v1/object/sign/documents/c1/pv-august.pdf?token=stub' }),
    });
  });

  const uploads = [];
  await page.route(/\/storage\/v1\/object\/documents\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    uploads.push({ method: req.method(), url: req.url() });
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ Key: 'documents/c1/x.pdf' }),
    });
  });

  return { me, signed, uploads };
}

test.describe('Documente', () => {
  test('every neighbour can read the association\'s papers', async ({ page }) => {
    await withDocuments(page);
    await page.goto('/#/app/documents');

    await expect(page.getByText('Proces-verbal adunare august')).toBeVisible();
    await expect(page.getByText('Factura acoperiș')).toBeVisible();
  });

  test('but only staff can add or remove one', async ({ page }) => {
    /*
      Open to read, closed to write. A document anybody could upload is not a
      record of anything.
    */
    await withDocuments(page);
    await page.goto('/#/app/documents');
    await expect(page.getByText('Proces-verbal adunare august')).toBeVisible();

    await expect(page.getByRole('button', { name: /Încarcă un document/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Șterge documentul' })).toHaveCount(0);
  });

  test('staff are offered both', async ({ page }) => {
    await withDocuments(page, { role: 'admin' });
    await page.goto('/#/app/documents');

    await expect(page.getByRole('button', { name: /Încarcă un document/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Șterge documentul' }).first()).toBeVisible();
  });

  test('opening one asks for a link that expires, not a public address', async ({ page }) => {
    /*
      The whole reason the bucket is private. A public URL for a contract is
      permanent and forwardable to anybody; this asks for a fresh signed link
      each time, and the screens would look exactly the same if it stopped —
      which is why the request itself is what gets asserted.
    */
    const { signed } = await withDocuments(page);
    await page.goto('/#/app/documents');

    // The link opens in a new tab, so the popup is caught rather than followed.
    const popup = page.waitForEvent('popup').catch(() => null);
    await page.getByText('Proces-verbal adunare august').click();

    await expect.poll(() => signed.length).toBe(1);
    expect(signed[0].url).toContain('/storage/v1/object/sign/documents/c1/pv-august.pdf');
    // An hour: long enough to read, short enough that a pasted link dies.
    expect(signed[0].body).toMatchObject({ expiresIn: 3600 });
    await popup;
  });

  test('the filters narrow by what kind of paper it is', async ({ page }) => {
    await withDocuments(page);
    await page.goto('/#/app/documents');

    // The pill and the row both carry the word, so the pill is named exactly.
    await page.getByRole('button', { name: 'Facturi', exact: true }).click();
    await expect(page.getByText('Factura acoperiș')).toBeVisible();
    await expect(page.getByText('Proces-verbal adunare august')).toHaveCount(0);

    await page.getByRole('button', { name: 'Toate', exact: true }).click();
    await expect(page.getByText('Proces-verbal adunare august')).toBeVisible();
  });

  test('a collection shows the papers behind it, to everyone', async ({ page }) => {
    /*
      The point of building the two together. "We raised 5.000 lei" is a
      figure; the invoice beside it is evidence. Visible to every member,
      unlike the register of who has paid — an invoice says nothing about
      which neighbour is behind.
    */
    await withDocuments(page, {
      funds: [{
        id: 'f1', community_id: 'c1', title: 'Reparație acoperiș', description: '',
        amount_bani: 25000, due_on: null, created_by: 'x', closed_at: null,
        created_at: new Date(Date.now() - 30 * day).toISOString(),
      }],
    });
    await page.route(/\/rest\/v1\/rpc\/fund_summary/, (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([{ fund_id: 'f1', target_bani: 25000, collected_bani: 25000, homes: 1, homes_paid: 1, my_due_bani: 25000, my_paid_bani: 25000 }]),
    }));

    await page.goto('/#/app/funds/f1');
    await expect(page.getByText('Reparație acoperiș')).toBeVisible();
    await expect(page.getByText('Factura acoperiș')).toBeVisible();
    // And not the one that belongs to no collection.
    await expect(page.getByText('Proces-verbal adunare august')).toHaveCount(0);
  });

  test('a neighbour is not offered a way to attach one', async ({ page }) => {
    await withDocuments(page, { docs: [], funds: [{
      id: 'f1', community_id: 'c1', title: 'Reparație acoperiș', description: '',
      amount_bani: 25000, due_on: null, created_by: 'x', closed_at: null,
      created_at: new Date().toISOString(),
    }] });
    await page.route(/\/rest\/v1\/rpc\/fund_summary/, (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify([{ fund_id: 'f1', target_bani: 25000, collected_bani: 0, homes: 1, homes_paid: 0, my_due_bani: 25000, my_paid_bani: 0 }]),
    }));

    await page.goto('/#/app/funds/f1');
    await expect(page.getByText('Reparație acoperiș')).toBeVisible();
    // With nothing attached and nothing they may do, the section is not there
    // at all rather than empty.
    await expect(page.getByText('Atașează un document')).toHaveCount(0);
    await expect(page.getByText('Documente')).toHaveCount(0);
  });

  test('an empty shelf says so', async ({ page }) => {
    await withDocuments(page, { docs: [] });
    await page.goto('/#/app/documents');
    await expect(page.getByText('Niciun document deocamdată.')).toBeVisible();
  });

  test('and tells staff what to do about it', async ({ page }) => {
    // Its own test rather than a second half of the one above: the signed-in
    // identity is written by an init script, so a second one in the same page
    // would not take effect until a reload.
    await withDocuments(page, { docs: [], role: 'admin' });
    await page.goto('/#/app/documents');
    await expect(page.getByText('Niciun document deocamdată. Încarcă primul de mai sus.')).toBeVisible();
  });

  test('and it is reachable without being staff', async ({ page }) => {
    // The bottom bar is full, so the way in is the same list that already
    // holds "Vecinii mei" — reachable by everyone, not buried in the admin
    // panel where a neighbour would never look.
    await withDocuments(page);
    await page.goto('/#/app/settings');

    await page.getByText('Documente').click();
    await expect.poll(() => new URL(page.url()).hash).toContain('/app/documents');
  });
});
