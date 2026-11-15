import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser, FAKE_COMMUNITY_ID } from './helpers.js';

/*
  The front door, as the screens see it.

  Since migration 0020 a membership is written by join_community, which takes
  the code, and — where the community asks for approval — answers "pending"
  instead of letting anybody in. The database half of this is tested in
  tests-db (INT-14 to INT-19). What is tested here is that the app asks the
  right function with the right thing, and that "pending" is a screen that
  says what is happening rather than a door that silently stays shut.
*/

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

async function asNewcomer(page, answer) {
  const me = fakeUser();
  // Signed in, belonging nowhere yet: that is who arrives with a code.
  await signedInAs(page, { user: me, tables: { memberships: [], communities: [] } });
  const calls = [];
  await page.route(/\/rest\/v1\/rpc\/(join_community|community_by_code)/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const name = new URL(req.url()).pathname.split('/rpc/')[1];
    calls.push({ name, body: JSON.parse(req.postData() || '{}') });
    const rows = name === 'community_by_code'
      ? [{ id: FAKE_COMMUNITY_ID, name: 'Aleea Teilor 15-20' }]
      : [answer()];
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(rows) });
  });
  return { me, calls };
}

test.describe('Intrarea cu aprobare', () => {
  test('joining asks the database with the code, never with the community id', async ({ page }) => {
    const { calls } = await asNewcomer(page, () => ({ community_id: FAKE_COMMUNITY_ID, name: 'Aleea Teilor 15-20', status: 'pending' }));
    await page.goto('/#/join/TEILOR-15');

    await expect.poll(() => calls.filter((c) => c.name === 'join_community').length).toBeGreaterThan(0);
    const join = calls.find((c) => c.name === 'join_community');
    expect(join.body).toEqual({ p_code: 'TEILOR-15' });
  });

  test('a community that asks for approval says so, and lets nobody in yet', async ({ page }) => {
    await asNewcomer(page, () => ({ community_id: FAKE_COMMUNITY_ID, name: 'Aleea Teilor 15-20', status: 'pending' }));
    await page.goto('/#/join/TEILOR-15');

    await expect(page.getByText('Cererea ta a fost trimisă')).toBeVisible();
    await expect(page.getByText('Aleea Teilor 15-20')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verifică din nou' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retrage cererea' })).toBeVisible();
    // Not inside: no bottom navigation, still on the join screen.
    expect(page.url()).toContain('#/join');
    await expect(page.locator('.bottom-nav')).toHaveCount(0);
  });

  test('checking again before anyone has decided says plainly that nothing changed', async ({ page }) => {
    await asNewcomer(page, () => ({ community_id: FAKE_COMMUNITY_ID, name: 'Aleea Teilor 15-20', status: 'pending' }));
    await page.goto('/#/join/TEILOR-15');
    await page.getByRole('button', { name: 'Verifică din nou' }).click();
    await expect(page.getByText('Încă nu ai fost aprobat.')).toBeVisible();
  });

  test('once approved, the same check walks straight in', async ({ page }) => {
    let approved = false;
    await asNewcomer(page, () => ({ community_id: FAKE_COMMUNITY_ID, name: 'Aleea Teilor 15-20', status: approved ? 'member' : 'pending' }));
    await page.goto('/#/join/TEILOR-15');
    await expect(page.getByText('Cererea ta a fost trimisă')).toBeVisible();

    approved = true;
    await page.getByRole('button', { name: 'Verifică din nou' }).click();
    await page.waitForURL(/#\/app/);
  });

  test('a bad code is still a bad code, not a request', async ({ page }) => {
    await signedInAs(page, { user: fakeUser(), tables: { memberships: [], communities: [] } });
    await page.route(/\/rest\/v1\/rpc\/join_community/, (route) => route.fulfill({
      status: 404, contentType: 'application/json', headers: CORS,
      body: JSON.stringify({ code: 'P0002', message: 'bad_code' }),
    }));
    await page.route(/\/rest\/v1\/rpc\/community_by_code/, (route) => route.fulfill({
      status: 200, contentType: 'application/json', headers: CORS, body: '[]',
    }));
    await page.goto('/#/join/NU-EXISTA');
    await expect(page.getByText('Cererea ta a fost trimisă')).toHaveCount(0);
  });
});

