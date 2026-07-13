import { test, expect, enterApp, tab } from './helpers.js';

test.describe('Epic 6 — Polls & Voting', () => {
  test('US-17 active and closed polls are listed separately', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Voturi');
    await expect(page.getByText('Voturi deschise')).toBeVisible();
    await expect(page.getByText('Schimbăm firma de curățenie?')).toBeVisible();
    await expect(page.getByText('Voturi închise')).toBeVisible();
  });

  test('US-18 vote on a poll then see percentage results, no double vote', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Voturi');
    await page.getByText('Schimbăm firma de curățenie?').click();
    await page.getByText('Da, cea actuală nu e ok').click();
    await page.getByRole('button', { name: 'Trimite votul' }).click();
    await expect(page.getByText('%').first()).toBeVisible();
    // after voting the submit button is gone (can't vote twice)
    await expect(page.getByRole('button', { name: 'Trimite votul' })).toHaveCount(0);
  });

  test('US-20 closed poll shows results with a winner', async ({ page }) => {
    await enterApp(page, { role: 'member' });
    await tab(page, 'Voturi');
    await page.getByText('Aprobăm reparația liftului de pe scara B?').click();
    await expect(page.getByText(/Opțiune câștigătoare/)).toBeVisible();
  });

  test('US-19 admin creates a poll with options and end date', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await tab(page, 'Voturi');
    await page.getByRole('button', { name: /Sondaj nou/ }).click();
    await page.getByPlaceholder(/Schimbăm firma/).fill('Punem o poartă nouă?');
    const opts = page.getByPlaceholder(/Opțiunea/);
    await opts.nth(0).fill('Da');
    await opts.nth(1).fill('Nu');
    await page.getByRole('button', { name: 'Lansează votul' }).click();
    await expect(page.getByText('Punem o poartă nouă?')).toBeVisible();
  });

  test('US-19 poll needs at least two options', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/polls/new');
    await page.getByPlaceholder(/Schimbăm firma/).fill('Doar o opțiune?');
    await page.getByPlaceholder(/Opțiunea/).nth(0).fill('Singura');
    await expect(page.getByRole('button', { name: 'Lansează votul' })).toBeDisabled();
  });

  test('US-19 admin can close a poll early', async ({ page }) => {
    await enterApp(page, { role: 'admin' });
    await page.goto('/#/app/polls/p1');
    await page.getByRole('button', { name: 'Închide votul acum' }).click();
    await expect(page.getByText('Închis').first()).toBeVisible();
  });
});
