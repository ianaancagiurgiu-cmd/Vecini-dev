import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

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

  /*
    Regression guard: the onboarding sheet used to sit below the bottom nav in
    the stacking order, so the nav painted over its lower edge and hid the very
    button the sheet was asking people to press. The two elements live in
    different subtrees — the nav is `fixed`, the sheet `absolute` inside the
    phone frame — which is exactly the arrangement where a stray stacking
    context on some ancestor would quietly break the ordering again.

    So this checks both halves: that the source still declares the sheet above
    the nav, and that with those numbers the sheet really does win at the foot
    of the screen.
  */
  test('the onboarding sheet covers the bottom nav rather than hiding under it', async ({ page }) => {
    const navZ = Number(
      /\.bottom-nav\s*\{[^}]*?z-index:\s*(\d+)/s.exec(readFileSync('src/styles/global.css', 'utf8'))[1]
    );
    const sheetZ = Number(
      /zIndex:\s*(\d+)/.exec(readFileSync('src/components/Onboarding.jsx', 'utf8'))[1]
    );
    expect(sheetZ).toBeGreaterThan(navZ);

    await page.goto('/');
    await page.waitForTimeout(300);

    const topAtFoot = await page.evaluate(({ shell, navZ, sheetZ }) => {
      document.body.innerHTML = shell;
      const phone = document.querySelector('.phone');
      const overlay = document.createElement('div');
      overlay.id = 'ob-overlay';
      overlay.style.cssText =
        `position:absolute;inset:0;z-index:${sheetZ};display:flex;align-items:flex-end`;
      overlay.innerHTML = '<div id="ob-panel" style="width:100%;height:340px;background:#fff"></div>';
      phone.appendChild(overlay);
      document.querySelector('.bottom-nav').style.zIndex = String(navZ);

      // A point inside the nav's band — where the sheet's button was being eaten.
      const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
      const hit = document.elementFromPoint(nav.left + nav.width / 2, nav.top + nav.height / 2);
      return hit ? hit.closest('#ob-overlay, .bottom-nav')?.id || 'bottom-nav' : null;
    }, { shell: SHELL, navZ, sheetZ });

    expect(topAtFoot).toBe('ob-overlay');
  });

  // Regression guard: iOS Safari force-zooms (and pans) the whole page when
  // a focused text field's font is under 16px, ignoring our
  // user-scalable=no meta tag. That zoom/pan is what produced the "page is
  // scrolled down, leaving a blank gap above the keyboard" report — so every
  // real text input must render at 16px or larger.
  test('text inputs render at 16px+ (prevents iOS auto-zoom-on-focus)', async ({ page }) => {
    await page.goto('/#/signup');
    await page.waitForTimeout(400);
    const sizes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input.input, textarea.input'))
        .map((el) => parseFloat(getComputedStyle(el).fontSize))
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const px of sizes) expect(px).toBeGreaterThanOrEqual(16);
  });
});
