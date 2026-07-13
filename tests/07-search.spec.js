import { test, expect, enterApp } from './helpers.js';

test.describe('Epic 7 — Search & Archive', () => {
  test('US-21 search finds content grouped by type', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/search');
    await page.getByPlaceholder('Caută în comunitate…').fill('curățenie');
    await expect(page.getByText(/rezultate pentru/)).toBeVisible();
    await expect(page.getByText('Curățenie generală pe scara A — sâmbătă 28 iunie')).toBeVisible();
  });

  test('US-21 empty search shows a helpful message', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/search');
    await page.getByPlaceholder('Caută în comunitate…').fill('zzzznimic');
    await expect(page.getByText(/Niciun rezultat/)).toBeVisible();
  });

  test('US-22 archive lists resolved issues and closed polls', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/search');
    await page.getByRole('button', { name: /Arhivă/ }).click();
    await expect(page.getByText('Liftul de pe scara B se blochează')).toBeVisible();
    await expect(page.getByText('Aprobăm reparația liftului de pe scara B?')).toBeVisible();
  });
});
