import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  One account in two associations.

  Iana is in two places: a block on Aleea Teilor, where she is a member at
  ap. 12, and a street of houses on Strada Popești, where she is the
  administrator at no. 7. Every fixture below is fictitious.

  The database side — that a neighbour in one never learns the flat in the
  other, that set_my_apartment writes only your own row — is tested in
  tests-db (TEL-10 to TEL-12). What is tested here is that the app shows
  both, moves between them, and that a notification lands in the right one.
*/

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
const A = 'c1a00000-0000-0000-0000-000000000001';
const B = 'c2b00000-0000-0000-0000-000000000002';

const communities = [
  { id: A, name: 'Aleea Teilor 15-20', code: 'TEILOR-15', kind: 'bloc', address: '', description: '', join_mode: 'invite' },
  { id: B, name: 'Strada Popești 8', code: 'POPESTI-8', kind: 'houses', address: '', description: '', join_mode: 'invite' },
];
const NEIGHBOUR = 'a0000000-0000-0000-0000-00000000000d';

async function asTwoPlaces(page, { notifications = [], extra = {}, onlyA = false } = {}) {
  const me = fakeUser();
  const memberships = [
    { id: 'm1', user_id: me.id, community_id: A, role: 'member', apartment: 'Ap. 12', joined_at: '2025-01-01T00:00:00Z' },
    { id: 'm3', user_id: NEIGHBOUR, community_id: A, role: 'member', apartment: 'Ap. 3', joined_at: '2025-02-01T00:00:00Z' },
    ...(onlyA ? [] : [{ id: 'm2', user_id: me.id, community_id: B, role: 'admin', apartment: 'Casa 7', joined_at: '2026-01-01T00:00:00Z' }]),
  ];
  await signedInAs(page, {
    user: me,
    tables: {
      communities: onlyA ? [communities[0]] : communities,
      memberships,
      profiles: [
        { id: me.id, full_name: 'Iana Test', avatar_color: '#2f6b4f', deleted_at: null },
        { id: NEIGHBOUR, full_name: 'Dan Vecinul', avatar_color: '#8c3c52', deleted_at: null },
      ],
      notifications,
      ...extra,
    },
  });
  return me;
}

const note = (me, community, over = {}) => ({
  id: 'n-' + community.slice(0, 4) + (over.id || ''), user_id: me, community_id: community, type: 'announcement',
  title: 'Anunț nou', body: 'Ceva', link: '/app/announcements', read: false, created_at: new Date().toISOString(), ...over,
});

