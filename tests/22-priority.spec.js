import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  Priority announcements.

  What replaced the pin was not the wording but the expiry, so that is what
  these lean on: an announcement whose date has passed must behave exactly like
  one that was never raised. The old flag had no way to fail that test, because
  it had no way to stop being true.
*/

const day = 86400000;
const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

function announcements(me) {
  return [
    // Raised, and still within its window.
    { id: 'a1', community_id: 'c1', author_id: me, title: 'Apa caldă se oprește joi',
      body: 'Se înlocuiește o vană.', pinned_until: new Date(Date.now() + 3 * day).toISOString(),
      created_at: new Date(Date.now() - 9 * day).toISOString() },
    // Raised once, but the day has been and gone.
    { id: 'a2', community_id: 'c1', author_id: me, title: 'Deratizare, marțea trecută',
      body: 'A avut loc.', pinned_until: new Date(Date.now() - 2 * day).toISOString(),
      created_at: new Date(Date.now() - 8 * day).toISOString() },
    // Never raised, and the newest of the three.
    { id: 'a3', community_id: 'c1', author_id: me, title: 'S-a montat iluminatul nou',
      body: 'Becuri cu senzor.', pinned_until: null,
      created_at: new Date(Date.now() - 1 * day).toISOString() },
  ];
}

const asStaff = async (page, role = 'admin') => {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role, joined_at: new Date().toISOString() }],
      announcements: announcements(me.id),
    },
  });
  return me;
};

const titles = (page) => page.locator('.card .serif, .card [class*="serif"]');

test.describe('Priority announcements', () => {
  test('a live one is carried above newer ordinary ones', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements');

    const first = page.locator('.card').first();
    await expect(first).toContainText('Apa caldă');
    // It is nine days old and sits above one from yesterday.
    await expect(first).toContainText('Prioritar');
  });

  test('an expired one falls back into date order, with no badge', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements');

    const cards = page.locator('.card');
    await expect(cards.nth(1)).toContainText('S-a montat iluminatul nou');
    await expect(cards.nth(2)).toContainText('Deratizare');

    // The whole point: a date in the past leaves no trace on the screen.
    await expect(page.getByText('Deratizare').locator('..')).not.toContainText('Prioritar');
  });

  test('the badge says until when, not just that it is raised', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements');
    // Three days out, so a weekday rather than a date.
    const expected = new Date(Date.now() + 3 * day).toLocaleDateString('ro-RO', { weekday: 'long' });
    await expect(page.locator('.card').first()).toContainText(expected);
  });

  test('staff can raise one, and must name a day to do it', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements/a3');

    await page.getByRole('button', { name: 'Ridică anunțul sus' }).click();
    const field = page.locator('#prio-until');
    await expect(field).toBeVisible();

    // Prefilled a week out rather than left empty, and refusing the past.
    await expect(field).not.toHaveValue('');
    const min = await field.getAttribute('min');
    expect(min).toBeTruthy();

    await field.fill('');
    await expect(page.getByRole('button', { name: 'Salvează' })).toBeDisabled();
  });

  test('a day already gone is refused rather than silently accepted', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements/a3');

    await page.getByRole('button', { name: 'Ridică anunțul sus' }).click();
    const past = new Date(Date.now() - 3 * day);
    const iso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    await page.locator('#prio-until').fill(iso);
    await page.getByRole('button', { name: 'Salvează' }).click();

    await expect(page.getByText('Alege o zi din viitor.')).toBeVisible();
  });

  test('an ordinary member is offered none of this', async ({ page }) => {
    await asStaff(page, 'member');
    await page.goto('/#/app/announcements/a3');

    await expect(page.getByText('S-a montat iluminatul nou')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ridică anunțul sus' })).toHaveCount(0);
  });

  test('a raised one offers releasing it early', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements/a1');

    await expect(page.getByRole('button', { name: 'Deprioritizează anunț' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schimbă data prioritate anunț' })).toBeVisible();
  });

  /*
    The staff controls are bare icons in the corner now, with no words beside
    them. That is fine to look at and nothing at all to listen to unless each
    one carries its own name — and an unnamed icon button is announced as
    "button", which is no help to anybody.

    Written against the buttons the screen actually renders rather than a list
    of expected names, so a tool added later is covered without anyone
    remembering to come back here.
  */
  test('every icon in the corner says what it is', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements/a1');
    await expect(page.getByText('Se înlocuiește o vană.')).toBeVisible();

    const named = await page.evaluate(() => {
      const header = document.querySelector('.screen > div');
      return [...header.querySelectorAll('button')].map((b) => ({
        text: b.textContent.trim(),
        name: b.getAttribute('aria-label') || '',
      }));
    });

    expect(named.length, 'no buttons found in the header').toBeGreaterThan(3);
    for (const b of named) {
      // The back arrow is in here too, and it is named the same way.
      expect(b.name.length, `a header button with no name, showing "${b.text}"`).toBeGreaterThan(2);
    }
  });
});

/*
  The "OFICIAL" badge.

  Every announcement is official — only staff can write one — so on the list
  screen the badge said the same true thing on every single card, when the
  header above the list already says it once for all of them ("Doar anunțuri
  oficiale"). It still earns its place on the dashboard and the detail screen,
  where an announcement turns up next to discussions, issues and polls and the
  badge is what tells them apart.
*/
test.describe('The OFICIAL badge', () => {
  test('is not repeated on every card in the list', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements');

    // Said once, for the whole list. (getByText is a substring match, and
    // "oficiale" here would itself satisfy a bare search for "OFICIAL" — this
    // is the one place that is supposed to say it, so its presence is asserted
    // by name rather than assumed.)
    await expect(page.getByText('Doar anunțuri oficiale')).toBeVisible();
    // And not once per card: the badge is "📢 OFICIAL", exactly, on a card.
    await expect(page.locator('.card').getByText('📢 OFICIAL', { exact: true })).toHaveCount(0);
  });

  test('still marks an announcement on the dashboard, among other kinds of card', async ({ page }) => {
    const me = fakeUser();
    await signedInAs(page, {
      user: me,
      tables: {
        communities: [community],
        memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'admin', joined_at: new Date().toISOString() }],
        announcements: [{
          id: 'd1', community_id: 'c1', author_id: me.id,
          title: 'Curățenie generală', body: 'Sâmbătă dimineața.',
          pinned_until: null, starts_at: null, ends_at: null, all_day: false, location: '',
          created_at: new Date().toISOString(),
        }],
      },
    });
    await page.goto('/#/app/');

    await expect(page.getByText('Curățenie generală')).toBeVisible();
    await expect(page.getByText('OFICIAL')).toBeVisible();
  });

  test('still marks it on the detail screen', async ({ page }) => {
    await asStaff(page);
    await page.goto('/#/app/announcements/a3');

    await expect(page.getByText('S-a montat iluminatul nou')).toBeVisible();
    await expect(page.getByText('OFICIAL')).toBeVisible();
  });
});
