import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser, stubAuth } from './helpers.js';

/*
  Changing your own name.

  The part worth guarding is not the field but what happens after saving. The
  name is read from the profile row, and the profile has its own loader keyed on
  the user id — refreshAll does not touch it. So a save that refreshes
  everything else still leaves the old name on screen, which looks exactly like
  a save that silently failed.

  The shared harness answers every REST call from its fixtures regardless of
  method, so a PATCH there would hand back the row unchanged and this would pass
  on a stale render. Hence the profiles route below, which actually remembers.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

async function asSelf(page, { name = 'Iana Giurgiu' } = {}) {
  const me = fakeUser();
  const row = { id: me.id, full_name: name, apartment: 'Ap. 12', avatar_color: '#2f6b4f', deleted_at: null };

  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
      profiles: [row],
    },
  });

  // Registered after signedInAs, so it wins for this table and falls through
  // to the shared harness for every other one.
  let current = { ...row };
  await page.route(/\/rest\/v1\/profiles/, (route) => {
    const req = route.request();
    if (req.method() !== 'PATCH') return route.fallback();
    const patch = JSON.parse(req.postData() || '{}');
    current = { ...current, ...patch };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/1' },
      body: JSON.stringify(current),
    });
  });

  await stubAuth(page, 'user', () => ({ status: 200, body: { id: me.id } }));
  return me;
}

const nameField = (page) => page.locator('input[autocomplete="name"]');
const saveBtn = (page) => page.getByRole('button', { name: 'Salvează' });

test.describe('Editing your own name', () => {
  test('the field starts on the name you already have', async ({ page }) => {
    await asSelf(page);
    await page.goto('/#/app/settings/account');
    await expect(nameField(page)).toHaveValue('Iana Giurgiu');
  });

  test('save appears only once something has changed', async ({ page }) => {
    await asSelf(page);
    await page.goto('/#/app/settings/account');
    await expect(nameField(page)).toHaveValue('Iana Giurgiu');

    await expect(saveBtn(page)).toHaveCount(0);
    await nameField(page).fill('Iana Anca Giurgiu');
    await expect(saveBtn(page)).toBeVisible();
  });

  test('a one-letter name is refused rather than saved', async ({ page }) => {
    await asSelf(page);
    await page.goto('/#/app/settings/account');
    await expect(nameField(page)).toHaveValue('Iana Giurgiu');

    await nameField(page).fill('I');
    await saveBtn(page).click();
    await expect(page.getByText('Scrie numele cu care vrei să apari.')).toBeVisible();
  });

  test('the new name reaches the screen without a reload', async ({ page }) => {
    await asSelf(page);
    await page.goto('/#/app/settings/account');
    await expect(nameField(page)).toHaveValue('Iana Giurgiu');

    await nameField(page).fill('Iana Anca Giurgiu');
    await saveBtn(page).click();

    await expect(page.getByText('Numele a fost schimbat.')).toBeVisible();
    // The card at the top reads the profile, not the field being typed in.
    await expect(page.locator('.card').first()).toContainText('Iana Anca Giurgiu');
  });
});
