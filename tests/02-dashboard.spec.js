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

  // Regression: on a real phone the browser address bar can drag the whole
  // page and make the nav drift. The outer shell must be locked so only the
  // inner content scrolls and the nav never moves in the viewport.
  test('US-06 outer page cannot scroll; nav is fixed in the viewport', async ({ page }) => {
    await enterApp(page);
    const navBefore = await page.evaluate(() => document.querySelector('.bottom-nav').getBoundingClientRect().bottom);
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.evaluate(() => document.querySelector('.phone__scroll').scrollBy(0, 400));
    await page.waitForTimeout(150);
    const res = await page.evaluate(() => ({
      windowScrollY: window.scrollY,
      innerScrolled: document.querySelector('.phone__scroll').scrollTop,
      navBottom: document.querySelector('.bottom-nav').getBoundingClientRect().bottom,
    }));
    expect(res.windowScrollY).toBe(0);          // outer shell locked
    expect(res.innerScrolled).toBeGreaterThan(0); // inner content scrolls
    expect(Math.abs(res.navBottom - navBefore)).toBeLessThan(2); // nav didn't move
  });
});
