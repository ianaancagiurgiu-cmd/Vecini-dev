import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  Correcting your own comment, by holding it down.

  The gesture is the interesting part, and not because it is hard to fire — it
  is hard to fire *only when meant*. A hold that also answers a scroll makes a
  conversation unusable; a hold bound to everybody's messages leaves people
  waiting for a menu that was never coming, and takes away the text selection
  they might actually have wanted. So most of these are about when nothing
  should happen.

  The fifteen minutes are the database's rule, not the app's — see
  supabase/0015_comment_edits.sql, which is what makes them true rather than
  merely displayed. What is checked here is that the app does not offer an edit
  that would be refused.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

const NEIGHBOUR = '99999999-9999-9999-9999-999999999999';
const minutesAgo = (n) => new Date(Date.now() - n * 60000).toISOString();

/*
  `rpc` records what the edit function was asked to do, and answers as the
  database would: a timestamp. The shared harness knows nothing about rpc
  calls, and would answer one with a list of fixtures.
*/
async function onAnIssue(page, { fail = false } = {}) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [
        { id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() },
        { id: 'm2', user_id: NEIGHBOUR, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() },
      ],
      profiles: [
        { id: me.id, full_name: me.user_metadata.full_name, apartment: 'Ap. 12', avatar_color: '#8c3c52' },
        { id: NEIGHBOUR, full_name: 'Ana Vecin', apartment: 'Ap. 3', avatar_color: '#2f6b4f' },
      ],
      issues: [{
        id: 'i1', community_id: 'c1', reporter_id: me.id, title: 'Liftul se oprește',
        description: 'Între 3 și 4.', category: 'other', status: 'new', location: '',
        created_at: minutesAgo(600),
      }],
      issue_comments: [
        // Mine, two minutes ago: the one that can be corrected.
        { id: 'mine-fresh', issue_id: 'i1', author_id: me.id, body: 'Am sunat la firma de lft.', created_at: minutesAgo(2), edited_at: null },
        // Mine, but an hour ago: too late.
        { id: 'mine-old', issue_id: 'i1', author_id: me.id, body: 'Vin joi.', created_at: minutesAgo(60), edited_at: null },
        // Somebody else's, just now: never mine to touch.
        { id: 'hers', issue_id: 'i1', author_id: NEIGHBOUR, body: 'Mulțumesc!', created_at: minutesAgo(1), edited_at: null },
      ],
    },
  });

  const rpc = [];
  await page.route(/\/rest\/v1\/rpc\/edit_comment/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    rpc.push(JSON.parse(req.postData() || '{}'));
    if (fail) {
      return route.fulfill({
        status: 400, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ message: 'not yours to edit, or the fifteen minutes are up' }),
      });
    }
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(new Date().toISOString()),
    });
  });

  await page.goto('/#/app/issues/i1');
  await expect(page.getByText('Am sunat la firma de lft.')).toBeVisible();
  return { me, rpc };
}

const bubbleWith = (page, text) => page.locator('.comment-bubble', { hasText: text });

// A real press-and-wait, rather than a synthetic event: the handler measures
// both time and movement, and only the mouse driven by hand exercises either.
async function hold(page, locator, ms = 700) {
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 14);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

const menu = (page) => page.getByRole('menuitem', { name: 'Editează mesajul' });
const field = (page) => page.locator('.composer-input');

