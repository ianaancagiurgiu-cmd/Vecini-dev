/*
  Captures the screens the video is built from.

  Real components, real styling, real fonts — only the rows behind them are
  invented. Each screen is taken at three times the pixel density so it stays
  sharp when it is placed inside the phone in the composition.
*/
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { serveCommunity } from './harness.mjs';

const OUT = 'demo/screens';
const BASE = process.env.DEMO_BASE || 'http://localhost:4173';
mkdirSync(OUT, { recursive: true });

const shots = [];
async function shot(page, name, { settle = 700, full = false } = {}) {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  shots.push(name);
  console.log('  ✓', name);
  if (full) {
    // The whole scrollable page, so the composition can pan down it rather
    // than cutting between two stills.
    await page.evaluate(() => {
      const s = document.querySelector('.phone__scroll');
      const inner = s.firstElementChild;
      document.documentElement.style.setProperty('--app-h', (inner.scrollHeight + 60) + 'px');
    });
    await page.setViewportSize({ width: 390, height: Math.min(2400, await page.evaluate(() =>
      document.querySelector('.phone__scroll').firstElementChild.scrollHeight + 60)) });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${name}-full.png` });
    shots.push(name + '-full');
    console.log('  ✓', name + '-full');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
  }
}

const browser = await chromium.launch();
const phone = { ...devices['iPhone 13'], deviceScaleFactor: 3, isMobile: true, hasTouch: true };

/* ---------- signed out: the door ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await serveCommunity(page, { signedIn: false });
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
  await shot(page, '01-landing', { settle: 1200 });

  await page.evaluate(() => document.querySelector('.phone__scroll').scrollTo({ top: 520, behavior: 'instant' }));
  await shot(page, '02-landing-features');

  /*
    The code typed in by hand rather than the link opened.

    An invitation link checks its code the moment it loads and jumps straight
    to the community, which is the right thing for a real visitor but skips the
    screen the video is about. Typed in, both halves are there to film.
  */
  await page.goto(`${BASE}/#/join`, { waitUntil: 'networkidle' });
  await page.locator('input.input').fill('ALEEATEI-70');
  await shot(page, '03-join-code', { settle: 900 });

  await page.getByRole('button', { name: 'Verifică codul' }).click();
  await page.getByText('Aleea Teilor').waitFor({ timeout: 10000 });
  await shot(page, '04-join-found', { settle: 1200 });
  await ctx.close();
}

/* ---------- signed in: the app ---------- */
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await serveCommunity(page);

  await page.goto(`${BASE}/#/app`, { waitUntil: 'networkidle' });
  await shot(page, '05-dashboard', { settle: 1600, full: true });

  // The app's own install sheet, which is what a first-time visitor really sees.
  await page.waitForSelector('[role=dialog]', { timeout: 12000 });
  await shot(page, '06-install-sheet', { settle: 900 });
  await page.getByRole('button', { name: 'Am înțeles' }).click();
  await page.waitForTimeout(2200);

  // The notification sheet that follows it.
  const push = await page.locator('[role=dialog]').count();
  if (push) { await shot(page, '07-push-sheet', { settle: 400 }); await page.keyboard.press('Escape').catch(() => {}); }

  /*
    The list opens on "noi", which is right for somebody arriving at it and
    wrong for the video: the point being made is that every report carries its
    own status, and that only shows on "toate".
  */
  await page.goto(`${BASE}/#/app/issues`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Toate', exact: true }).click();
  await shot(page, '08-issues-list', { settle: 1400, full: true });

  await page.goto(`${BASE}/#/app/issues/i4`, { waitUntil: 'networkidle' });
  await shot(page, '09-issue-detail', { settle: 1400, full: true });
  await page.evaluate(() => document.querySelector('.phone__scroll').scrollTo({ top: 620, behavior: 'instant' }));
  await shot(page, '10-issue-history');

  await page.goto(`${BASE}/#/app/issues/new`, { waitUntil: 'networkidle' });
  await shot(page, '11-report-empty', { settle: 1000 });

  await page.locator('.input').first().fill('Ușa de la garaj rămâne deschisă');
  await page.getByRole('button', { name: /Altele/ }).first().click().catch(() => {});
  const loc = page.locator('input.input').nth(1);
  await loc.fill('Rampa de la subsol').catch(() => {});
  await page.locator('textarea.input').fill('Nu se mai închide singură de aseară.');
  await page.setInputFiles('input[type=file]', 'demo/upload.png').catch((e) => console.log('  (photo skipped)', e.message));
  await shot(page, '12-report-filled', { settle: 1400 });

  await page.goto(`${BASE}/#/app/neighbours`, { waitUntil: 'networkidle' });
  await shot(page, '13-neighbours', { settle: 1400, full: true });

  await page.goto(`${BASE}/#/app/announcements`, { waitUntil: 'networkidle' });
  await shot(page, '14-announcements', { settle: 1400, full: true });

  await page.goto(`${BASE}/#/app/announcements/a1`, { waitUntil: 'networkidle' });
  await shot(page, '16-announcement-detail', { settle: 1400 });

  await page.goto(`${BASE}/#/app/polls`, { waitUntil: 'networkidle' });
  await shot(page, '15-polls', { settle: 1400, full: true });

  // The vote itself, with the count already behind it — the point being that
  // the community decides in the open rather than in an argument.
  await page.goto(`${BASE}/#/app/polls/p1`, { waitUntil: 'networkidle' });
  await shot(page, '17-poll-detail', { settle: 1400 });

  // And the same screen once the vote is in, which is where the counts appear.
  await page.goto(`${BASE}/#/app/polls/p2`, { waitUntil: 'networkidle' });
  await shot(page, '18-poll-voted', { settle: 1400 });
  await ctx.close();
}

await browser.close();
console.log(`\n${shots.length} screens in ${OUT}`);
