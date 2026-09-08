import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  Being asked to turn notifications on, after the app has been added to the
  home screen.

  This is the one moment the whole push feature depends on, and nothing tested
  it. The plumbing had tests — the manifest, the service worker, what a push
  payload turns into — but not the sheet that is the only place anybody is ever
  offered the permission. Everything downstream of it can be perfect and still
  reach nobody.

  On iPhone the order is forced: push does not exist at all in a Safari tab, so
  the app has to be on the home screen before the question can even be asked.
  That is why these two run standalone.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

/*
  Stand in for a phone that has the app on its home screen and has never been
  asked about notifications.

  Installed and permission are separate switches because the interesting
  failures are on the diagonal: asking on a phone that cannot grant it, and
  staying silent on one that can.
*/
async function onHomeScreen(page, { permission = 'default' } = {}) {
  await page.addInitScript((perm) => {
    // What iOS sets on a home-screen launch, and what Chrome answers.
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    const realMatch = window.matchMedia.bind(window);
    window.matchMedia = (q) => (
      q === '(display-mode: standalone)'
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
        : realMatch(q)
    );

    // Record the ask rather than letting the browser put up a real dialogue.
    window.__askedForPush = 0;
    class FakeNotification {}
    FakeNotification.permission = perm;
    FakeNotification.requestPermission = async () => {
      window.__askedForPush += 1;
      return 'granted';
    };
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
  }, permission);
}

async function signIn(page, over = {}) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    // These four specs are about the sheet itself, so they need the phone that
    // has never been asked — everywhere else it is silenced, see helpers.js.
    onboarding: true,
    tables: {
      communities: [community],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
      announcements: [],
      ...over,
    },
  });
  return me;
}

test.describe('Turning notifications on', () => {
  test('the sheet appears on a phone that has the app on its home screen', async ({ page }) => {
    await onHomeScreen(page);
    await signIn(page);
    await page.goto('/#/app/');

    // It waits six seconds on purpose: a modal thrown at somebody before they
    // have seen anything is how people learn to dismiss without reading.
    await expect(page.getByText('Nu rata ce se întâmplă în cartier')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Pornește notificările' })).toBeVisible();
  });

  test('and tapping it actually asks the browser', async ({ page }) => {
    /*
      The sheet appearing is not the same as the permission being requested.
      A button that opens nothing looks identical to one that works, right up
      until nobody ever receives a notification.
    */
    await onHomeScreen(page);
    await signIn(page);
    await page.goto('/#/app/');

    await page.getByRole('button', { name: 'Pornește notificările' }).click({ timeout: 15000 });
    await expect.poll(() => page.evaluate(() => window.__askedForPush)).toBe(1);
  });

  test('it does not also nag about installing what is already installed', async ({ page }) => {
    await onHomeScreen(page);
    await signIn(page);
    await page.goto('/#/app/');

    await expect(page.getByText('Nu rata ce se întâmplă în cartier')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Ai aplicația Vecini la un click distanță')).toHaveCount(0);
  });

  test('it does not ask again once the answer is no', async ({ page }) => {
    // A question already refused at the browser level cannot be re-opened by
    // asking it again in-app; it would put up a sheet whose button does nothing.
    await onHomeScreen(page, { permission: 'denied' });
    await signIn(page);
    await page.goto('/#/app/');

    await expect(page.getByText('Anunțuri recente')).toBeVisible();
    await page.waitForTimeout(8000);
    await expect(page.getByText('Nu rata ce se întâmplă în cartier')).toHaveCount(0);
  });
});
