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
    await page.getByPlaceholder('Ana Popescu').fill('Test');
    await page.locator('input[type=email]').fill('test@exemplu.ro');
    await page.locator('input[type=password]').fill('123');
    await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
    await expect(page.getByText(/cel puțin 6 caractere/)).toBeVisible();
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
  for (const [path, label] of [['/#/join', 'Join'], ['/#/create', 'CreateCommunity']]) {
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
