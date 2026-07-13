import { test, expect, enterApp, tab } from './helpers.js';

const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.describe('Epic 5 — Issue Reporting', () => {
  test('US-13 report a new issue with title, category, location, description and photo', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Sesizări');
    await page.getByRole('button', { name: /Raportează/ }).click();
    await page.getByPlaceholder(/Bec ars pe scara A/).fill('Geam spart la intrare');
    await page.getByRole('button', { name: /Siguranță/ }).first().click();
    await page.getByPlaceholder(/Scara A, parter/).fill('Scara B, parter');
    await page.getByPlaceholder(/Descrie problema/).fill('Geamul de la ușă e spart.');
    await page.setInputFiles('input[type=file]', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG, 'base64') });
    await page.getByRole('button', { name: 'Trimite sesizarea' }).click();
    // lands on detail with everything intact
    await expect(page.getByRole('heading', { name: 'Geam spart la intrare' })).toBeVisible();
    await expect(page.getByText('Geamul de la ușă e spart.')).toBeVisible();
    await expect(page.locator('img')).toBeVisible();
  });

  // Regression guard for the bug where a saved issue lost its title.
  test('US-13/US-14 a reported issue keeps its title and shows in the list (and after reload)', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/issues/new');
    await page.getByPlaceholder(/Bec ars pe scara A/).fill('Ușa nu se închide');
    await page.getByRole('button', { name: /Siguranță/ }).first().click();
    await page.getByPlaceholder(/Descrie problema/).fill('Rămâne deschisă noaptea.');
    await page.getByRole('button', { name: 'Trimite sesizarea' }).click();
    await tab(page, 'Sesizări');
    await expect(page.getByText('Ușa nu se închide')).toBeVisible();
    // survives a full reload (persisted with its title)
    await page.reload();
    await expect(page.getByText('Ușa nu se închide')).toBeVisible();
  });

  test('US-14 issues list shows colour-coded status badges and filters', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Sesizări');
    await expect(page.getByText('Bec ars pe scara A')).toBeVisible();
    await page.getByRole('button', { name: 'Rezolvat', exact: true }).click();
    await expect(page.getByText('Liftul de pe scara B se blochează')).toBeVisible();
    await expect(page.getByText('Bec ars pe scara A')).toHaveCount(0);
  });

  test('US-15 issue detail shows description, history and supporting', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    // issue 102 has 1 supporter (not Ana); supporting adds her -> 2
    await page.goto('/#/app/issues/102');
    await expect(page.getByText('Istoric status')).toBeVisible();
    await expect(page.getByText(/apă curgând|Se aude apă/)).toBeVisible();
    await page.getByRole('button', { name: /Susțin această sesizare/ }).click();
    await expect(page.getByRole('button', { name: /Susțin această sesizare · 2/ })).toBeVisible();
  });

  test('US-15 member can add a comment to an issue', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/issues/101');
    await page.getByPlaceholder('Scrie un comentariu…').fill('Confirm și eu.');
    await page.getByPlaceholder('Scrie un comentariu…').press('Enter');
    await expect(page.getByText('Confirm și eu.')).toBeVisible();
  });

  test('US-16 admin updates status with a mandatory note', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/issues/102'); // status "new"
    await expect(page.getByText('SCHIMBĂ STATUS')).toBeVisible();
    await page.getByRole('button', { name: 'În lucru', exact: true }).click();
    await page.getByPlaceholder(/Adaugă o notă/).fill('Am chemat instalatorul.');
    await page.getByRole('button', { name: 'Actualizează statusul' }).click();
    await expect(page.getByText('Am chemat instalatorul.')).toBeVisible();
  });

  test('US-16 members do not see the status controls', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/issues/102');
    await expect(page.getByText('SCHIMBĂ STATUS')).toHaveCount(0);
  });
});
