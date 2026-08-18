import { test, expect, fresh } from './helpers.js';

/*
  Only the checks that work without hitting the real auth service live here.
  The end-to-end sign-up / log-in / join-by-code journeys now depend on a real
  Supabase account, so they moved out of the automated suite for now — see the
  note in the skipped Epic specs.
*/

test.describe('Epic 1 — Onboarding (offline-safe checks)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await fresh(page);
  });

  test('US-01 landing page shows value prop and CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('COMUNITATEA TA DE CARTIER', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Începe acum' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Am un cod de invitație' })).toBeVisible();
    await expect(page.getByText('Anunțuri oficiale, mereu la vedere')).toBeVisible();
  });

  test('US-02 sign up rejects a weak password before any network call', async ({ page }) => {
    await page.goto('/#/signup');
    // Fields carry no example text, so they are addressed in order:
    // name, email, password, confirmation.
    await page.locator('.input').first().fill('Test');
    await page.locator('input[type=email]').fill('test@exemplu.ro');
    await page.locator('input[type=password]').first().fill('123');
    await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
    await expect(page.getByText(/cel puțin 6 caractere/)).toBeVisible();
  });

  test('US-02 sign up rejects mistyped password confirmation', async ({ page }) => {
    await page.goto('/#/signup');
    await page.locator('.input').first().fill('Test');
    await page.locator('input[type=email]').fill('test@exemplu.ro');
    const pwFields = page.locator('input[type=password]');
    await pwFields.first().fill('parola123');
    await pwFields.nth(1).fill('parola124');
    await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
    await expect(page.getByText(/nu coincid/)).toBeVisible();
    // Must not have left the sign-up screen, i.e. no account was created.
    expect(page.url()).toContain('#/signup');
  });

  test('US-02 the eye button reveals and re-hides the password', async ({ page }) => {
    await page.goto('/#/signup');
    const first = page.locator('.input').nth(2); // name, email, then password
    await first.fill('secretul-meu');
    await expect(first).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Arată parola' }).first().click();
    await expect(first).toHaveAttribute('type', 'text');
    // Revealed means readable — that is the whole point of the button.
    await expect(first).toHaveValue('secretul-meu');

    await page.getByRole('button', { name: 'Ascunde parola' }).first().click();
    await expect(first).toHaveAttribute('type', 'password');
  });

  test('US-03 login also offers the reveal button', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: 'Arată parola' })).toBeVisible();
  });

  test('US-03 login does not proceed with a malformed email', async ({ page }) => {
    await page.goto('/#/login');
    await page.locator('input[type=email]').fill('not-an-email');
    await page.locator('input[type=password]').fill('parola123');
    await page.getByRole('button', { name: 'Intră în cont', exact: true }).click();
    await page.waitForTimeout(400);
    // the browser's own email validation stops the submit; either way we must
    // still be on the login screen, never inside the app
    expect(page.url()).toContain('#/login');
    await expect(page.getByRole('button', { name: 'Intră în cont', exact: true })).toBeVisible();
  });

  test('US-01/US-03 both sign-in paths are offered (Google + email)', async ({ page }) => {
    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: /Continuă cu Google/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Intră în cont', exact: true })).toBeVisible();
    await expect(page.getByText('Ai uitat parola?')).toBeVisible();
  });

  test('signed-out visitors cannot reach the app area', async ({ page }) => {
    await page.goto('/#/app');
    await page.waitForTimeout(800);
    expect(page.url()).toMatch(/#\/$|\/$/);
  });

  // Regression guard: guarded screens (Join, CreateCommunity, and the
  // staff/admin-only ones) used to call the router's imperative navigate()
  // during render instead of returning <Navigate>. That's a known React
  // Router foot-gun — it can leave the screen blank until something forces a
  // fresh render (e.g. a manual page refresh), instead of redirecting cleanly.
  for (const [path, label] of [['/#/create', 'CreateCommunity']]) {
    test(`${label}: visiting while signed out redirects cleanly, no blank frame`, async ({ page }) => {
      const warnings = [];
      page.on('console', (m) => { if (/navigate\(\)/.test(m.text())) warnings.push(m.text()); });
      await page.goto(path);
      await page.waitForTimeout(500);
      expect(page.url()).toContain('#/login');
      // the login form must actually be painted, not a blank screen
      await expect(page.getByRole('button', { name: 'Intră în cont', exact: true })).toBeVisible();
      expect(warnings).toEqual([]);
    });
  }
});

/*
  The invitation flow has to work for someone with no account — that is the
  whole point of an invitation. It used to bounce them to the login screen and
  discard the code, so these guard the order: code first, account second.
*/
test.describe('Epic 1 — Invitation by code', () => {
  test('the code screen is reachable while signed out', async ({ page }) => {
    await page.goto('/#/join');
    await page.waitForTimeout(400);
    // Must NOT have been redirected: an invited neighbour has no account yet.
    expect(page.url()).toContain('#/join');
    await expect(page.getByText('Cod comunitate')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verifică codul' })).toBeVisible();
  });

  test('the landing page invitation button leads to the code screen, not to login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Am un cod de invitație' }).click();
    await page.waitForTimeout(400);
    expect(page.url()).toContain('#/join');
    expect(page.url()).not.toContain('#/login');
    await expect(page.getByText('Cod comunitate')).toBeVisible();
  });

  test('the check button stays disabled until a code is typed', async ({ page }) => {
    await page.goto('/#/join');
    const btn = page.getByRole('button', { name: 'Verifică codul' });
    await expect(btn).toBeDisabled();
    await page.locator('.input').first().fill('TEILOR-15');
    await expect(btn).toBeEnabled();
  });

  test('an invitation link carries the code into the screen', async ({ page }) => {
    await page.goto('/#/join/TEILOR-15');
    await expect(page.locator('.input').first()).toHaveValue('TEILOR-15');
  });

  test('a bad code is rejected without leaving the screen', async ({ page }) => {
    await page.goto('/#/join');
    await page.locator('.input').first().fill('NU-EXISTA-99');
    await page.getByRole('button', { name: 'Verifică codul' }).click();
    // Offline in the sandbox the lookup fails too — either way the person must
    // be told, and must not be silently moved somewhere else.
    await expect(page.getByText(/Cod invalid/)).toBeVisible();
    expect(page.url()).toContain('#/join');
  });
});
