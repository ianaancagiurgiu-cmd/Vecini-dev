import { test, expect } from '@playwright/test';
import { signedInAs, supabaseRef, fakeUser, FAKE_USER_ID, FAKE_COMMUNITY_ID } from './helpers.js';

/*
  The neighbour list, and the switch that puts a number on it.

  Who is allowed to see a number is decided in the database, and tested there
  against a real PostgreSQL: hidden unless its owner turned it on, and then only
  for people who share a community with them. This screen never receives the
  rest, so these cover what it does with what it is given.
*/

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

const OTHER = '55555555-0000-0000-0000-000000000001';
const THIRD = '55555555-0000-0000-0000-000000000002';

const member = (id, joined) => ({
  id: `m-${id}`, user_id: id, community_id: FAKE_COMMUNITY_ID, role: 'member', joined_at: joined,
});

const profile = (id, name, apartment) => ({
  id, full_name: name, apartment, avatar_color: '#8c3c52',
});

const community = () => ({
  tables: {
    memberships: [
      member(FAKE_USER_ID, '2026-01-01T00:00:00Z'),
      member(OTHER, '2026-01-02T00:00:00Z'),
      member(THIRD, '2026-01-03T00:00:00Z'),
    ],
    profiles: [
      profile(FAKE_USER_ID, 'Mihai Georgescu', 'Ap. 12'),
      profile(OTHER, 'Ana Popescu', 'Ap. 3'),
      profile(THIRD, 'Ion Vasile', 'Ap. 7'),
    ],
  },
});

const withPhones = (rows) => {
  const base = community();
  return { tables: { ...base.tables, member_phones: rows } };
};

test.describe('Epic 18 — The neighbour list', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  test('every member can open it, not only an admin', async ({ page }) => {
    await signedInAs(page, community());
    await page.goto('/#/app/neighbours');

    await expect(page.getByRole('heading', { name: 'Vecinii mei' })).toBeVisible();
    await expect(page.getByText('Ana Popescu')).toBeVisible();
    await expect(page.getByText('Ion Vasile')).toBeVisible();
    await expect(page.getByText('Ap. 3')).toBeVisible();
  });

  test('Settings and the dashboard both lead to it', async ({ page }) => {
    await signedInAs(page, community());

    await page.goto('/#/app/settings');
    await page.getByText('Vecinii mei').click();
    await expect(page).toHaveURL(/#\/app\/neighbours/);

    await page.goto('/#/app');
    await page.getByRole('button', { name: /vecini/ }).first().click();
    await expect(page).toHaveURL(/#\/app\/neighbours/);
  });

  test('a shared number can be dialled straight from the list', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: OTHER, phone: '+40 722 222 222', visible: true },
    ]));
    await page.goto('/#/app/neighbours');

    const call = page.getByRole('link', { name: /Sună Ana Popescu/ });
    await expect(call).toBeVisible();
    // A real tel: link, with the spaces stripped so the dialler accepts it.
    await expect(call).toHaveAttribute('href', 'tel:+40722222222');
  });

  test('a neighbour who shared nothing simply has no call button', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: OTHER, phone: '+40 722 222 222', visible: true },
    ]));
    await page.goto('/#/app/neighbours');

    await expect(page.getByText('Ion Vasile')).toBeVisible();
    await expect(page.getByRole('link', { name: /Sună Ion Vasile/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Sună/ })).toHaveCount(1);
  });

  test('reachable neighbours come first', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: THIRD, phone: '+40733333333', visible: true },
    ]));
    await page.goto('/#/app/neighbours');

    // Compared by where they actually sit on screen, which is the thing being
    // claimed, rather than by their order in some list of matches.
    const ion = await page.getByText('Ion Vasile').boundingBox();
    const ana = await page.getByText('Ana Popescu').boundingBox();
    expect(ion.y).toBeLessThan(ana.y);
  });

  test('when nobody has shared a number, it says so once rather than beside every name', async ({ page }) => {
    await signedInAs(page, community());
    await page.goto('/#/app/neighbours');

    await expect(page.getByText(/Niciun vecin nu și-a făcut încă numărul vizibil/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Sună/ })).toHaveCount(0);
  });
});

