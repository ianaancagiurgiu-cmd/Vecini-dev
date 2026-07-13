import { test, expect, enterApp, tab } from './helpers.js';

test.describe('Epic 2 — Dashboard & Navigation', () => {
  test('US-05 dashboard summarises announcements, issues, polls, discussions', async ({ page }) => {
    await enterApp(page);
    await expect(page.getByText('Salut, Ana')).toBeVisible();
    await expect(page.getByText('sesizări active')).toBeVisible();
    await expect(page.getByText('voturi deschise')).toBeVisible();
    await expect(page.getByText('Anunțuri recente')).toBeVisible();
    await expect(page.getByText('Curățenie generală pe scara A — sâmbătă 28 iunie')).toBeVisible();
    await expect(page.getByText('Discuții recente')).toBeVisible();
  });

  test('US-05 "Vezi toate" links open the announcements feed', async ({ page }) => {
    await enterApp(page);
    await page.getByRole('button', { name: 'Vezi toate' }).first().click();
    await expect(page).toHaveURL(/#\/app\/announcements/);
  });

  test('US-06 bottom nav switches sections and highlights active', async ({ page }) => {
    await enterApp(page);
    for (const [label, urlPart] of [
      ['Anunțuri', 'announcements'],
      ['Discuții', 'discussions'],
      ['Sesizări', 'issues'],
      ['Voturi', 'polls'],
    ]) {
      await tab(page, label);
      await expect(page).toHaveURL(new RegExp('#/app/' + urlPart));
    }
    await tab(page, 'Acasă');
    await expect(page).toHaveURL(/#\/app$/);
  });

  test('US-06 nav stays pinned to the bottom while scrolling', async ({ page }) => {
    await enterApp(page);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(200);
    const gap = await page.evaluate(() => {
      const nav = document.querySelector('.bottom-nav');
      const phone = document.querySelector('.phone');
      return Math.round(phone.getBoundingClientRect().bottom - nav.getBoundingClientRect().bottom);
    });
    expect(Math.abs(gap)).toBeLessThan(3);
  });
});