test.describe('Cererile de intrare, la administrator', () => {
  async function asAdminWithRequest(page) {
    const me = fakeUser();
    const waiting = '33333333-3333-4333-8333-333333333333';
    await signedInAs(page, {
      user: me,
      tables: {
        memberships: [{ id: 'm1', user_id: me.id, community_id: FAKE_COMMUNITY_ID, role: 'admin', joined_at: '2026-01-01T00:00:00Z' }],
        communities: [{ id: FAKE_COMMUNITY_ID, name: 'Aleea Teilor 15-20', kind: 'bloc', code: 'TEILOR-15', join_mode: 'approval' }],
        join_requests: [{ community_id: FAKE_COMMUNITY_ID, user_id: waiting, created_at: '2026-11-10T09:00:00Z' }],
        profiles: [
          { id: me.id, full_name: me.user_metadata.full_name, apartment: '', avatar_color: '#2f6b4f' },
          { id: waiting, full_name: 'Radu Neagu', apartment: '', avatar_color: '#b4532a' },
        ],
      },
    });
    const decided = [];
    await page.route(/\/rest\/v1\/rpc\/decide_join_request/, (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
      decided.push(JSON.parse(req.postData() || '{}'));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: 'null' });
    });
    return { me, waiting, decided };
  }

  test('somebody waiting is listed first, by name, with both answers offered', async ({ page }) => {
    await asAdminWithRequest(page);
    await page.goto('/#/app/admin/members');
    await expect(page.getByText('Cereri de intrare')).toBeVisible();
    await expect(page.getByText('Radu Neagu')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprobă' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Respinge' })).toBeVisible();
  });

  test('approving sends that person, for this community', async ({ page }) => {
    const { waiting, decided } = await asAdminWithRequest(page);
    await page.goto('/#/app/admin/members');
    await page.getByRole('button', { name: 'Aprobă' }).click();
    await expect.poll(() => decided.length).toBe(1);
    expect(decided[0]).toEqual({ p_community: FAKE_COMMUNITY_ID, p_user: waiting, p_approve: true });
  });

  test('the admin panel says there is somebody waiting before anyone opens the list', async ({ page }) => {
    await asAdminWithRequest(page);
    await page.goto('/#/app/admin');
    await expect(page.getByText(/Cereri de intrare: 1/)).toBeVisible();
  });
});

test.describe('Rezultatele sondajelor', () => {
  test('the counts come from the results function, not from adding up rows', async ({ page }) => {
    /*
      Since the ballot became secret, the rows of poll_votes come back holding
      the caller's own vote only. A screen that still counted them would show
      every poll as one vote to nothing — the caller's.
    */
    const me = fakeUser();
    await signedInAs(page, {
      user: me,
      tables: {
        polls: [{ id: 'p1', community_id: FAKE_COMMUNITY_ID, author_id: me.id, question: 'Schimbăm poarta?', multi: false, closed: false, ends_at: '2099-01-01T00:00:00Z', created_at: '2026-11-01T00:00:00Z' }],
        poll_options: [{ id: 'o1', poll_id: 'p1', label: 'Da' }, { id: 'o2', poll_id: 'p1', label: 'Nu' }],
        poll_votes: [{ poll_id: 'p1', option_id: 'o1', user_id: me.id }],
        'rpc/poll_results': [{ poll_id: 'p1', option_id: 'o1', votes: 7 }, { poll_id: 'p1', option_id: 'o2', votes: 3 }],
      },
    });
    await page.goto('/#/app/polls/p1');
    await expect(page.getByText('70%')).toBeVisible();
    await expect(page.getByText('30%')).toBeVisible();
  });
});
