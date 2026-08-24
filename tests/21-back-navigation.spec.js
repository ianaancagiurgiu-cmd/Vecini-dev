import { test, expect } from '@playwright/test';
import { signedInAs } from './helpers.js';

/*
  Where "back" lands.

  Two screens open from two different places, and that is the whole point of
  these tests: a fixed return address passes whichever journey you happen to
  write first and fails the other. So each one is walked from both doors.

  Every journey is made by tapping. The first draft of this file used goto()
  for each step and two tests failed that should have passed — goto reloads the
  page and wipes the history, so it was measuring something no user ever does.
  The last test keeps that behaviour on purpose, because arriving cold on a
  screen is real: it is what a notification does.
*/

const hash = (page) => new URL(page.url()).hash.replace(/^#/, '');
const back = (page) => page.getByLabel('back').click();

test.describe('Going back', () => {
  test('search offers a way back at all', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app');

    await page.getByLabel('Caută & arhivă').click();
    await expect.poll(() => hash(page)).toBe('/app/search');

    await expect(page.getByLabel('back')).toBeVisible();
    await back(page);
    await expect.poll(() => hash(page)).toBe('/app');
  });

  test('neighbours returns to the dashboard when opened from it', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app');

    await page.getByRole('button', { name: /vecin/i }).first().click();
    await expect.poll(() => hash(page)).toBe('/app/neighbours');

    await back(page);
    await expect.poll(() => hash(page)).toBe('/app');
  });

  test('neighbours returns to settings when opened from there', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings');

    await page.getByRole('button', { name: 'Vecinii mei' }).click();
    await expect.poll(() => hash(page)).toBe('/app/neighbours');

    await back(page);
    await expect.poll(() => hash(page)).toBe('/app/settings');
  });

  test('notifications returns to the dashboard when opened from it', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app');

    await page.getByLabel('Notificări').click();
    await expect.poll(() => hash(page)).toBe('/app/notifications');

    await back(page);
    await expect.poll(() => hash(page)).toBe('/app');
  });

  test('notifications returns to settings when opened from there', async ({ page }) => {
    await signedInAs(page);
    await page.goto('/#/app/settings');

    await page.getByRole('button', { name: 'Preferințe notificări' }).click();
    await expect.poll(() => hash(page)).toBe('/app/notifications');

    await back(page);
    await expect.poll(() => hash(page)).toBe('/app/settings');
  });

  test('a screen opened cold goes up a level rather than out of the app', async ({ page }) => {
    // No history of ours behind this one, as when a notification opens the app
    // directly here. Plain history.back() would leave the site.
    await signedInAs(page);
    await page.goto('/#/app/notifications');

    await back(page);
    await expect.poll(() => hash(page)).toBe('/app');
  });
});
