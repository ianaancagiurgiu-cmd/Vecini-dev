import { test, expect } from '@playwright/test';
import { fakeUser } from './helpers.js';

/*
  Links we send by email, arriving back at the app.

  The bug these exist for: the auth service returns its credentials in the URL
  fragment, like

    https://vecini.example/#access_token=...&type=email_change

  and this app routes on the fragment. HashRouter matched nothing, rewrote it to
  #/ during its first synchronous render, and the Supabase client — whose
  start-up is asynchronous — arrived to find an empty URL. Every emailed link
  landed in an app that had thrown away its own credentials a moment earlier.
  Confirming a new address looked like a button that did nothing.

  These drive the real redirect the auth service produces.
*/

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

const json = (route, body, status = 200) => route.fulfill({
  status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body),
});

/**
 * Stands in for the auth service on the far side of the redirect. The client
 * exchanges the access token in the fragment for a user, which is the one call
 * that decides whether the session takes.
 */
async function stubAuthService(page, user) {
  await page.route(/\/auth\/v1\/user/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    return json(route, user);
  });
  await page.route(/\/auth\/v1\/(logout|token)/, (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    return json(route, {});
  });
  // Everything the app reads once it believes it is signed in.
  await page.route(/\/rest\/v1\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const wantsOne = (req.headers()['accept'] || '').includes('pgrst.object');
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { ...CORS, 'content-range': '0-0/0' },
      body: JSON.stringify(wantsOne ? null : []),
    });
  });
}

/** The fragment GoTrue actually redirects with, in the implicit flow. */
const callbackHash = (type) => '/#' + new URLSearchParams({
  access_token: 'stub-access-token',
  expires_at: String(Math.floor(Date.now() / 1000) + 3600),
  expires_in: '3600',
  refresh_token: 'stub-refresh-token',
  token_type: 'bearer',
  type,
}).toString();

test.describe('Epic 16 — Links from our emails', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  test('a confirmed address change signs the person in and says so', async ({ page }) => {
    await stubAuthService(page, fakeUser({ email: 'nou@exemplu.ro' }));
    await page.goto(callbackHash('email_change'));

    await expect(page.getByText('Adresa de email a fost schimbată.')).toBeVisible({ timeout: 10000 });
    // The credentials survived: the app is signed in, not back at the landing page.
    await expect(page.getByRole('button', { name: 'Începe acum' })).toHaveCount(0);
  });

  test('a reset link opens "choose a new password", not the dashboard', async ({ page }) => {
    await stubAuthService(page, fakeUser());
    await page.goto(callbackHash('recovery'));

    await expect(page.getByRole('heading', { name: 'Alege o parolă nouă' })).toBeVisible({ timeout: 10000 });
  });

  test('a signup confirmation lands signed in rather than back at the door', async ({ page }) => {
    await stubAuthService(page, fakeUser());
    await page.goto(callbackHash('signup'));

    await page.waitForTimeout(1500);
    await expect(page.getByRole('button', { name: 'Începe acum' })).toHaveCount(0);
  });

  test('a spent or expired link says so instead of failing silently', async ({ page }) => {
    await stubAuthService(page, fakeUser());
    await page.goto('/#' + new URLSearchParams({
      error: 'access_denied',
      error_code: 'otp_expired',
      error_description: 'Email link is invalid or has expired',
    }).toString());

    await expect(page.getByText(/Linkul nu mai e valid/)).toBeVisible({ timeout: 10000 });
  });

  test('an ordinary visit is unaffected and still renders at once', async ({ page }) => {
    const started = Date.now();
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Începe acum' })).toBeVisible();
    // No waiting on the auth service when there is no link to process.
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
