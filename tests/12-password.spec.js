import { test, expect } from '@playwright/test';

/*
  Password flows. These cover the validation that happens before any network
  call, so they run without a real Supabase session.

  Context: the "forgot password" email used to lead nowhere — the link signed
  the person in but there was no screen to actually type a new password. The
  first test guards that the screen exists and is reachable.
*/

test.describe('Password flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  test('the "choose a new password" screen exists and asks twice', async ({ page }) => {
    await page.goto('/#/new-password');
    await page.waitForTimeout(400);
    await expect(page.getByRole('heading', { name: 'Alege o parolă nouă' })).toBeVisible();
    // new + confirm, so a typo can't silently lock someone out
    await expect(page.locator('input[type=password]')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Salvează parola' })).toBeVisible();
  });

  test('mismatched passwords are rejected before any network call', async ({ page }) => {
    await page.goto('/#/new-password');
    await page.waitForTimeout(400);
    const pw = page.locator('input[type=password]');
    await pw.nth(0).fill('parolanoua1');
    await pw.nth(1).fill('altceva123');
    await page.getByRole('button', { name: 'Salvează parola' }).click();
    await expect(page.getByText('Cele două parole nu coincid.')).toBeVisible();
  });

  test('short passwords are rejected before any network call', async ({ page }) => {
    await page.goto('/#/new-password');
    await page.waitForTimeout(400);
    const pw = page.locator('input[type=password]');
    await pw.nth(0).fill('123');
    await pw.nth(1).fill('123');
    await page.getByRole('button', { name: 'Salvează parola' }).click();
    await expect(page.getByText(/cel puțin 6 caractere/)).toBeVisible();
  });

  test('forgot-password screen offers to email a reset link', async ({ page }) => {
    await page.goto('/#/forgot');
    await page.waitForTimeout(400);
    await expect(page.getByRole('heading', { name: 'Resetează parola' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trimite linkul' })).toBeVisible();
  });

  // The in-app change screen lives behind auth, so we can only assert that it
  // is guarded — the form itself needs a signed-in session to reach.
  test('in-app change-password screen is behind login', async ({ page }) => {
    await page.goto('/#/app/settings/password');
    await page.waitForTimeout(800);
    expect(page.url()).not.toContain('/app/settings/password');
  });
});
