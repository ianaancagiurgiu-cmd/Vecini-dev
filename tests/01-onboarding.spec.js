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
});
