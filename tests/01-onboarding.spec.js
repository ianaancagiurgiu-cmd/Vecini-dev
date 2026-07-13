import { test, expect, fresh, loginViaUI } from './helpers.js';

test.describe('Epic 1 — Onboarding & Auth', () => {
  test.beforeEach(async ({ page }) => { await fresh(page); });

  test('US-01 landing page shows value prop and CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('COMUNITATEA TA DE CARTIER', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Începe acum' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Am un cod de invitație' })).toBeVisible();
    await expect(page.getByText('Anunțuri oficiale, mereu la vedere')).toBeVisible();
  });

  test('US-02 sign up with name, email, password lands on join', async ({ page }) => {
    await page.goto('/#/signup');
    await page.getByPlaceholder('Ana Popescu').fill('Test Vecin');
    await page.locator('input[type=email]').fill('test@exemplu.ro');
    await page.locator('input[type=password]').fill('parola123');
    await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
    await expect(page.getByText('Alătură-te comunității')).toBeVisible();
  });

  test('US-02 sign up rejects weak password', async ({ page }) => {
    await page.goto('/#/signup');
    await page.getByPlaceholder('Ana Popescu').fill('Test');
    await page.locator('input[type=email]').fill('test@exemplu.ro');
    await page.locator('input[type=password]').fill('123');
    await page.getByRole('button', { name: 'Înscrie-te', exact: true }).click();
    await expect(page.getByText(/cel puțin 6 caractere/)).toBeVisible();
  });

  test('US-03 login with valid credentials reaches dashboard', async ({ page }) => {
    await loginViaUI(page);
    await expect(page.getByText('Salut, Ana')).toBeVisible();
    await expect(page.locator('.bottom-nav')).toBeVisible();
  });

  test('US-03 invalid login shows friendly error', async ({ page }) => {
    await page.goto('/#/login');
    await page.locator('input[type=email]').fill('ana@exemplu.ro');
    await page.locator('input[type=password]').fill('123');
    await page.getByRole('button', { name: 'Intră în cont', exact: true }).click();
    await expect(page.getByText(/greșite/)).toBeVisible();
  });

  test('US-03 forgot password flow', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByText('Ai uitat parola?').click();
    await expect(page.getByText('Resetează parola')).toBeVisible();
    await page.locator('input[type=email]').fill('ana@exemplu.ro');
    await page.getByRole('button', { name: 'Trimite linkul' }).click();
    await expect(page.getByText(/am trimis un link/)).toBeVisible();
  });

  test('US-04 join with valid code enters community', async ({ page }) => {
    await page.goto('/#/join');
    await page.getByPlaceholder('CASTANI-12').fill('CASTANI-12');
    await page.getByRole('button', { name: 'Intră în comunitate' }).click();
    await expect(page.getByText('Salut, Ana')).toBeVisible({ timeout: 5000 });
  });

  test('US-04 join with invalid code shows error', async ({ page }) => {
    await page.goto('/#/join');
    await page.getByPlaceholder('CASTANI-12').fill('NOPE-99');
    await page.getByRole('button', { name: 'Intră în comunitate' }).click();
    await expect(page.getByText(/Cod invalid sau expirat/)).toBeVisible();
  });

  test('create a new community', async ({ page }) => {
    await page.goto('/#/create');
    await page.getByPlaceholder('Aleea Castanilor 12').fill('Bloc Nou 5');
    await page.getByRole('button', { name: 'Creează comunitatea' }).click();
    await expect(page.locator('.bottom-nav')).toBeVisible();
  });
});