test.describe('Epic 18 — Choosing to be reachable', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  /*
    Takes over the table: records what the app saves, and then answers reads
    with what was saved. Accepting a write and serving a read that contradicts
    it is a race the test would win only sometimes, because the app reloads
    after saving and would put the old value back on screen.
  */
  async function trackContactWrites(page, initial = []) {
    const writes = [];
    const rows = [...initial];

    await page.route(/\/rest\/v1\/member_phones/, (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });

      if (req.method() === 'GET' || req.method() === 'HEAD') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          headers: { ...CORS, 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
          body: JSON.stringify(rows),
        });
      }

      const body = JSON.parse(req.postData() || '{}');
      writes.push(body);
      const at = rows.findIndex((r) => r.user_id === body.user_id);
      if (at >= 0) rows[at] = { ...rows[at], ...body };
      else rows.push(body);
      return route.fulfill({ status: 201, contentType: 'application/json', headers: CORS, body: '[]' });
    });

    return writes;
  }

  test('there is no switch until there is a number to share', async ({ page }) => {
    await signedInAs(page, community());
    await page.goto('/#/app/settings/account');

    await expect(page.locator('input[type=tel]')).toHaveValue('');
    await expect(page.getByText('Arată numărul vecinilor')).toHaveCount(0);
  });

  test('a saved number is hidden until the switch is turned on', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: FAKE_USER_ID, phone: '+40722222222', visible: false },
    ]));
    await page.goto('/#/app/settings/account');

    await expect(page.locator('input[type=tel]')).toHaveValue('+40722222222');
    await expect(page.getByText('Arată numărul vecinilor')).toBeVisible();
    await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Numărul e salvat, dar nu îl vede nimeni.')).toBeVisible();
  });

  test('turning it on saves the decision at once', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: FAKE_USER_ID, phone: '+40722222222', visible: false },
    ]));
    const writes = await trackContactWrites(page, [{ user_id: FAKE_USER_ID, phone: '+40722222222', visible: false }]);
    await page.goto('/#/app/settings/account');

    await page.getByRole('switch').click();

    await expect(page.getByText('Vecinii tăi te pot suna acum.')).toBeVisible();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ user_id: FAKE_USER_ID, phone: '+40722222222', visible: true });
  });

  test('turning it off saves that too', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: FAKE_USER_ID, phone: '+40722222222', visible: true },
    ]));
    const writes = await trackContactWrites(page, [{ user_id: FAKE_USER_ID, phone: '+40722222222', visible: true }]);
    await page.goto('/#/app/settings/account');

    await expect(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('switch').click();

    await expect(page.getByText('Numărul tău nu mai e vizibil.')).toBeVisible();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ visible: false });
  });

  test('clearing the number takes it off the list as well', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: FAKE_USER_ID, phone: '+40722222222', visible: true },
    ]));
    const writes = await trackContactWrites(page, [{ user_id: FAKE_USER_ID, phone: '+40722222222', visible: true }]);
    await page.goto('/#/app/settings/account');

    await page.locator('input[type=tel]').fill('');
    await page.getByRole('button', { name: 'Salvează' }).click();

    // An empty number cannot be shared, whatever the switch said a moment ago.
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({ phone: null, visible: false });
  });

  test('an obviously wrong number is refused before it is saved', async ({ page }) => {
    await signedInAs(page, community());
    const writes = await trackContactWrites(page);
    await page.goto('/#/app/settings/account');

    await page.locator('input[type=tel]').fill('abc');
    await page.getByRole('button', { name: 'Salvează' }).click();

    await expect(page.getByText('Numărul nu pare valid.')).toBeVisible();
    expect(writes).toHaveLength(0);
  });
});

/*
  Your own row comes back from the database whatever the switch says, because
  you may always read your own. That is exactly the case where a number you have
  saved but not shared could slip onto the list under your own name.
*/
test.describe('Epic 18 — Your own number on the list', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  test('a number you saved but did not share does not appear', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: FAKE_USER_ID, phone: '+40722222222', visible: false },
    ]));
    await page.goto('/#/app/neighbours');

    await expect(page.getByText('Mihai Georgescu')).toBeVisible();
    await expect(page.getByRole('link', { name: /Sună/ })).toHaveCount(0);
  });

  test('once shared, it appears like anyone else s', async ({ page }) => {
    await signedInAs(page, withPhones([
      { user_id: FAKE_USER_ID, phone: '+40722222222', visible: true },
    ]));
    await page.goto('/#/app/neighbours');

    await expect(page.getByRole('link', { name: /Sună Mihai Georgescu/ })).toBeVisible();
  });
});
