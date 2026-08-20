import { test, expect } from '@playwright/test';
import { signedInAs, supabaseRef, FAKE_USER_ID, FAKE_COMMUNITY_ID } from './helpers.js';

/*
  Putting things away, and the tab the issues list opens on.

  Archiving is private: one neighbour tidying their own list, not hiding an
  official announcement from the whole community. That distinction is enforced
  in the database, where it is tested against a real PostgreSQL; these cover the
  half that lives on screen.
*/

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const issue = (id, title, status) => ({
  id, community_id: FAKE_COMMUNITY_ID, reporter_id: FAKE_USER_ID,
  title, category: 'other', location: 'Scara A', description: '…',
  status, created_at: iso(1),
});

const announcement = (id, title) => ({
  id, community_id: FAKE_COMMUNITY_ID, author_id: FAKE_USER_ID,
  title, body: 'Text.', pinned: false, created_at: iso(1),
});

const discussion = (id, title) => ({
  id, community_id: FAKE_COMMUNITY_ID, author_id: FAKE_USER_ID,
  title, body: 'Text.', category: 'general', status: 'approved', created_at: iso(1),
});

/** Records what the app writes to, and answers as the service would. */
async function trackArchiveWrites(page) {
  const writes = [];
  await page.route(/\/rest\/v1\/archived_items/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    if (req.method() === 'GET' || req.method() === 'HEAD') return route.fallback();
    writes.push({ method: req.method(), url: req.url(), body: req.postData() });
    return route.fulfill({ status: 201, contentType: 'application/json', headers: CORS, body: '[]' });
  });
  return writes;
}

test.describe('Epic 17 — Archiving', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  const A1 = '33333333-0000-0000-0000-000000000001';
  const A2 = '33333333-0000-0000-0000-000000000002';

  test('an archived announcement leaves the list, and can be found again', async ({ page }) => {
    await signedInAs(page, {
      tables: {
        announcements: [announcement(A1, 'Apa oprită joi'), announcement(A2, 'Ședință marți')],
        archived_items: [{ user_id: FAKE_USER_ID, kind: 'announcement', item_id: A1 }],
      },
    });
    await page.goto('/#/app/announcements');

    await expect(page.getByText('Ședință marți')).toBeVisible();
    await expect(page.getByText('Apa oprită joi')).toHaveCount(0);

    await page.getByRole('button', { name: 'Arhivate' }).click();
    await expect(page.getByText('Apa oprită joi')).toBeVisible();
    await expect(page.getByText('Ședință marți')).toHaveCount(0);
    // and it says plainly that this is a private view
    await expect(page.getByText(/Arhiva e doar a ta/)).toBeVisible();
  });

  test('no archive chip at all until something is in there', async ({ page }) => {
    await signedInAs(page, { tables: { announcements: [announcement(A1, 'Apa oprită joi')] } });
    await page.goto('/#/app/announcements');

    await expect(page.getByText('Apa oprită joi')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Arhivate' })).toHaveCount(0);
  });

  test('archiving from the list takes it off the list at once', async ({ page }) => {
    await signedInAs(page, {
      tables: { announcements: [announcement(A1, 'Apa oprită joi'), announcement(A2, 'Ședință marți')] },
    });
    const writes = await trackArchiveWrites(page);
    await page.goto('/#/app/announcements');

    await page.getByRole('button', { name: 'Arhivează' }).first().click();

    await expect(page.getByText('Mutat în arhivă.')).toBeVisible();
    await expect(page.getByText('Apa oprită joi')).toHaveCount(0);
    await expect(page.getByText('Ședință marți')).toBeVisible();

    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe('POST');
    expect(JSON.parse(writes[0].body)).toMatchObject({ kind: 'announcement', item_id: A1, user_id: FAKE_USER_ID });
  });

  test('taking something back out is a delete, not another archive', async ({ page }) => {
    await signedInAs(page, {
      tables: {
        announcements: [announcement(A1, 'Apa oprită joi')],
        archived_items: [{ user_id: FAKE_USER_ID, kind: 'announcement', item_id: A1 }],
      },
    });
    const writes = await trackArchiveWrites(page);
    await page.goto('/#/app/announcements');
    await page.getByRole('button', { name: 'Arhivate' }).click();

    await page.getByRole('button', { name: 'Scoate din arhivă' }).click();

    await expect(page.getByText('Scos din arhivă.')).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe('DELETE');
    expect(writes[0].url).toContain(`item_id=eq.${A1}`);
  });

  test('the archive button does not open the item', async ({ page }) => {
    await signedInAs(page, { tables: { announcements: [announcement(A1, 'Apa oprită joi')] } });
    await trackArchiveWrites(page);
    await page.goto('/#/app/announcements');

    await page.getByRole('button', { name: 'Arhivează' }).click();
    await page.waitForTimeout(400);
    // Still on the list: the tap must not fall through to the card behind it.
    expect(page.url()).toMatch(/#\/app\/announcements$/);
  });

  test('discussions and issues can be archived too', async ({ page }) => {
    await signedInAs(page, {
      tables: {
        discussions: [discussion(A1, 'Parcarea din spate')],
        issues: [issue(A2, 'Bec ars la scara B', 'new')],
      },
    });
    await trackArchiveWrites(page);

    await page.goto('/#/app/discussions');
    await page.getByRole('button', { name: 'Arhivează' }).click();
    await expect(page.getByText('Parcarea din spate')).toHaveCount(0);

    await page.goto('/#/app/issues');
    await page.getByRole('button', { name: 'Arhivează' }).click();
    await expect(page.getByText('Bec ars la scara B')).toHaveCount(0);
  });

  test('an archived issue is out of every status tab, not just one', async ({ page }) => {
    await signedInAs(page, {
      tables: {
        issues: [issue(A1, 'Bec ars la scara B', 'new'), issue(A2, 'Ușa nu se închide', 'new')],
        archived_items: [{ user_id: FAKE_USER_ID, kind: 'issue', item_id: A1 }],
      },
    });
    await page.goto('/#/app/issues');

    for (const tab of ['Toate', 'Noi']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByText('Bec ars la scara B')).toHaveCount(0);
      await expect(page.getByText('Ușa nu se închide')).toBeVisible();
    }
  });
});

