import { test, expect, enterApp } from './helpers.js';

test.describe('Epic 9 — Notifications', () => {
  test('US-28 notification bell shows unread count and list', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    // unread badge on the dashboard bell
    await expect(page.locator('.pad span', { hasText: /^\d+$/ }).first()).toBeVisible();
    await page.goto('/#/app/notifications');
    await expect(page.getByText('Anunț nou oficial')).toBeVisible();
    await expect(page.getByText('Sesizarea ta a fost actualizată')).toBeVisible();
  });

  test('US-28 mark all as read clears the unread markers', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/notifications');
    await page.getByRole('button', { name: 'Marchează toate ca citite' }).click();
    await expect(page.getByRole('button', { name: 'Marchează toate ca citite' })).toHaveCount(0);
  });

  test('US-29 notification preferences can be toggled', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/notifications');
    await page.getByRole('button', { name: /Preferințe/ }).click();
    await expect(page.getByText('Toate anunțurile')).toBeVisible();
    await expect(page.getByText('Răspunsuri la postările mele')).toBeVisible();
  });
});

test.describe('Cross-cutting — roles & language', () => {
  test('language toggle switches the UI to English', async ({ page }) => {
    await enterApp(page, { role: 'admin', lang: 'ro' });
    await page.goto('/#/app/settings');
    await page.getByRole('button', { name: /English/ }).click();
    await expect(page.getByText('Log out')).toBeVisible();
  });

  test('role switcher reveals admin entry only for staff', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await page.goto('/#/app/settings');
    await expect(page.getByText('Panou admin')).toHaveCount(0);
    // switch to admin via the floating role bar
    await page.locator('.phone > div').filter({ hasText: /Membru|Admin|Moderator/ }).last();
    await page.getByRole('button', { name: /Membru/ }).first().click();
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await expect(page.getByText('Panou admin')).toBeVisible();
  });
});
