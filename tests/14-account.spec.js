import { test, expect } from '@playwright/test';
import { signedInAs, stubAuth, fakeUser, supabaseRef } from './helpers.js';

/*
  The account screen and the email-change flow.

  Both live behind a signed-in session, so these run against the stub in
  helpers.js: a session in storage and fixed answers for the REST reads. What
  they prove is what the screens do with a given answer from the auth service,
  which is exactly where the interesting behaviour is — the address does not
  change on submit, it changes when a link in an inbox is opened, and the screen
  has to say so rather than claim it is done.
*/

test.describe('Epic 14 — Account and email change', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  test('the account screen shows the sign-in address and the account details', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings/account');

    await expect(page.getByRole('heading', { name: 'Contul meu' })).toBeVisible();
    // The address used to appear nowhere in the app at all.
    await expect(page.getByText('mihai@exemplu.ro').first()).toBeVisible();
    await expect(page.getByText('Aleea Teilor 15-20')).toBeVisible();
    await expect(page.getByText('Ap. 12')).toBeVisible();
    await expect(page.getByText('Email și parolă')).toBeVisible();

    // and both changes are reachable from here
    await expect(page.getByText('Schimbă emailul')).toBeVisible();
    await expect(page.getByText('Schimbă parola')).toBeVisible();
  });

  test('Settings leads to the account screen', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings');
    await page.getByText('Contul meu').click();
    await expect(page).toHaveURL(/#\/app\/settings\/account/);
  });

  test('a pending change is shown, so it does not look like nothing happened', async ({ page }) => {
    await signedInAs(page, { user: fakeUser({ new_email: 'mihai.nou@exemplu.ro' }) });
    await page.goto('/#/app/settings/account');

    await expect(page.getByText('Schimbare în așteptare')).toBeVisible();
    await expect(page.getByText(/mihai\.nou@exemplu\.ro/)).toBeVisible();
    await expect(page.getByText(/Adresa se schimbă abia după ce îl deschizi/)).toBeVisible();
  });

  /* ---- the change form ---- */

  async function openForm(page, opts) {
    await signedInAs(page, opts);
    await page.goto('/#/app/settings/email');
    await expect(page.getByRole('heading', { name: 'Schimbă emailul' })).toBeVisible();
  }

  const newEmailField = (page) => page.locator('input[type=email]');
  const pwField = (page) => page.locator('input[type=password]');
  const submitBtn = (page) => page.getByRole('button', { name: 'Trimite linkul de confirmare' });

  test('the current address is shown but cannot be edited', async ({ page }) => {
    await openForm(page);
    const current = page.locator('.input').first();
    await expect(current).toHaveValue('mihai@exemplu.ro');
    await expect(current).toBeDisabled();
  });

  test('a malformed address is refused before any network call', async ({ page }) => {
    await openForm(page);
    let called = false;
    await stubAuth(page, 'user', () => { called = true; return { body: {} }; });

    // Deliberately an address the browser's own validation lets through: a
    // domain with no dot is valid HTML, so this reaches our own check.
    await newEmailField(page).fill('nou@exemplu');
    await pwField(page).fill('parola123');
    await submitBtn(page).click();

    await expect(page.getByText(/adresă de email validă/)).toBeVisible();
    expect(called).toBe(false);
  });

  test('the password is required, since it is what proves it is you', async ({ page }) => {
    await openForm(page);
    await newEmailField(page).fill('nou@exemplu.ro');
    await submitBtn(page).click();
    await expect(page.getByText('Introdu parola actuală.')).toBeVisible();
  });

  test('a wrong password stops the change', async ({ page }) => {
    await openForm(page);
    // The identity check is a sign-in attempt with the current address.
    await stubAuth(page, 'token', () => ({ status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials' } }));
    let updated = false;
    await stubAuth(page, 'user', () => { updated = true; return { body: {} }; });

    await newEmailField(page).fill('nou@exemplu.ro');
    await pwField(page).fill('gresita');
    await submitBtn(page).click();

    await expect(page.getByText('Parola actuală este greșită.')).toBeVisible();
    // and crucially the address was never asked to move
    expect(updated).toBe(false);
  });

  test('the same address is refused, and never reaches the service', async ({ page }) => {
    await openForm(page);
    let touched = false;
    await stubAuth(page, 'token', () => { touched = true; return { body: {} }; });

    await newEmailField(page).fill('mihai@exemplu.ro');
    await pwField(page).fill('parola123');
    await submitBtn(page).click();

    await expect(page.getByText('Este chiar adresa ta actuală.')).toBeVisible();
    expect(touched).toBe(false);
  });

  test('an address that belongs to someone else is reported clearly', async ({ page }) => {
    await openForm(page);
    await stubAuth(page, 'token', () => ({ body: { access_token: 'stub', token_type: 'bearer', expires_in: 999999, refresh_token: 'stub', user: fakeUser() } }));
    await stubAuth(page, 'user', () => ({ status: 422, body: { code: 'email_exists', msg: 'A user with this email address has already been registered' } }));

    await newEmailField(page).fill('ocupat@exemplu.ro');
    await pwField(page).fill('parola123');
    await submitBtn(page).click();

    await expect(page.getByText(/Există deja un cont cu acest email/)).toBeVisible();
  });

  test('a good change says it is waiting on a link, not that it is done', async ({ page }) => {
    await openForm(page);
    await stubAuth(page, 'token', () => ({ body: { access_token: 'stub', token_type: 'bearer', expires_in: 999999, refresh_token: 'stub', user: fakeUser() } }));
    await stubAuth(page, 'user', () => ({ body: fakeUser({ new_email: 'nou@exemplu.ro' }) }));

    await newEmailField(page).fill('nou@exemplu.ro');
    await pwField(page).fill('parola123');
    await submitBtn(page).click();

    // Said twice on purpose: a toast that acknowledges the tap, and a card that
    // is still there once the toast has gone.
    await expect(page.locator('.toast-wrap')).toContainText(/link de confirmare pe nou@exemplu\.ro/);
    await expect(page.getByText('Schimbare în așteptare')).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'Adresa se schimbă abia' }))
      .toContainText('nou@exemplu.ro');

    // The old address is still the account's address until the link is opened.
    await expect(page.locator('.input').first()).toHaveValue('mihai@exemplu.ro');
  });

  test('a Google-only account is sent to set a password instead', async ({ page }) => {
    await openForm(page, {
      user: fakeUser({
        app_metadata: { provider: 'google', providers: ['google'] },
        identities: [{ identity_id: 'g1', provider: 'google' }],
      }),
    });

    await expect(page.getByText(/adresa vine de la Google/)).toBeVisible();
    await expect(newEmailField(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Setează o parolă' }).click();
    await expect(page).toHaveURL(/#\/app\/settings\/password/);
  });
});