test.describe('Un cont în mai multe asociații', () => {
  test('settings lists every community, with your role and your flat in each', async ({ page }) => {
    await asTwoPlaces(page);
    await page.goto('/#/app/settings');
    await page.getByRole('button', { name: /Comunitățile tale/ }).click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/settings/communities');

    const rowA = page.locator(`[data-community="${A}"]`);
    const rowB = page.locator(`[data-community="${B}"]`);
    await expect(rowA).toContainText('Aleea Teilor 15-20');
    await expect(rowA).toContainText('Ap. 12');
    await expect(rowA).toContainText('Deschisă acum');
    await expect(rowB).toContainText('Strada Popești 8');
    await expect(rowB).toContainText('Admin');
    await expect(rowB).toContainText('Casa 7');
    // And the way in to a third.
    await expect(page.getByRole('button', { name: 'Intră în altă comunitate, cu un cod' })).toBeVisible();
  });

  test('tapping the other community moves you there, and it stays chosen', async ({ page }) => {
    await asTwoPlaces(page);
    await page.goto('/#/app/settings/communities');
    await page.locator(`[data-community="${B}"]`).click();

    await expect.poll(() => new URL(page.url()).hash).toBe('#/app');
    await expect(page.getByText('Acum ești în Strada Popești 8.')).toBeVisible();
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');

    // Opening the app again opens the same one.
    await page.reload();
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');
  });

  test('with only one community, the name on the home screen is just a name', async ({ page }) => {
    await asTwoPlaces(page, { onlyA: true });
    await page.goto('/#/app');
    await expect(page.getByText('Aleea Teilor 15-20').first()).toBeVisible();
    await expect(page.getByTestId('switch-community')).toHaveCount(0);
  });

  test('new notifications in the other community are pointed out, not hidden', async ({ page }) => {
    const me = fakeUser();
    await asTwoPlaces(page, { notifications: [note(me.id, B), note(me.id, B, { id: '2' })] });
    await page.goto('/#/app');

    const notice = page.locator(`[data-elsewhere="${B}"]`);
    await expect(notice).toContainText('Ai notificări noi și în Strada Popești 8');
    await expect(notice).toContainText('2');

    await page.goto('/#/app/settings');
    await expect(page.getByRole('button', { name: /Comunitățile tale/ })).toContainText('2');

    // Following it lands on that community's notifications.
    await page.goto('/#/app');
    await notice.click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/notifications');
    await expect(page.getByText('Anunț nou').first()).toBeVisible();
    await page.goto('/#/app');
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');
  });

  test('a notification link from the other community opens it there, not as "not found"', async ({ page }) => {
    await asTwoPlaces(page, {
      extra: {
        announcements: [{
          id: 'b-ann', community_id: B, author_id: NEIGHBOUR, title: 'Gunoiul se ridică marți',
          body: 'De săptămâna viitoare.', pinned_until: null, starts_at: null, ends_at: null,
          all_day: false, location: '', created_at: new Date().toISOString(),
        }],
      },
    });
    // Looking at A, as the app was left.
    await page.goto('/#/app');
    await expect(page.getByTestId('switch-community')).toContainText('Aleea Teilor 15-20');

    await page.goto(`/#/app/announcements/b-ann?c=${B}`);
    await expect(page.getByText('Gunoiul se ridică marți')).toBeVisible();
    // The marker is dropped once it has done its job.
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements/b-ann');
    await page.goto('/#/app');
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');
  });

  test('a link naming a community you are not in is ignored', async ({ page }) => {
    await asTwoPlaces(page, { onlyA: true });
    await page.goto(`/#/app/announcements?c=${B}`);
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements');
    await page.goto('/#/app');
    await expect(page.getByText('Aleea Teilor 15-20').first()).toBeVisible();
  });

  test('notifications you send carry the community they are about', async ({ page }) => {
    await asTwoPlaces(page);
    await page.goto('/#/app/settings/communities');
    await page.locator(`[data-community="${B}"]`).click();
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');

    const sent = [];
    await page.route(/\/rest\/v1\/announcements/, (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fallback();
      const row = { ...JSON.parse(req.postData() || '{}'), id: 'new-ann', created_at: new Date().toISOString() };
      const wantsOne = (req.headers().accept || '').includes('pgrst.object');
      return route.fulfill({ status: 201, contentType: 'application/json', headers: CORS, body: JSON.stringify(wantsOne ? row : [row]) });
    });
    await page.route(/\/rest\/v1\/rpc\/notify_members/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      sent.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '[]' });
    });

    await page.goto('/#/app/announcements/new');
    await page.locator('#ann-title').fill('Apa se oprește joi');
    await page.locator('#ann-body').fill('Între 9 și 12.');
    await page.getByRole('button', { name: 'Publică anunțul' }).click();

    await expect.poll(() => sent.length).toBeGreaterThan(0);
    expect(sent[0].cid).toBe(B);
    expect(sent[0].nlink).toContain(`c=${B}`);
  });

  test('your flat is the one you have in the community on screen', async ({ page }) => {
    await asTwoPlaces(page);
    await page.goto('/#/app/settings/account');
    await expect(page.locator('#acc-apartment')).toHaveValue('Ap. 12');
    await expect(page.getByTestId('apartment-only-here')).toContainText('Aleea Teilor 15-20');

    await page.goto('/#/app/settings/communities');
    await page.locator(`[data-community="${B}"]`).click();
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');
    await page.goto('/#/app/settings/account');
    await expect(page.locator('#acc-apartment')).toHaveValue('Casa 7');
  });

  test('saving the flat writes it for the community on screen only', async ({ page }) => {
    await asTwoPlaces(page);
    const calls = [];
    await page.route(/\/rest\/v1\/rpc\/set_my_apartment/, (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      calls.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    });
    await page.goto('/#/app/settings/account');
    await page.locator('#acc-apartment').fill('Ap. 14');
    await page.getByRole('button', { name: 'Salvează' }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0]).toEqual({ p_community: A, p_apartment: 'Ap. 14' });
  });

  test('a neighbour sees the flat from this community', async ({ page }) => {
    await asTwoPlaces(page);
    await page.goto('/#/app/neighbours');
    await expect(page.locator('.card', { hasText: 'Dan Vecinul' })).toContainText('Ap. 3');
    await expect(page.locator('.card', { hasText: 'Iana Test' })).toContainText('Ap. 12');
    await expect(page.getByText('Casa 7')).toHaveCount(0);
  });

  test('leaving one community takes you to the other', async ({ page }) => {
    await asTwoPlaces(page);
    const deleted = [];
    await page.route(/\/rest\/v1\/memberships/, (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      deleted.push(new URL(route.request().url()).searchParams.toString());
      return route.fulfill({ status: 204, headers: CORS, body: '' });
    });
    await page.goto('/#/app/settings/communities');
    await page.getByRole('button', { name: 'Ieși din Aleea Teilor 15-20' }).click();
    await expect(page.getByText('Te poți întoarce doar cu un cod de invitație')).toBeVisible();
    await page.getByRole('button', { name: 'Da, ies' }).click();

    await expect.poll(() => deleted.length).toBe(1);
    expect(deleted[0]).toContain(`community_id=eq.${A}`);
    await expect(page.getByText('Ai ieșit din Aleea Teilor 15-20.')).toBeVisible();
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');
  });

  test('the last administrator is told to hand over first, and stays', async ({ page }) => {
    await asTwoPlaces(page);
    await page.route(/\/rest\/v1\/memberships/, (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      return route.fulfill({ status: 400, contentType: 'application/json', headers: CORS,
        body: JSON.stringify({ code: '23514', message: 'last_admin', details: null, hint: null }) });
    });
    await page.goto('/#/app/settings/communities');
    await page.locator(`[data-community="${B}"]`).click();
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');
    await page.goto('/#/app/settings/communities');
    await page.getByRole('button', { name: 'Ieși din Strada Popești 8' }).click();
    await page.getByRole('button', { name: 'Da, ies' }).click();

    await expect(page.getByText('Ești singurul administrator de acolo.')).toBeVisible();
    await page.goto('/#/app');
    await expect(page.getByTestId('switch-community')).toContainText('Strada Popești 8');
  });
});
