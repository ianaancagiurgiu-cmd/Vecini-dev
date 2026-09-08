import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  The box you write a comment in.

  It was a single-line input, so a message longer than the width of the phone
  scrolled sideways out of sight while you were still writing it — you could not
  read your own sentence back before sending it. It grows now, up to a point.

  What these check is the arithmetic of that growth, because both ends of it go
  wrong in ways you would not see by typing one test message: a field that only
  ever grows (scrollHeight of an already-stretched element is its own height, so
  the reset to auto is load-bearing), and a field with no ceiling, which on a
  long message pushes the conversation off the screen and takes the send button
  with it.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

async function onAnIssue(page) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
      issues: [{
        id: 'i1', community_id: 'c1', reporter_id: me.id, title: 'Liftul se oprește',
        description: 'Între etajele 3 și 4.', category: 'other', status: 'new', location: '',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      }],
      issue_comments: [],
    },
  });
  await page.goto('/#/app/issues/i1');
  await expect(page.getByText('Liftul se oprește')).toBeVisible();
  return page.locator('.composer-input');
}

const box = (field) => field.evaluate((el) => ({
  height: Math.round(el.getBoundingClientRect().height),
  hidden: el.scrollHeight - el.clientHeight, // how much text is out of sight
}));

test.describe('Writing a comment', () => {
  test('starts one line tall', async ({ page }) => {
    const field = await onAnIssue(page);
    const m = await box(field);
    expect(m.height).toBeLessThan(60);
    expect(m.hidden).toBeLessThanOrEqual(1);
  });

  test('grows with the message, and none of it is out of sight', async ({ page }) => {
    const field = await onAnIssue(page);
    const before = await box(field);

    await field.fill(
      'Am vorbit cu firma de lift și mi-au spus că piesa vine abia joi, '
      + 'așa că până atunci rămâne așa. Îmi pare rău pentru scara A.',
    );

    const after = await box(field);
    expect(after.height, 'the field did not grow').toBeGreaterThan(before.height + 20);
    // The whole point: every word of it is on screen before you send it.
    expect(after.hidden, `${after.hidden}px of the message is hidden`).toBeLessThanOrEqual(1);
  });

  test('and shrinks back once the message has gone', async ({ page }) => {
    /*
      Not symmetry for its own sake. A field that only grows is what you get by
      setting the height to scrollHeight without resetting it to auto first,
      and it looks perfectly correct until the moment you send something long:
      the box stays five lines tall over an empty placeholder.
    */
    const field = await onAnIssue(page);
    const one = await box(field);

    await field.fill('O linie.\nA doua.\nA treia.\nA patra.');
    expect((await box(field)).height).toBeGreaterThan(one.height + 20);

    await field.fill('');
    expect((await box(field)).height).toBe(one.height);
  });

  test('stops growing after about five lines and scrolls instead', async ({ page }) => {
    const field = await onAnIssue(page);

    await field.fill(Array.from({ length: 20 }, (_, n) => `Rândul ${n + 1}.`).join('\n'));
    const m = await box(field);

    // Tall enough to read several lines of it, short enough to leave the
    // conversation and the send button on screen.
    expect(m.height).toBeGreaterThan(100);
    expect(m.height).toBeLessThan(180);
    // Past the ceiling it scrolls rather than swallowing the text.
    expect(m.hidden, 'twenty lines fitted, so nothing is capping the height').toBeGreaterThan(0);
  });

  test('Enter starts a new line rather than sending', async ({ page }) => {
    /*
      It used to send. Fine for "mulțumesc", impossible for anything with a
      second paragraph: a phone keyboard has no shift+enter to fall back on, so
      enter-to-send means the message can only ever be one line — which is the
      thing this whole change is about.
    */
    const field = await onAnIssue(page);
    await field.fill('Primul rând');
    await field.press('Enter');
    await field.pressSequentially('al doilea');

    expect(await field.inputValue()).toBe('Primul rând\nal doilea');
    // Nothing was posted on the way.
    await expect(page.getByText('Primul rând', { exact: true })).toHaveCount(0);
  });
});