/*
  Which tab the issues list opens on. Someone coming here is nearly always here
  for what has just been reported — but an empty list is a worse landing than a
  slightly wrong one, so it falls through to what is actually there.
*/
test.describe('Epic 17 — Where the issues list opens', () => {
  test.skip(!supabaseRef(), 'needs .env to derive the auth storage key');

  test.beforeEach(async ({ page }) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  });

  const activePill = (page) => page.locator('.pill--active');

  test('opens on "Noi" when something is new', async ({ page }) => {
    await signedInAs(page, {
      tables: { issues: [issue(A_ID(1), 'Bec ars', 'new'), issue(A_ID(2), 'Lift stricat', 'progress')] },
    });
    await page.goto('/#/app/issues');
    await expect(activePill(page)).toHaveText('Noi');
    await expect(page.getByText('Bec ars')).toBeVisible();
    await expect(page.getByText('Lift stricat')).toHaveCount(0);
  });

  test('falls back to "În lucru" when nothing is new', async ({ page }) => {
    await signedInAs(page, {
      tables: { issues: [issue(A_ID(2), 'Lift stricat', 'progress'), issue(A_ID(3), 'Gata', 'resolved')] },
    });
    await page.goto('/#/app/issues');
    await expect(activePill(page)).toHaveText('În lucru');
    await expect(page.getByText('Lift stricat')).toBeVisible();
  });

  test('falls back to "Toate" when neither has anything', async ({ page }) => {
    await signedInAs(page, { tables: { issues: [issue(A_ID(3), 'Gata', 'resolved')] } });
    await page.goto('/#/app/issues');
    await expect(activePill(page)).toHaveText('Toate');
    await expect(page.getByText('Gata')).toBeVisible();
  });

  test('an archived new issue does not count towards opening on "Noi"', async ({ page }) => {
    await signedInAs(page, {
      tables: {
        issues: [issue(A_ID(1), 'Bec ars', 'new'), issue(A_ID(2), 'Lift stricat', 'progress')],
        archived_items: [{ user_id: FAKE_USER_ID, kind: 'issue', item_id: A_ID(1) }],
      },
    });
    await page.goto('/#/app/issues');
    await expect(activePill(page)).toHaveText('În lucru');
  });

  test('a tab chosen by hand is not overruled', async ({ page }) => {
    await signedInAs(page, {
      tables: { issues: [issue(A_ID(1), 'Bec ars', 'new'), issue(A_ID(3), 'Gata', 'resolved')] },
    });
    await page.goto('/#/app/issues');
    await expect(activePill(page)).toHaveText('Noi');

    await page.getByRole('button', { name: 'Rezolvate', exact: true }).click();
    await expect(activePill(page)).toHaveText('Rezolvate');
    await expect(page.getByText('Gata')).toBeVisible();
  });
});

function A_ID(n) {
  return `44444444-0000-0000-0000-00000000000${n}`;
}
