import { test, expect, enterApp } from './helpers.js';

test.describe('Epic 8 — Admin & Moderation', () => {
  test('US-23 admin panel shows stats and a pending badge', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/admin');
    await expect(page.getByText('Panou admin')).toBeVisible();
    await expect(page.getByText('membri activi', { exact: true })).toBeVisible();
    await expect(page.getByText(/așteaptă aprobarea ta/)).toBeVisible();
  });

  test('US-23 admin panel is not reachable by a member', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/admin');
    // the guard prevents members from seeing any admin content
    await expect(page.getByText('Panou admin')).toHaveCount(0);
    await expect(page.getByText('membri activi', { exact: true })).toHaveCount(0);
  });

  test('US-24 moderator approves a pending post', async ({ page }) => {
    await enterApp(page, { role: 'moderator' });
    await page.goto('/#/app/admin/moderation');
    await expect(page.getByText('Reciclare — putem pune mai multe tomberoane?')).toBeVisible();
    await page.getByRole('button', { name: /Aprobă/ }).click();
    await expect(page.getByText('Reciclare — putem pune mai multe tomberoane?')).toHaveCount(0);
  });

  test('US-25 admin changes a member role', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/admin/members');
    const radu = page.locator('.card', { hasText: 'Radu Marin' });
    await radu.getByRole('button', { name: /Moderator/ }).click();
    await expect(radu.getByText('Moderator')).toBeVisible();
  });

  test('US-25 admin removes a member with confirmation', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/admin/members');
    const george = page.locator('.card', { hasText: 'George Vlad' });
    await george.getByRole('button', { name: 'Elimină' }).first().click();
    await george.locator('.btn--terracotta').click(); // confirm remove
    await expect(page.getByText('George Vlad')).toHaveCount(0);
  });

  test('US-26/US-27 admin edits settings and regenerates the invite code', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/admin/settings');
    await expect(page.getByText('CASTANI-12', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Generează cod nou/ }).click();
    await page.getByRole('button', { name: 'Confirmă' }).click();
    await expect(page.getByText('CASTANI-12', { exact: true })).toHaveCount(0); // code changed
  });
});
