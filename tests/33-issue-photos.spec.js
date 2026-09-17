import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  Pozele de la sesizări, prin un link care expiră.

  issue-photos used to be a public bucket: whatever URL got stored on the
  issue worked for anyone, forever, no membership check consulted. Now the
  path is all that is stored, and the screen has to ask for a signed link
  before it can show anything — same shape as documents, and worth the same
  guard: the screen looks identical either way, so a regression back to a
  public URL would pass every other test in the suite.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

// A 1×1 PNG, for the <img> tag's own fetch of whatever the signed link
// resolves to — a separate request from asking for the link in the first
// place, and the one this file is not trying to assert anything about.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function withIssue(page, { photoPath = 'c1/mihai-1.jpg' } = {}) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm0', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
      issues: [{
        id: 'i1', community_id: 'c1', reporter_id: me.id, title: 'Liftul se oprește',
        description: 'Între etajul 3 și 4.', category: 'other', status: 'new', location: 'Scara A',
        photo_path: photoPath, created_at: new Date(Date.now() - 86400000).toISOString(),
      }],
    },
  });

  const signed = [];
  await page.route(/\/storage\/v1\/object\/sign\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (req.method() === 'POST') {
      signed.push({ url: req.url(), body: JSON.parse(req.postData() || '{}') });
      return route.fulfill({
        status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ signedURL: `/storage/v1/object/sign/issue-photos/${photoPath}?token=stub` }),
      });
    }
    // The <img> itself, following the link it was handed — a different
    // request from asking for the link, and not what this file is testing.
    return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TINY_PNG });
  });

  return { me, signed };
}

test.describe('Pozele de la sesizări', () => {
  test('a photo is shown by asking for a link that expires', async ({ page }) => {
    const { signed } = await withIssue(page);
    await page.goto('/#/app/issues/i1');

    await expect.poll(() => signed.length).toBe(1);
    expect(signed[0].url).toContain('/storage/v1/object/sign/issue-photos/c1/mihai-1.jpg');
    expect(signed[0].body).toMatchObject({ expiresIn: 3600 });

    // And the image the screen ends up showing is the signed link, not the
    // stored path or some public address built from it.
    await expect(page.locator('img[src*="/storage/v1/object/sign/issue-photos/"]')).toBeVisible();
  });

  test('an issue with no photo asks for nothing', async ({ page }) => {
    const { signed } = await withIssue(page, { photoPath: null });
    await page.goto('/#/app/issues/i1');
    await expect(page.getByRole('heading', { name: 'Liftul se oprește' })).toBeVisible();
    expect(signed.length).toBe(0);
    await expect(page.locator('img')).toHaveCount(0);
  });
});
