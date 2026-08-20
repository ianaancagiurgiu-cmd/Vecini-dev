import { test, expect } from '@playwright/test';
import { signedInAs, supabaseRef, fakeUser, FAKE_USER_ID, FAKE_COMMUNITY_ID } from './helpers.js';

/*
  Sharing and handing over the admin role.

  Who is allowed to do what is decided in the database and tested there against
  a real PostgreSQL, including the rule that nothing may leave a community with
  members but nobody in charge. These cover the screen: that it offers the right
  moves to the right person, says plainly which one cannot be undone alone, and
  asks for exactly what the database expects.
*/

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

const ANA = '66666666-0000-0000-0000-000000000001';
const ION = '66666666-0000-0000-0000-000000000002';

const member = (id, role, joined) => ({
  id: `m-${id}`, user_id: id, community_id: FAKE_COMMUNITY_ID, role, joined_at: joined,
});
const profile = (id, name, apartment) => ({ id, full_name: name, apartment, avatar_color: '#8c3c52' });

const asAdmin = (roles = { [ANA]: 'member', [ION]: 'moderator' }) => ({
  tables: {
    memberships: [
      member(FAKE_USER_ID, 'admin', '2026-01-01T00:00:00Z'),
      member(ANA, roles[ANA], '2026-01-02T00:00:00Z'),
      member(ION, roles[ION], '2026-01-03T00:00:00Z'),
    ],
    profiles: [
      profile(FAKE_USER_ID, 'Mihai Georgescu', 'Ap. 12'),
      profile(ANA, 'Ana Popescu', 'Ap. 3'),
      profile(ION, 'Ion Vasile', 'Ap. 7'),
    ],
  },
});

/** Records the role calls the app makes, and answers as the service would. */
async function trackRoleCalls(page, { fails = false } = {}) {
  const calls = [];
  await page.route(/\/rest\/v1\/rpc\/(set_member_role|transfer_admin)/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    calls.push({
      fn: new URL(req.url()).pathname.split('/').pop(),
      args: JSON.parse(req.postData() || '{}'),
    });
    return route.fulfill({
      status: fails ? 400 : 200, contentType: 'application/json', headers: CORS,
      body: JSON.stringify(fails ? { message: 'last_admin' } : null),
    });
  });
  return calls;
}

test.describe('Epic 19 — Sharing and handing over the admin role', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  test('an admin sees no role buttons on their own row', async ({ page }) => {
    await signedInAs(page, asAdmin());
    await page.goto('/#/app/admin/members');

    const mine = page.locator('.card').filter({ hasText: 'Mihai Georgescu' });
    await expect(mine).toContainText('Tu');
    // Nothing to press: you cannot change your own standing, and handing over
    // is offered on the row of the person you would hand it to.
    await expect(mine.getByRole('button')).toHaveCount(0);
  });

  test('both ways of sharing the role are spelled out, not hidden behind one word', async ({ page }) => {
    await signedInAs(page, asAdmin());
    await page.goto('/#/app/admin/members');

    await page.locator('.card').filter({ hasText: 'Ana Popescu' })
      .getByRole('button', { name: /Fă administrator/ }).click();

    await expect(page.getByRole('button', { name: 'Adaugă-l ca administrator' })).toBeVisible();
    await expect(page.getByText('Rămâneți amândoi administratori.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Predă comunitatea' })).toBeVisible();
    await expect(page.getByText(/Nu te mai poți întoarce singur/)).toBeVisible();
  });

  test('adding a second admin asks for exactly that', async ({ page }) => {
    await signedInAs(page, asAdmin());
    const calls = await trackRoleCalls(page);
    await page.goto('/#/app/admin/members');

    await page.locator('.card').filter({ hasText: 'Ana Popescu' })
      .getByRole('button', { name: /Fă administrator/ }).click();
    await page.getByRole('button', { name: 'Adaugă-l ca administrator' }).click();

    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].fn).toBe('set_member_role');
    expect(calls[0].args).toMatchObject({ p_community: FAKE_COMMUNITY_ID, p_user: ANA, p_role: 'admin' });
  });

  test('handing over is a single call, so it cannot half-happen', async ({ page }) => {
    await signedInAs(page, asAdmin());
    const calls = await trackRoleCalls(page);
    await page.goto('/#/app/admin/members');

    await page.locator('.card').filter({ hasText: 'Ana Popescu' })
      .getByRole('button', { name: /Fă administrator/ }).click();
    await page.getByRole('button', { name: 'Predă comunitatea' }).click();

    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].fn).toBe('transfer_admin');
    expect(calls[0].args).toMatchObject({ p_community: FAKE_COMMUNITY_ID, p_user: ANA });
    await expect(page.getByText('Ai predat comunitatea.')).toBeVisible();
  });

  test('an existing admin can be taken back down, and is not offered promotion', async ({ page }) => {
    await signedInAs(page, asAdmin({ [ANA]: 'admin', [ION]: 'member' }));
    const calls = await trackRoleCalls(page);
    await page.goto('/#/app/admin/members');

    const anaRow = page.locator('.card').filter({ hasText: 'Ana Popescu' });
    await expect(anaRow.getByRole('button', { name: /Fă administrator/ })).toHaveCount(0);
    await anaRow.getByRole('button', { name: /Scoate din administratori/ }).click();

    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].args).toMatchObject({ p_user: ANA, p_role: 'member' });
  });

  test('a refusal from the database is reported, not swallowed', async ({ page }) => {
    await signedInAs(page, asAdmin());
    await trackRoleCalls(page, { fails: true });
    await page.goto('/#/app/admin/members');

    await page.locator('.card').filter({ hasText: 'Ana Popescu' })
      .getByRole('button', { name: /↑ Moderator/ }).click();

    await expect(page.getByText('Nu am putut schimba rolul. Mai încearcă.')).toBeVisible();
  });

  test('the screen states the rule it is built around', async ({ page }) => {
    await signedInAs(page, asAdmin());
    await page.goto('/#/app/admin/members');
    await expect(page.getByText(/cel puțin un administrator/)).toBeVisible();
  });

  test('a moderator cannot reach this screen at all', async ({ page }) => {
    await signedInAs(page, {
      tables: {
        memberships: [member(FAKE_USER_ID, 'moderator', '2026-01-01T00:00:00Z')],
        profiles: [profile(FAKE_USER_ID, 'Mihai Georgescu', 'Ap. 12')],
      },
    });
    await page.goto('/#/app/admin/members');
    await expect(page).toHaveURL(/#\/app\/admin$/);
    await expect(page.getByText('Membri', { exact: true })).toHaveCount(0);
  });
});
