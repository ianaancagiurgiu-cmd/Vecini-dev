import { test, expect } from '@playwright/test';

/*
  Regression tests for the app shell layout. These deliberately avoid needing a
  signed-in session, so they run anywhere.

  The bug they guard: some mobile / in-app browsers report a viewport height
  taller than what is actually visible. The shell was then laid out too tall,
  the document itself became scrollable, and the bottom nav — anchored to the
  bottom of that oversized shell — drifted up into the middle of the screen.
*/

const SHELL = `
  <div class="stage"><div class="phone">
    <div class="statusbar"></div>
    <div class="phone__scroll"><div class="screen" style="height:2400px">tall</div></div>
    <nav class="bottom-nav"><a href="#">Acasă</a></nav>
  </div></div>`;

test.describe('App shell layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  test('shell matches the visible viewport and the document cannot scroll', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        innerHeight: window.innerHeight,
        phoneH: Math.round(document.querySelector('.phone').getBoundingClientRect().height),
        docScrollable: de.scrollHeight > de.clientHeight,
      };
    });
    expect(Math.abs(m.phoneH - m.innerHeight)).toBeLessThan(3);
    expect(m.docScrollable).toBe(false);

    await page.evaluate(() => window.scrollBy(0, 600));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('bottom nav stays at the visible bottom even if the browser mis-reports height', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(300);

    const res = await page.evaluate(async (shell) => {
      document.body.innerHTML = shell;
      const navRect = () => document.querySelector('.bottom-nav').getBoundingClientRect();
      const out = { innerHeight: window.innerHeight, normal: Math.round(navRect().bottom) };

      // simulate a browser that claims 220px more height than is visible
      document.documentElement.style.setProperty('--app-h', (window.innerHeight + 220) + 'px');
      await new Promise((r) => requestAnimationFrame(r));
      out.lying = Math.round(navRect().bottom);
      out.position = getComputedStyle(document.querySelector('.bottom-nav')).position;
      return out;
    }, SHELL);

    expect(res.position).toBe('fixed');
    expect(Math.abs(res.normal - res.innerHeight)).toBeLessThan(3);
    // the whole point: a lying viewport must NOT push the nav off-screen
    expect(Math.abs(res.lying - res.innerHeight)).toBeLessThan(3);
  });

  test('content scrolls inside the screen while the page stays put', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 }); // force overflow
    await page.goto('/');
    await page.waitForTimeout(400);

    const overflow = await page.evaluate(() => {
      const sc = document.querySelector('.phone__scroll');
      return sc.scrollHeight - sc.clientHeight;
    });
    expect(overflow).toBeGreaterThan(0);

    await page.mouse.move(195, 280);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(250);

    const after = await page.evaluate(() => ({
      inner: document.querySelector('.phone__scroll').scrollTop,
      win: window.scrollY,
    }));
    expect(after.inner).toBeGreaterThan(0);
    expect(after.win).toBe(0);
  });
});
