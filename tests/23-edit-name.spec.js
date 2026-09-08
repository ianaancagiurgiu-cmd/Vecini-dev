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

async function asSelf(page, { name = 'Iana Giurgiu', apartment = 'Ap. 12', kind = 'bloc' } = {}) {
  const me = fakeUser();
  const row = { id: me.id, full_name: name, apartment, avatar_color: '#2f6b4f', deleted_at: null };

  await signedInAs(page, {
    user: me,
    tables: {
      communities: [{ ...community, kind }],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
      profiles: [row],
    },
  });

  /*
    Registered after signedInAs, so it wins for this table and falls through to
    the shared harness for every other one. Answers GET as well as PATCH, both
    from the same mutable copy — a save has to be visible to every query that
    reads the profile afterwards, not only to the request the save itself made.
    (This fixture only ever holds the signed-in user's own row, so a single
    object stands in for what would otherwise be a filtered list.)
  */
  let current = { ...row };
  await page.route(/\/rest\/v1\/profiles/, (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const patch = JSON.parse(req.postData() || '{}');
      current = { ...current, ...patch };
    } else if (req.method() !== 'GET') {
      return route.fallback();
    }
    const wantsOne = (req.headers()['accept'] || '').includes('pgrst.object');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/1' },
      body: JSON.stringify(wantsOne ? current : [current]),
    });
  });

  await stubAuth(page, 'user', () => ({ status: 200, body: { id: me.id } }));
  return me;
}

const nameField = (page) => page.locator('input[autocomplete="name"]');
const saveBtn = (page) => page.getByRole('button', { name: 'Salvează' });
const apartmentField = (page) => page.locator('#acc-apartment');

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

/*
  Which apartment or house is yours.

  This field used to be read-only: shown on the account screen, shown in the
  neighbour list, and with no way for anyone to ever put a value into it — the
  three places that read it could only ever show "necompletat". The write side
  was simply missing.

  The label, hint and placeholder all follow the kind of community this is,
  the same way the dashboard's tagline does: asking a house for its
  "apartament" reads as the app not having noticed where they live.
*/
test.describe('Editing your apartment or house number', () => {
  test('the field starts on the value you already have', async ({ page }) => {
    await asSelf(page);
    await page.goto('/#/app/settings/account');
    await expect(apartmentField(page)).toHaveValue('Ap. 12');
  });

  test('save appears only once something has changed', async ({ page }) => {
    await asSelf(page);
    await page.goto('/#/app/settings/account');
    await expect(apartmentField(page)).toHaveValue('Ap. 12');

    await expect(saveBtn(page)).toHaveCount(0);
    await apartmentField(page).fill('Ap. 14');
    await expect(saveBtn(page)).toBeVisible();
  });

  /*
    The eyebrow labels render in small caps via CSS (text-transform), so the
    DOM itself still carries the lowercase i18n string — matching against the
    all-caps rendering here would look for text that is never actually there.
  */
  test('the label follows the kind of community — a block asks for an apartment', async ({ page }) => {
    await asSelf(page, { kind: 'bloc' });
    await page.goto('/#/app/settings/account');
    await expect(page.getByText('Apartament', { exact: true })).toBeVisible();
    await expect(page.getByText('la ce apartament ești')).toBeVisible();
  });

  test('a street of houses asks for a house number instead', async ({ page }) => {
    await asSelf(page, { kind: 'houses' });
    await page.goto('/#/app/settings/account');
    await expect(page.getByText('Numărul casei')).toBeVisible();
    await expect(page.getByText('la ce casă ești')).toBeVisible();
  });

  test('a mixed community asks for either', async ({ page }) => {
    await asSelf(page, { kind: 'mixed' });
    await page.goto('/#/app/settings/account');
    await expect(page.getByText('Apartament sau numărul casei')).toBeVisible();
  });

  test('unlike the name, it can be cleared rather than only changed', async ({ page }) => {
    // The name refuses fewer than two letters; the apartment has no such rule
    // — someone may simply not want to say, and that is a real answer here.
    await asSelf(page);
    await page.goto('/#/app/settings/account');

    await apartmentField(page).fill('');
    await saveBtn(page).click();
    await expect(page.getByText('S-a salvat.')).toBeVisible();
  });

  test('the new value reaches the neighbour list without a reload', async ({ page }) => {
    await asSelf(page, { name: 'Iana Giurgiu', apartment: 'Ap. 12' });
    await page.goto('/#/app/settings/account');

    await apartmentField(page).fill('Ap. 14');
    await saveBtn(page).click();
    await expect(page.getByText('S-a salvat.')).toBeVisible();

    await page.goto('/#/app/neighbours');
    await expect(page.getByText('Iana Giurgiu')).toBeVisible();
    await expect(page.getByText('Ap. 14')).toBeVisible();
  });

  test('with nothing set, the neighbour list says so rather than showing a blank', async ({ page }) => {
    await asSelf(page, { apartment: '' });
    await page.goto('/#/app/neighbours');
    await expect(page.getByText('Iana Giurgiu')).toBeVisible();
    await expect(page.getByText('necompletat')).toBeVisible();
  });
});
