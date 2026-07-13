import { test, expect, enterApp, tab } from './helpers.js';

test.describe('Epic 3 — Announcements', () => {
  test('US-07 feed lists announcements newest-first with pinned on top', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Anunțuri');
    await expect(page.getByText('Doar anunțuri oficiale')).toBeVisible();
    const first = page.locator('.card').first();
    await expect(first.getByText('Fixat')).toBeVisible(); // pinned announcement floats to top
  });

  test('US-07 members cannot see the "new announcement" button', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Anunțuri');
    await expect(page.getByRole('button', { name: /Anunț nou/ })).toHaveCount(0);
  });

  test('US-08 tapping an announcement opens the full text', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Anunțuri');
    await page.getByText('Reparație lift blocul B — finalizată').click();
    await expect(page.getByText(/repus în funcțiune/)).toBeVisible();
    await expect(page.getByText('Publicat de')).toBeVisible();
  });

  test('US-09 admin can publish an announcement and it appears in the feed', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await tab(page, 'Anunțuri');
    await page.getByRole('button', { name: /Anunț nou/ }).click();
    await page.getByPlaceholder(/Curățenie generală/).fill('Test anunț automat');
    await page.getByPlaceholder(/Scrie mesajul/).fill('Conținutul anunțului de test.');
    await page.getByRole('button', { name: 'Publică anunțul' }).click();
    await expect(page.getByText('Test anunț automat')).toBeVisible();
    await tab(page, 'Anunțuri');
    await expect(page.getByText('Test anunț automat')).toBeVisible();
  });

  test('US-09 publish button disabled until title and body filled', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/announcements/new');
    await expect(page.getByRole('button', { name: 'Publică anunțul' })).toBeDisabled();
  });
});
