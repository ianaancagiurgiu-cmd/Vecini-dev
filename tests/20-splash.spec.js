import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/*
  The waiting screen.

  Two things can go wrong with it, in opposite directions. It can fail to show —
  which is what it was built for, since the bundle takes long enough on mobile
  data that the app opens on a blank page. Or it can fail to leave, and then it
  is not a splash but a wall in front of a working app.

  The second test is the one that matters more, because a splash that never
  lifts looks exactly like an app that never loads.
*/

const pathsIn = (svg) => [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);

test.describe('Waiting screen', () => {
  test('is painted before any script runs', async ({ page }) => {
    // Exactly the situation it exists for: markup has arrived, the bundle has not.
    await page.route('**/assets/*.js', (r) => r.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const splash = page.locator('#splash');
    await expect(splash).toBeVisible();
    await expect(splash.locator('svg.mark')).toBeVisible();
    await expect(splash).toContainText('made by');
    await expect(splash).toContainText('Vecini');

    // It has to cover the page, not sit above it in the document flow.
    const box = await splash.boundingBox();
    const view = page.viewportSize();
    expect(box.width).toBeGreaterThanOrEqual(view.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(view.height - 1);
  });

  test('draws the mark itself, not a request for it', async ({ page }) => {
    /*
      The whole point of keeping the drawing inline is that it costs nothing to
      paint. Someone tidying the duplication away into <img src="/logo.svg">
      would give back the blank first frame this screen exists to cover, and
      nothing else in the suite would notice.
    */
    await page.route('**/assets/*.js', (r) => r.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('#splash svg.mark path')).toHaveCount(2);
    expect(await page.locator('#splash img, #splash use, #splash object').count(),
      'the waiting screen fetches its artwork instead of carrying it').toBe(0);
  });

  test('carries the same drawing as public/logo.svg', async () => {
    // Two copies of the mark, one inline and one on disk. They are allowed to
    // exist; they are not allowed to disagree.
    const inline = pathsIn(readFileSync(new URL('../index.html', import.meta.url), 'utf8')
      .match(/<svg class="mark"[\s\S]*?<\/svg>/)[0]);
    const source = pathsIn(readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8'));

    expect(inline.length, 'the inline mark has no paths').toBeGreaterThan(0);
    expect(inline, 'index.html and public/logo.svg have drifted apart').toEqual(source);
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
