import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';
import { PRIVACY } from '../src/i18n/privacy.js';
import { CONTACT_EMAIL } from '../src/lib/legal.js';

/*
  Politica de confidențialitate.

  Three things are worth guarding. That it can be read by somebody with no
  account, from the places they would look for it. That the three languages
  say the same things — a policy that promises less in Hungarian is a worse
  policy, not a shorter one. And that the one claim it makes about the page
  itself holds: no font, and therefore no visitor's address, fetched from
  Google.
*/

test.describe('Politica de confidențialitate', () => {
  test('readable without an account, from the first screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Politica de confidențialitate' }).click();
    await expect(page.getByRole('heading', { name: 'Politica de confidențialitate', level: 1 })).toBeVisible();
    // The facts somebody reads it for: who, where the data lives, how to ask.
    await expect(page.getByText(/Stockholm, Suedia/)).toBeVisible();
    await expect(page.getByRole('link', { name: CONTACT_EMAIL }).first()).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    await expect(page.getByText(/dataprotection\.ro/)).toBeVisible();
    // No placeholder left in what a person reads.
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).not.toMatch(/\{(email|operator)\}/);
  });

  test('offered on the sign-up form, before anything is handed over', async ({ page }) => {
    await page.goto('/#/signup');
    const link = page.getByRole('link', { name: 'Politica de confidențialitate' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole('heading', { name: 'Politica de confidențialitate', level: 1 })).toBeVisible();
    // Back returns to the form, not to the start.
    await page.getByRole('button', { name: '←' }).click();
    await page.waitForURL(/#\/signup/);
  });

  test('and in Settings, once signed in', async ({ page }) => {
    await signedInAs(page, { user: fakeUser() });
    await page.goto('/#/app/settings');
    await page.getByRole('button', { name: /Politica de confidențialitate/ }).click();
    await page.waitForURL(/#\/privacy/);
    await expect(page.getByRole('heading', { name: 'Politica de confidențialitate', level: 1 })).toBeVisible();
  });

  test('follows the chosen language', async ({ page }) => {
    await page.goto('/#/privacy');
    await page.getByRole('button', { name: /Switch to English/ }).click();
    await expect(page.getByRole('heading', { name: 'Privacy policy', level: 1 })).toBeVisible();
    await expect(page.getByText(/Stockholm, Sweden/)).toBeVisible();
  });

  test('the three languages say the same number of things', () => {
    const shape = (doc) => doc.sections.map((s) => [(s.p || []).length, (s.list || []).length, (s.after || []).length]);
    expect(shape(PRIVACY.en)).toEqual(shape(PRIVACY.ro));
    expect(shape(PRIVACY.hu)).toEqual(shape(PRIVACY.ro));
    // And each mentions the contact address wherever Romanian does.
    const emails = (doc) => JSON.stringify(doc).split('{email}').length;
    expect(emails(PRIVACY.en)).toBe(emails(PRIVACY.ro));
    expect(emails(PRIVACY.hu)).toBe(emails(PRIVACY.ro));
  });

  test('no font is fetched from Google — the policy says so', async ({ page }) => {
    const toGoogle = [];
    page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) toGoogle.push(r.url()); });
    await page.goto('/#/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(toGoogle).toEqual([]);
    // And the typefaces still arrive, from our own origin.
    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
    });
    expect(families.join(' ')).toMatch(/Newsreader/);
    expect(families.join(' ')).toMatch(/Hanken Grotesk/);
  });
});
