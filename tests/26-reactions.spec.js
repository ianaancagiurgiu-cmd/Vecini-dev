import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  The heart on a comment.

  Two things here are worth more than checking that a button exists.

  The first is that the screen must change before the write lands. The store
  colours the heart in locally and sends the row afterwards, and the reason is
  not tidiness: the button next door to this one, "Mă afectează", reloads the
  whole community after every press, which is invisible on a button pressed once
  per issue and reads as broken on one tapped in passing. So the reaction route
  below is deliberately slow, and the assertion happens while it is still in
  flight. Fulfil it instantly and the test cannot tell the two designs apart.

  The second is that a failed write has to take the heart back. An optimistic
  screen that keeps a state the database refused is worse than a slow one — it
  tells you something happened that did not.

  The shared harness answers every REST call from its fixtures whatever the
  method, so a POST there would come back looking like a success and change
  nothing. Hence the route: it remembers, and it answers reads from the same
  rows it writes.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

const NEIGHBOUR = '99999999-9999-9999-9999-999999999999';

/*
  `rows` is the reaction table as it starts out. The returned handle records
  what the app sent, so a test can tell "the heart went red" apart from "the
  heart went red and the row was written".
*/
async function withReactions(page, { role = 'member', rows = [], delayMs = 0, fail = false } = {}) {
  const me = fakeUser();

  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [
        { id: 'm1', user_id: me.id, community_id: 'c1', role, joined_at: new Date().toISOString() },
        { id: 'm2', user_id: NEIGHBOUR, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() },
      ],
      profiles: [
        { id: me.id, full_name: me.user_metadata.full_name, apartment: 'Ap. 12', avatar_color: '#8c3c52' },
        { id: NEIGHBOUR, full_name: 'Ana Vecin', apartment: 'Ap. 3', avatar_color: '#2f6b4f' },
      ],
      issues: [{
        id: 'i1', community_id: 'c1', reporter_id: me.id, title: 'Liftul se oprește',
        description: 'Între etajele 3 și 4.', category: 'other', status: 'new', location: '',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      }],
      issue_comments: [
        { id: 'c1c1', issue_id: 'i1', author_id: NEIGHBOUR, body: 'Am sunat la firma de lift, vin joi.',
          created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 'c1c2', issue_id: 'i1', author_id: me.id, body: 'Mulțumesc!',
          created_at: new Date(Date.now() - 1800000).toISOString() },
      ],
      discussions: [{
        id: 'd1', community_id: 'c1', author_id: NEIGHBOUR, title: 'Chef sâmbătă seara',
        body: 'Cine vine?', status: 'approved', category: 'general',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      }],
      discussion_replies: [
        { id: 'd1r1', discussion_id: 'd1', author_id: NEIGHBOUR, body: 'Vin și eu.',
          created_at: new Date(Date.now() - 3600000).toISOString() },
      ],
    },
  });

  const sent = { posts: [], deletes: [] };
  let table = rows.map((r) => ({ emoji: '❤️', issue_comment_id: null, reply_id: null, ...r }));

  await page.route(/\/rest\/v1\/reactions/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));

    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      sent.posts.push(body);
      if (fail) {
        return route.fulfill({
          status: 403, contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ message: 'new row violates row-level security policy' }),
        });
      }
      table = [...table, { emoji: '❤️', issue_comment_id: null, reply_id: null, ...body }];
    } else if (req.method() === 'DELETE') {
      const url = new URL(req.url());
      sent.deletes.push(url.search);
      const eq = (k) => (url.searchParams.get(k) || '').replace(/^eq\./, '');
      table = table.filter((r) => !(
        (!eq('issue_comment_id') || r.issue_comment_id === eq('issue_comment_id'))
        && (!eq('reply_id') || r.reply_id === eq('reply_id'))
        && r.user_id === eq('user_id')
      ));
    }

    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(table.length - 1, 0)}/${table.length}` },
      body: JSON.stringify(table),
    });
  });

  return { me, sent };
}

// The heart under a given comment, found through the comment's own text so a
// test never depends on the order the bubbles happen to be in.
const heartUnder = (page, text) =>
  page.locator('.comment-col', { hasText: text }).locator('button[aria-pressed]');

test.describe('Hearting a comment', () => {
  test('every comment offers one, and an untouched one shows no count', async ({ page }) => {
    await withReactions(page);
    await page.goto('/#/app/issues/i1');

    await expect(page.getByText('Am sunat la firma de lift')).toBeVisible();
    const hearts = page.locator('button[aria-pressed]');
    await expect(hearts).toHaveCount(2); // one per comment

    // "♡ 0" reads as a score of nothing; the number appears once there is one.
    await expect(hearts.first()).toHaveAttribute('aria-pressed', 'false');
    await expect(hearts.first()).not.toContainText('0');
  });

  test('pressing it fills the heart and writes the row', async ({ page }) => {
    const { me, sent } = await withReactions(page);
    await page.goto('/#/app/issues/i1');

    const heart = heartUnder(page, 'Am sunat la firma de lift');
    await heart.click();

    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect(heart).toContainText('1');

    await expect.poll(() => sent.posts.length).toBe(1);
    expect(sent.posts[0]).toMatchObject({ issue_comment_id: 'c1c1', user_id: me.id, emoji: '❤️' });
    // Nothing about a reply went out with it — one table, two references, and
    // filling in both is a row the database refuses.
    expect(sent.posts[0].reply_id).toBeUndefined();
  });

  test('and pressing it again takes it back, row and all', async ({ page }) => {
    const { me, sent } = await withReactions(page);
    await page.goto('/#/app/issues/i1');

    // Given twice: the row can only be seeded under an id that is not known
    // until the sign-in has happened, so the first press is how it gets there.
    const heart = heartUnder(page, 'Am sunat la firma de lift');
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');

    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await expect(heart).not.toContainText('1');

    await expect.poll(() => sent.deletes.length).toBe(1);
    expect(sent.deletes[0]).toContain('issue_comment_id=eq.c1c1');
    expect(sent.deletes[0]).toContain(`user_id=eq.${me.id}`);
  });

  test('somebody else\'s heart counts without pretending to be yours', async ({ page }) => {
    await withReactions(page, { rows: [{ issue_comment_id: 'c1c1', user_id: NEIGHBOUR }] });
    await page.goto('/#/app/issues/i1');

    const heart = heartUnder(page, 'Am sunat la firma de lift');
    await expect(heart).toContainText('1');
    // Counted, but not filled in: the fill is the answer to "did I?", and
    // getting that backwards is how somebody hearts a thing twice.
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
  });

  test('two hearts on one comment make two, not one and not three', async ({ page }) => {
    await withReactions(page, { rows: [{ issue_comment_id: 'c1c1', user_id: NEIGHBOUR }] });
    await page.goto('/#/app/issues/i1');

    const heart = heartUnder(page, 'Am sunat la firma de lift');
    await heart.click();
    await expect(heart).toContainText('2');
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
  });

  test('the heart moves before the write lands, not after it', async ({ page }) => {
    /*
      The whole design, in one assertion. With a two-second round trip the
      colour has to change immediately; a screen that waits for the row would
      still be grey here, and grey for another two seconds.
    */
    await withReactions(page, { delayMs: 2000 });
    await page.goto('/#/app/issues/i1');

    const heart = heartUnder(page, 'Am sunat la firma de lift');
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true', { timeout: 400 });
    await expect(heart).toContainText('1', { timeout: 400 });
  });

  test('a refused write takes the heart back and says so', async ({ page }) => {
    await withReactions(page, { fail: true });
    await page.goto('/#/app/issues/i1');

    const heart = heartUnder(page, 'Am sunat la firma de lift');
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');

    // The reload puts the truth back, and the toast is the only thing that
    // distinguishes this from a tap the app ignored.
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Nu s-a putut trimite. Încearcă din nou.')).toBeVisible();
  });

  test('replies in a discussion have one too, and it writes to the other column', async ({ page }) => {
    const { me, sent } = await withReactions(page);
    await page.goto('/#/app/discussions/d1');

    const heart = heartUnder(page, 'Vin și eu.');
    await heart.click();

    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => sent.posts.length).toBe(1);
    expect(sent.posts[0]).toMatchObject({ reply_id: 'd1r1', user_id: me.id, emoji: '❤️' });
    expect(sent.posts[0].issue_comment_id).toBeUndefined();
  });
});
