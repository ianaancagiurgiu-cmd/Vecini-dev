import { test, expect } from '@playwright/test';
import { signedInAs, stubAuth, fakeUser, supabaseRef, FAKE_COMMUNITY_ID, FAKE_USER_ID } from './helpers.js';

/*
  Giving up an account, and the optional phone number.

  What the database does with the deletion is covered where it belongs, against
  a real PostgreSQL. These cover the half that lives in the browser: that the
  screen explains both sides of the bargain before the button, that the button
  cannot be reached by a stray tap, and that the person is actually signed out
  afterwards rather than left looking at an account that no longer exists.
*/

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

/** Answers the deletion call, and reports whether it was made. */
async function stubDeletion(page, { fails = false } = {}) {
  const calls = { count: 0 };
  await page.route(/\/rest\/v1\/rpc\/delete_my_account/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    calls.count += 1;
    return route.fulfill({
      status: fails ? 500 : 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(fails ? { message: 'boom' } : null),
    });
  });
  await stubAuth(page, 'logout', () => ({ status: 204, body: {} }));
  return calls;
}

test.describe('Epic 15 — Deleting an account', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  const typeWord = (page) => page.locator('.input').last();
  const deleteBtn = (page) => page.getByRole('button', { name: 'Șterge contul definitiv' });

  test('the account screen offers deletion, set apart from everything else', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings/account');
    await expect(page.getByText('Ștergerea contului')).toBeVisible();
    await page.getByText('Șterge contul', { exact: true }).click();
    await expect(page).toHaveURL(/#\/app\/settings\/delete/);
  });

  test('it says what goes and what stays, before the button', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings/delete');

    await expect(page.getByText(/nu te mai poți conecta/)).toBeVisible();
    // Both halves matter: people expect everything they wrote to vanish too.
    await expect(page.getByText('Ce dispare')).toBeVisible();
    await expect(page.getByText(/adresa de email, numărul de telefon/)).toBeVisible();
    await expect(page.getByText('Ce rămâne')).toBeVisible();
    await expect(page.getByText(/rămân, dar fără numele tău/)).toBeVisible();
  });

  test('nothing happens until the confirmation is typed', async ({ page }) => {
    await signedInAs(page);
    const calls = await stubDeletion(page);
    await page.goto('/#/app/settings/delete');

    await expect(deleteBtn(page)).toBeDisabled();

    await typeWord(page).fill('sterg');
    await expect(deleteBtn(page)).toBeDisabled();

    await typeWord(page).fill('STERGE');
    await expect(deleteBtn(page)).toBeEnabled();

    expect(calls.count).toBe(0);
  });

  test('the typed word is not fussy about case', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings/delete');
    await typeWord(page).fill('  sterge ');
    await expect(deleteBtn(page)).toBeEnabled();
  });

  test('confirming deletes the account and signs the person out', async ({ page }) => {
    await signedInAs(page);
    const calls = await stubDeletion(page);
    await page.goto('/#/app/settings/delete');

    await typeWord(page).fill('STERGE');
    await deleteBtn(page).click();

    // Polled, not read once: the click starts the call, it does not finish it.
    await expect.poll(() => calls.count).toBe(1);
    // Back out to the public landing page, not left inside an account that is
    // no longer there.
    await page.waitForURL(/#\/$|\/$/, { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Începe acum' })).toBeVisible();
  });

  test('a failure says so and leaves the person signed in', async ({ page }) => {
    await signedInAs(page);
    await stubDeletion(page, { fails: true });
    await page.goto('/#/app/settings/delete');

    await typeWord(page).fill('STERGE');
    await deleteBtn(page).click();

    await expect(page.getByText('Nu am putut șterge contul. Mai încearcă.')).toBeVisible();
    expect(page.url()).toContain('#/app/settings/delete');
  });

  test('an admin is told the community will be handed on', async ({ page }) => {
    await signedInAs(page, {
      tables: {
        memberships: [{ id: 'm1', user_id: FAKE_USER_ID, community_id: FAKE_COMMUNITY_ID, role: 'admin', joined_at: '2026-01-01T00:00:00Z' }],
      },
    });
    await page.goto('/#/app/settings/delete');
    await expect(page.getByText(/trece automat la cel mai vechi membru rămas/)).toBeVisible();
  });

  test('a plain member is not shown the admin note', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings/delete');
    await expect(page.getByText(/trece automat la cel mai vechi membru/)).toHaveCount(0);
  });
});

/*
  The phone number moved out of the profile and into its own table, with its own
  visibility rule, when it turned out that a profile is readable by anyone
  signed in anywhere. It is covered with the neighbour list it feeds, in
  18-neighbours.spec.js, rather than here.
*/

test.describe('Epic 15 — The tally an admin can see', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  const asAdmin = (extra = {}) => ({
    user: fakeUser(),
    tables: {
      memberships: [{ id: 'm1', user_id: FAKE_USER_ID, community_id: FAKE_COMMUNITY_ID, role: 'admin', joined_at: '2026-01-01T00:00:00Z' }],
      ...extra,
    },
  });

  test('the count is shown once people have left', async ({ page }) => {
    await signedInAs(page, asAdmin({
      deleted_accounts: [
        { id: 'd1', community_id: FAKE_COMMUNITY_ID, deleted_at: '2026-02-01T00:00:00Z' },
        { id: 'd2', community_id: FAKE_COMMUNITY_ID, deleted_at: '2026-03-01T00:00:00Z' },
      ],
    }));
    await page.goto('/#/app/admin');
    const tile = page.locator('div').filter({ hasText: /^2conturi șterse$/ }).first();
    await expect(tile).toBeVisible();
  });

  test('no tile at all while nobody has left, rather than a permanent zero', async ({ page }) => {
    await signedInAs(page, asAdmin());
    await page.goto('/#/app/admin');
    await expect(page.getByText('conturi șterse')).toHaveCount(0);
  });
});
