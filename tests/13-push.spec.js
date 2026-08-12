import { readFileSync } from 'fs';
import { test, expect } from './helpers.js';

/*
  Push notifications, tested at the two layers that can be tested here:
    1. the files a browser needs before it will install the app or accept push
    2. the service worker's own push / click handling, run against a mock `self`

  Actual delivery (Supabase Edge Function -> FCM/APNs) needs deployed secrets
  and outbound network, so it is not covered here.
*/

test.describe('Epic 13 — push notification plumbing', () => {
  test('web app manifest is served and installable', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);

    const m = await res.json();
    expect(m.name).toContain('Vecini');
    expect(m.short_name).toBe('Vecini');
    // Standalone display is what makes iOS treat it as an app (and allow push).
    expect(m.display).toBe('standalone');
    // The app is a HashRouter app, so the start URL must carry the '#'.
    expect(m.start_url).toContain('#');
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
    const sizes = m.icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    // Android needs a maskable icon or it shows a shrunken glyph in a white circle.
    expect(m.icons.some((i) => String(i.purpose).includes('maskable'))).toBe(true);
  });

  test('icons are real PNGs at their declared sizes', async ({ request }) => {
    for (const [file, size] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
      const res = await request.get('/' + file);
      expect(res.status(), file).toBe(200);
      expect(res.headers()['content-type'], file).toContain('image/png');

      const buf = await res.body();
      expect(buf.subarray(0, 8).toString('hex'), file).toBe('89504e470d0a1a0a'); // PNG magic
      expect(buf.readUInt32BE(16), file).toBe(size); // IHDR width
      expect(buf.readUInt32BE(20), file).toBe(size); // IHDR height
    }
  });

  test('service worker is served as JavaScript from the site root', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    // Served from anywhere but the root, its scope could not cover the whole app.
    expect(res.headers()['content-type']).toMatch(/javascript/);
    expect(await res.text()).toContain("addEventListener('push'");
  });

  test('index.html declares the manifest and the iOS-only tags', async ({ request }) => {
    const html = await (await request.get('/')).text();
    expect(html).toContain('rel="manifest"');
    // iOS ignores manifest icons; without this the home screen icon is a screenshot.
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('apple-mobile-web-app-capable');
  });

  test('service worker registers and reaches activated', async ({ page }) => {
    await page.goto('/');
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sw = reg.active || reg.installing || reg.waiting;
      return { scope: reg.scope, state: sw && sw.state };
    });
    expect(state.scope).toMatch(/\/$/);
    expect(state.state).toBe('activated');
  });
});

/*
  Run the real sw.js against a mock `self` so the push handling is exercised
  rather than assumed. This is where the HashRouter link translation lives, and
  getting it wrong would send every notification tap to a blank page.
*/
function loadServiceWorker() {
  const code = readFileSync(new URL('../public/sw.js', import.meta.url).pathname, 'utf8');
  const handlers = {};
  const shown = [];
  const focused = [];
  const opened = [];
  let windows = [];

  const self = {
    location: { origin: 'https://vecini-comunitate.netlify.app' },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: () => {},
    registration: {
      showNotification: (title, options) => { shown.push({ title, options }); return Promise.resolve(); },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(windows),
      openWindow: (url) => { opened.push(url); return Promise.resolve(); },
    },
  };

  new Function('self', code)(self);

  const fire = async (type, event) => {
    const waits = [];
    await handlers[type]({ ...event, waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  };

  return {
    fire, shown, opened, focused,
    setWindows: (list) => { windows = list; },
  };
}

test.describe('Epic 13 — service worker push handling', () => {
  test('a push payload becomes a notification with a hash-router link', async () => {
    const sw = loadServiceWorker();
    await sw.fire('push', {
      data: { json: () => ({ title: 'Anunț nou', body: 'Apa se oprește joi', link: '/app/announcements/abc', type: 'announcement' }) },
    });

    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].title).toBe('Anunț nou');
    expect(sw.shown[0].options.body).toBe('Apa se oprește joi');
    // The critical bit: '/app/...' must become '/#/app/...' for HashRouter.
    expect(sw.shown[0].options.data.link).toBe('/#/app/announcements/abc');
    expect(sw.shown[0].options.icon).toBe('/icon-192.png');
  });

  test('a push with no link falls back to the notifications screen', async () => {
    const sw = loadServiceWorker();
    await sw.fire('push', { data: { json: () => ({ title: 'Vecini', body: 'ceva' }) } });
    expect(sw.shown[0].options.data.link).toBe('/#/app/notifications');
  });

  test('a malformed push body still shows something', async () => {
    const sw = loadServiceWorker();
    await sw.fire('push', {
      data: { json: () => { throw new Error('not json'); }, text: () => 'plain text' },
    });
    expect(sw.shown).toHaveLength(1);
    expect(sw.shown[0].options.body).toBe('plain text');
  });

  test('clicking a notification opens a new window when none is open', async () => {
    const sw = loadServiceWorker();
    sw.setWindows([]);
    await sw.fire('notificationclick', {
      notification: { close: () => {}, data: { link: '/#/app/issues/7' } },
    });
    expect(sw.opened).toEqual(['https://vecini-comunitate.netlify.app/#/app/issues/7']);
  });

  test('clicking reuses an already-open Vecini window instead of stacking tabs', async () => {
    const sw = loadServiceWorker();
    const navigated = [];
    let didFocus = false;
    sw.setWindows([{
      url: 'https://vecini-comunitate.netlify.app/#/app',
      focus: () => { didFocus = true; return Promise.resolve(); },
      navigate: (u) => { navigated.push(u); return Promise.resolve(); },
    }]);

    await sw.fire('notificationclick', {
      notification: { close: () => {}, data: { link: '/#/app/polls/3' } },
    });

    expect(didFocus).toBe(true);
    expect(navigated).toEqual(['https://vecini-comunitate.netlify.app/#/app/polls/3']);
    expect(sw.opened).toEqual([]);
  });
});
