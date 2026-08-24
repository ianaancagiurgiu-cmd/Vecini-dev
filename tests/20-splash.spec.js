import { test, expect } from '@playwright/test';

/*
  The waiting screen.

  Two things can go wrong with it, in opposite directions. It can fail to show —
  which is what it was built for, since the bundle takes long enough on mobile
  data that the app opens on a blank page. Or it can fail to leave, and then it
  is not a splash but a wall in front of a working app.

  The second test is the one that matters more, because a splash that never
  lifts looks exactly like an app that never loads.
*/

test.describe('Waiting screen', () => {
  test('is painted before any script runs', async ({ page }) => {
    // Exactly the situation it exists for: markup has arrived, the bundle has not.
    await page.route('**/assets/*.js', (r) => r.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const splash = page.locator('#splash');
    await expect(splash).toBeVisible();
    await expect(splash.locator('svg.snail')).toBeVisible();
    await expect(splash).toContainText('Loading');

    // It has to cover the page, not sit above it in the document flow.
    const box = await splash.boundingBox();
    const view = page.viewportSize();
    expect(box.width).toBeGreaterThanOrEqual(view.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(view.height - 1);
  });

  test('fills the bar progressively, and never backwards', async ({ page }) => {
    await page.route('**/assets/*.js', (r) => r.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#splash .track')).toBeVisible();
    const bar = page.locator('#splash .bar');

    /*
      Both halves matter, and the second is the one that was actually wrong
      before: a segment that swept across on a loop grew and then snapped back
      to nothing every second and a half, which reads as a flicker rather than
      as progress. Sampling only the start and end would not have caught it.
    */
    const seen = [];
    for (let i = 0; i < 10; i++) {
      seen.push((await bar.boundingBox()).width);
      await page.waitForTimeout(160);
    }

    const shown = seen.map((w) => Math.round(w));
    expect(seen.at(-1), `the bar should have grown; saw ${shown.join(', ')}`)
      .toBeGreaterThan(seen[0] + 20);

    for (let i = 1; i < seen.length; i++) {
      // A pixel of slack for rounding, but nothing that reads as a jump back.
      expect(seen[i], `the bar went backwards at sample ${i}: ${shown.join(', ')}`)
        .toBeGreaterThanOrEqual(seen[i - 1] - 1);
    }
  });

  test('is gone once a real screen is behind it', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByText('Comunitatea ta de cartier').first()).toBeVisible();
    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 8000 });
  });

  test('leaves nothing intercepting taps', async ({ page }) => {
    // The fade is on opacity, so a splash left in place would still swallow
    // every tap while looking perfectly invisible.
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('#splash')).toHaveCount(0, { timeout: 8000 });

    const atCentre = await page.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return el ? el.id : null;
    });
    expect(atCentre).not.toBe('splash');
  });
});
