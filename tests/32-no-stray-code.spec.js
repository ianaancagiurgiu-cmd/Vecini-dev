import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  No source code on screen.

  This exists because of a bug that reached production. A comment inside JSX
  has to be wrapped in braces — {/* like this *​/} — and one that is not is
  not a comment at all: JSX takes it for text and renders it. Eleven lines of
  English explaining why the funds section stays visible for staff appeared on
  the dashboard, in the middle of the app, in Romanian company.

  Every test in the suite passed. Of course they did: they assert that certain
  words are present, and a paragraph of stray prose adds words rather than
  removing any. Nothing in a suite of two hundred assertions was looking for
  text that should not be there — which is the shape of failure a screenshot
  catches and a test never does, until the test is this one.

  So: walk the screens and refuse comment markers in what a person can read.
  Cheap, and it covers screens no other test visits.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

const day = 86400000;
const iso = (ts) => new Date(ts).toISOString().slice(0, 10);

/*
  An administrator, because staff see strictly more of every screen: the
  register on a collection, the actions on an announcement, the upload button
  on the documents. A member's view is a subset, so this is the wider net.
*/
async function asAdmin(page) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm0', user_id: me.id, community_id: 'c1', role: 'admin', joined_at: new Date().toISOString() }],
      announcements: [{
        id: 'a1', community_id: 'c1', author_id: me.id, title: 'Apa caldă se oprește joi',
        body: 'Se înlocuiește o vană.', pinned_until: null,
        starts_at: new Date(Date.now() + 2 * day).toISOString(), ends_at: null,
        all_day: true, location: 'Scara A',
        created_at: new Date(Date.now() - day).toISOString(),
      }],
      discussions: [{
        id: 'q1', community_id: 'c1', author_id: me.id, title: 'Idei pentru curte',
        body: 'Ce ziceți?', status: 'approved', category: 'general',
        created_at: new Date(Date.now() - day).toISOString(),
      }],
      issues: [{
        id: 'i1', community_id: 'c1', reporter_id: me.id, title: 'Liftul se oprește',
        description: 'Între 3 și 4.', category: 'other', status: 'new', location: 'Scara A',
        created_at: new Date(Date.now() - day).toISOString(),
      }],
      polls: [{
        id: 'v1', community_id: 'c1', author_id: me.id, question: 'Schimbăm poarta?',
        multi: false, closed: false, ends_at: new Date(Date.now() + 5 * day).toISOString(),
        created_at: new Date(Date.now() - day).toISOString(),
      }],
      funds: [{
        id: 'f1', community_id: 'c1', title: 'Reparație acoperiș', description: 'Hotărât în adunare.',
        amount_bani: 25000, due_on: iso(Date.now() + 20 * day), created_by: me.id,
        created_at: new Date(Date.now() - 3 * day).toISOString(), closed_at: null,
      }],
      documents: [{
        id: 'd1', community_id: 'c1', title: 'Proces-verbal august', kind: 'minutes',
        path: 'c1/pv.pdf', mime: 'application/pdf', size_bytes: 240000, fund_id: 'f1',
        uploaded_by: me.id, created_at: new Date(Date.now() - day).toISOString(),
      }],
      notifications: [{
        id: 'n1', community_id: 'c1', user_id: me.id, type: 'issue',
        title: 'Comentariu nou la o sesizare', body: 'Gălăgie!', link: '/app/issues/i1',
        read: false, created_at: new Date(Date.now() - 3600000).toISOString(),
      }],
    },
  });

  await page.route(/\/rest\/v1\/rpc\/fund_summary/, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify([{
      fund_id: 'f1', target_bani: 25000, collected_bani: 10000,
      homes: 1, homes_paid: 0, my_due_bani: 25000, my_paid_bani: 10000,
    }]),
  }));

  return me;
}

// Every screen reachable without typing something into a form first.
const SCREENS = [
  ['/#/app/', 'the dashboard'],
  ['/#/app/announcements', 'the noticeboard'],
  ['/#/app/announcements/calendar', 'the calendar'],
  ['/#/app/announcements/a1', 'one announcement'],
  ['/#/app/announcements/new', 'the announcement composer'],
  ['/#/app/discussions', 'the discussions'],
  ['/#/app/discussions/q1', 'one discussion'],
  ['/#/app/issues', 'the issues'],
  ['/#/app/issues/i1', 'one issue'],
  ['/#/app/issues/new', 'the issue form'],
  ['/#/app/polls', 'the polls'],
  ['/#/app/polls/v1', 'one poll'],
  ['/#/app/funds', 'the collections'],
  ['/#/app/funds/f1', 'one collection'],
  ['/#/app/funds/new', 'the collection composer'],
  ['/#/app/documents', 'the documents'],
  ['/#/app/neighbours', 'the neighbours'],
  ['/#/app/notifications', 'the notifications'],
  ['/#/app/settings', 'the settings'],
  ['/#/app/settings/account', 'the account'],
  ['/#/app/admin', 'the admin panel'],
  ['/#/app/search', 'the search'],
];

test.describe('No source code on screen', () => {
  for (const [path, what] of SCREENS) {
    test(`${what} shows no comment markers`, async ({ page }) => {
      await asAdmin(page);
      await page.goto(path);
      // Something has to have rendered before absence means anything: an
      // unanchored "no such text" is true of a blank page.
      await page.locator('.screen').first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(250);

      const text = await page.evaluate(() => document.body.innerText || '');
      expect(text.length, `${path} rendered nothing`).toBeGreaterThan(20);

      for (const marker of ['/*', '*/', '{/*']) {
        expect(text, `${path} is showing a comment marker: ${marker}`).not.toContain(marker);
      }
      // And the tell-tale of the real bug: prose from a code comment.
      expect(text).not.toContain('never earns the room');
    });
  }
});