test.describe('Correcting your own message', () => {
  test('holding your own recent comment offers the edit', async ({ page }) => {
    await onAnIssue(page);
    await hold(page, bubbleWith(page, 'firma de lft'));
    await expect(menu(page)).toBeVisible();
  });

  test('holding somebody else\'s offers nothing at all', async ({ page }) => {
    await onAnIssue(page);
    await hold(page, bubbleWith(page, 'Mulțumesc!'));
    await expect(menu(page)).toHaveCount(0);
  });

  test('and holding your own from an hour ago offers nothing either', async ({ page }) => {
    // The window is the database's rule. The app's job is not to offer what
    // would come back refused.
    await onAnIssue(page);
    await hold(page, bubbleWith(page, 'Vin joi.'));
    await expect(menu(page)).toHaveCount(0);
  });

  test('a scroll is not a hold', async ({ page }) => {
    /*
      The failure this guards is not a missing menu but a conversation you
      cannot scroll: a finger that rests for half a second on the way past
      opens a menu over what you were reading. Movement has to cancel it.
    */
    await onAnIssue(page);
    const b = await bubbleWith(page, 'firma de lft').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 14);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.move(b.x + b.width / 2, b.y - 60, { steps: 6 }); // dragged away
    await page.waitForTimeout(600);
    await page.mouse.up();

    await expect(menu(page)).toHaveCount(0);
  });

  test('the edit opens in the box at the foot, on the text you wrote', async ({ page }) => {
    await onAnIssue(page);
    await hold(page, bubbleWith(page, 'firma de lft'));
    await menu(page).click();

    await expect(page.getByText('Editezi mesajul')).toBeVisible();
    expect(await field(page).inputValue()).toBe('Am sunat la firma de lft.');
    // The send button says what it will do now.
    await expect(page.getByRole('button', { name: '✓' })).toBeVisible();
  });

  test('saving sends the correction and shows it, marked as edited', async ({ page }) => {
    const { rpc } = await onAnIssue(page);
    await hold(page, bubbleWith(page, 'firma de lft'));
    await menu(page).click();

    await field(page).fill('Am sunat la firma de lift.');
    await page.getByRole('button', { name: '✓' }).click();

    await expect(page.getByText('Am sunat la firma de lift.')).toBeVisible();
    await expect(page.getByText('Am sunat la firma de lft.')).toHaveCount(0);
    // The mark is the part that matters in a thread where things get agreed.
    await expect(bubbleWith(page, 'firma de lift')).toContainText('editat');

    expect(rpc).toHaveLength(1);
    expect(rpc[0]).toMatchObject({ p_kind: 'comment', p_id: 'mine-fresh', p_body: 'Am sunat la firma de lift.' });
    // And the box is a box for new comments again.
    await expect(page.getByText('Editezi mesajul')).toHaveCount(0);
    expect(await field(page).inputValue()).toBe('');
  });

  test('cancelling leaves the message exactly as it was', async ({ page }) => {
    const { rpc } = await onAnIssue(page);
    await hold(page, bubbleWith(page, 'firma de lft'));
    await menu(page).click();

    await field(page).fill('Cu totul altceva.');
    await page.getByRole('button', { name: 'Anulează' }).click();

    await expect(page.getByText('Am sunat la firma de lft.')).toBeVisible();
    await expect(bubbleWith(page, 'firma de lft')).not.toContainText('editat');
    expect(rpc).toHaveLength(0);
    expect(await field(page).inputValue()).toBe('');
  });

  test('a refusal from the database says so instead of pretending', async ({ page }) => {
    await onAnIssue(page, { fail: true });
    await hold(page, bubbleWith(page, 'firma de lft'));
    await menu(page).click();

    await field(page).fill('Am sunat la firma de lift.');
    await page.getByRole('button', { name: '✓' }).click();

    await expect(page.getByText('Nu s-a putut salva modificarea.')).toBeVisible();
    // The old text is still what everyone can see.
    await expect(page.getByText('Am sunat la firma de lft.')).toBeVisible();
  });

  test('tapping away closes the menu without touching anything', async ({ page }) => {
    const { rpc } = await onAnIssue(page);
    await hold(page, bubbleWith(page, 'firma de lft'));
    await expect(menu(page)).toBeVisible();

    await page.mouse.click(20, 120); // the scrim, well away from the menu
    await expect(menu(page)).toHaveCount(0);
    await expect(page.getByText('Editezi mesajul')).toHaveCount(0);
    expect(rpc).toHaveLength(0);
  });

  test('a message already corrected says so from the start', async ({ page }) => {
    const me = fakeUser();
    await signedInAs(page, {
      user: me,
      tables: {
        communities: [community],
        memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
        issues: [{
          id: 'i1', community_id: 'c1', reporter_id: me.id, title: 'Liftul se oprește',
          description: 'Între 3 și 4.', category: 'other', status: 'new', location: '',
          created_at: minutesAgo(600),
        }],
        issue_comments: [
          { id: 'c9', issue_id: 'i1', author_id: me.id, body: 'Vin joi.', created_at: minutesAgo(90), edited_at: minutesAgo(88) },
        ],
      },
    });
    await page.goto('/#/app/issues/i1');
    await expect(bubbleWith(page, 'Vin joi.')).toContainText('editat');
  });
});
