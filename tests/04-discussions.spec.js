import { test, expect, enterApp, tab } from './helpers.js';

test.describe('Epic 4 — Discussions', () => {
  test('US-10 browse threads with category badges and reply counts', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Discuții');
    await expect(page.getByText('Idei pentru locul de joacă')).toBeVisible();
    await expect(page.locator('.card').first().getByText(/💬 \d/)).toBeVisible();
  });

  test('US-10 category filter narrows the list', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Discuții');
    await page.getByRole('button', { name: /Parcare/ }).first().click();
    await expect(page.getByText('Locurile de parcare din spate')).toBeVisible();
    await expect(page.getByText('Idei pentru locul de joacă')).toHaveCount(0);
  });

  test('US-11 create a new discussion with title, category and body', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Discuții');
    await page.getByRole('button', { name: /Temă nouă/ }).click();
    await page.getByPlaceholder(/Idei pentru locul de joacă/).fill('Propunere reciclare');
    await page.getByRole('button', { name: /Diverse/ }).first().click();
    await page.getByPlaceholder(/Descrie subiectul/).fill('Hai să reciclăm împreună.');
    await page.getByRole('button', { name: 'Publică tema' }).click();
    await expect(page.getByText('Propunere reciclare')).toBeVisible();
  });

  test('US-11 preview before publishing', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/discussions/new');
    await page.getByPlaceholder(/Idei pentru locul de joacă/).fill('Titlu preview');
    await page.getByRole('button', { name: /Evenimente/ }).first().click();
    await page.getByPlaceholder(/Descrie subiectul/).fill('Text preview.');
    await page.getByRole('button', { name: 'Previzualizează' }).click();
    await expect(page.getByText('Titlu preview')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publică tema' })).toBeVisible();
  });

  test('US-12 reply to a discussion updates the thread', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Discuții');
    await page.getByText('Idei pentru locul de joacă').click();
    await page.getByPlaceholder('Scrie un răspuns…').fill('Sunt de acord!');
    await page.getByPlaceholder('Scrie un răspuns…').press('Enter');
    await expect(page.getByText('Sunt de acord!')).toBeVisible();
  });
});
