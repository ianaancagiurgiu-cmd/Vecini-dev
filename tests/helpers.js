// Shared helpers + a test fixture for the Vecini flow tests.
import { test as base, expect } from '@playwright/test';

export const DATA_KEY = 'vecini.data.v1';
export const PREF_KEY = 'vecini.prefs.v1';

// Extend the base test so every page blocks external Google Fonts requests.
// In the sandbox those requests hang (no egress), which would make each page
// load take ~14s. The real deployed app loads them normally.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await use(page);
  },
});
export { expect };

// Load the app once and wipe any stored state so every test starts from the
// pristine demo seed (Aleea Castanilor 12).
export async function fresh(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

// Jump straight into the app as a given role. Each test gets an isolated
// browser context, so localStorage starts empty and the app builds a fresh
// demo seed automatically. We set the auth/role prefs via an init script so
// they are present BEFORE the app mounts (and re-applied on reload, without
// wiping any data created during the test).
export async function enterApp(page, { role = 'admin', lang = 'ro' } = {}) {
  await page.addInitScript(({ role, lang, PREF_KEY }) => {
    localStorage.setItem(PREF_KEY, JSON.stringify({ lang, roleOverride: role, authed: true }));
  }, { role, lang, PREF_KEY });
  await page.goto('/#/app');
  await page.waitForSelector('.bottom-nav');
}

// Real login through the UI.
export async function loginViaUI(page, { email = 'ana@exemplu.ro', password = 'parola123' } = {}) {
  await page.goto('/#/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Intră în cont', exact: true }).click();
}

// Navigate the bottom tab bar.
export async function tab(page, label) {
  await page.locator('.bottom-nav a', { hasText: label }).click();
}
