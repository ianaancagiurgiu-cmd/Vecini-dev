import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  The calendar.

  Two things here are easy to get subtly wrong and impossible to see in a
  passing build. Whether an event counts as past has to be judged by the day it
  falls on, not by hours elapsed, or an event at nine tomorrow morning stops
  saying "tomorrow" some time this evening. And an all-day event stored at
  midnight slides onto the previous date for anyone whose clock is behind, which
  is why it is stored at midday instead.
*/

const day = 86400000;
const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

// Midday on the day n days from now, matching how the app writes them.
const noonIn = (n) => {
  const d = new Date(Date.now() + n * day);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};
const atHour = (n, hour) => {
  const d = new Date(Date.now() + n * day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

function events(me) {
  return [
    { id: 'e1', community_id: 'c1', author_id: me, title: 'Adunarea generală',
      description: 'Pe ordinea de zi: bugetul.', location: 'Holul scării A',
      starts_at: atHour(3, 18), ends_at: null, all_day: false,
      created_at: new Date(Date.now() - day).toISOString() },
    { id: 'e2', community_id: 'c1', author_id: me, title: 'Deratizare la subsol',
      description: '', location: '', starts_at: noonIn(1), ends_at: null, all_day: true,
      created_at: new Date(Date.now() - day).toISOString() },
    { id: 'e3', community_id: 'c1', author_id: me, title: 'Curățenie de primăvară',
      description: '', location: '', starts_at: atHour(-9, 10), ends_at: null, all_day: false,
      created_at: new Date(Date.now() - 20 * day).toISOString() },
  ];
}

async function asRole(page, role) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role, joined_at: new Date().toISOString() }],
      events: events(me.id),
    },
  });
  return me;
}

test.describe('Calendar', () => {
  test('shows what is coming, soonest first, and keeps the past separate', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/calendar');

    const cards = page.locator('.card');
    // Tomorrow's before the one in three days, even though it was added later.
    await expect(cards.nth(0)).toContainText('Deratizare la subsol');
    await expect(cards.nth(1)).toContainText('Adunarea generală');
    await expect(cards.nth(2)).toContainText('Curățenie de primăvară');

    await expect(page.getByText('Trecute')).toBeVisible();
  });

  test('says "tomorrow" rather than printing a date', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/calendar');
    await expect(page.locator('.card').first()).toContainText('Mâine');
  });

  test('an all-day event shows no clock time, a timed one does', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/calendar');

    const allDay = page.locator('.card').filter({ hasText: 'Deratizare' });
    await expect(allDay).toContainText('toată ziua');
    await expect(allDay).not.toContainText(':');

    await expect(page.locator('.card').filter({ hasText: 'Adunarea generală' })).toContainText('18:00');
  });

  test('the location is on the card when there is one', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/calendar');
    await expect(page.locator('.card').filter({ hasText: 'Adunarea generală' })).toContainText('Holul scării A');
  });

  test('only staff are offered a way to add one', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/calendar');
    await expect(page.getByRole('button', { name: 'Eveniment nou' })).toHaveCount(0);

    // And typing the address in does not get a member past it either.
    await page.goto('/#/app/calendar/new');
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/calendar');
  });

  test('an admin gets the form', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/calendar');
    await page.getByRole('button', { name: 'Eveniment nou' }).click();
    await expect(page.locator('#ev-title')).toBeVisible();
    await expect(page.locator('#ev-date')).toBeVisible();
  });

  test('refuses an end that falls before the start', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/calendar/new');

    await page.locator('#ev-title').fill('Lucrări la acoperiș');
    const start = new Date(Date.now() + 10 * day);
    const end = new Date(Date.now() + 5 * day);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await page.locator('#ev-date').fill(iso(start));
    await page.locator('#ev-end').fill(iso(end));
    await page.getByRole('button', { name: 'Publică evenimentul' }).click();

    await expect(page.getByText('Sfârșitul e înaintea începutului.')).toBeVisible();
  });

  test('asks for a title before it will publish', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/calendar/new');
    await page.getByRole('button', { name: 'Publică evenimentul' }).click();
    await expect(page.getByText('Scrie ce se întâmplă.')).toBeVisible();
  });

  test('turning on all day takes the time field away', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/calendar/new');

    await expect(page.locator('#ev-time')).toBeVisible();
    await page.getByRole('switch', { name: 'Toată ziua' }).click();
    await expect(page.locator('#ev-time')).toHaveCount(0);
  });

  test('the detail screen carries the details', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/calendar/e1');

    await expect(page.getByText('Adunarea generală')).toBeVisible();
    await expect(page.getByText('Holul scării A')).toBeVisible();
    await expect(page.getByText('Pe ordinea de zi: bugetul.')).toBeVisible();
  });

  test('a member is not offered editing or deletion', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/calendar/e1');
    await expect(page.getByRole('button', { name: 'Șterge evenimentul' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Modifică evenimentul' })).toHaveCount(0);
  });

  test('an admin is, and deletion asks first', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/calendar/e1');

    await expect(page.getByRole('button', { name: 'Modifică evenimentul' })).toBeVisible();
    await page.getByRole('button', { name: 'Șterge evenimentul' }).click();
    await expect(page.getByText('Ștergi evenimentul? Vecinii nu îl vor mai vedea.')).toBeVisible();
  });

  test('editing opens on the values already there', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/calendar/e1/edit');

    await expect(page.locator('#ev-title')).toHaveValue('Adunarea generală');
    await expect(page.locator('#ev-loc')).toHaveValue('Holul scării A');
    await expect(page.locator('#ev-time')).toHaveValue('18:00');
  });

  /*
    The one that says the day matters and the clock does not.

    An all-day event today is still today at six in the evening. Judging "past"
    by hours elapsed makes it vanish from the list at noon, which reads as the
    notice having been deleted. The clock is pinned so the difference is
    reachable whatever time the suite happens to run.
  */
  test('an all-day event today is still upcoming in the evening', async ({ page }) => {
    const sixPmToday = new Date();
    sixPmToday.setHours(18, 0, 0, 0);
    await page.clock.setFixedTime(sixPmToday);

    const me = fakeUser();
    const noonToday = new Date();
    noonToday.setHours(12, 0, 0, 0);

    await signedInAs(page, {
      user: me,
      tables: {
        communities: [community],
        memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
        events: [{
          id: 'e9', community_id: 'c1', author_id: me.id, title: 'Deratizare la subsol',
          description: '', location: '', starts_at: noonToday.toISOString(),
          ends_at: null, all_day: true, created_at: new Date(Date.now() - day).toISOString(),
        }],
      },
    });
    await page.goto('/#/app/calendar');

    await expect(page.getByText('Deratizare la subsol')).toBeVisible();
    await expect(page.locator('.card').first()).toContainText('Astăzi');
    // It has not been swept into the past section six hours after its midday stamp.
    await expect(page.getByText('Trecute')).toHaveCount(0);
  });

  test('the dashboard shows the next two and links to the rest', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/');

    await expect(page.getByText('Ce urmează')).toBeVisible();
    await expect(page.getByText('Deratizare la subsol')).toBeVisible();
    await expect(page.getByText('Adunarea generală')).toBeVisible();
    // Past events have no business on the dashboard.
    await expect(page.getByText('Curățenie de primăvară')).toHaveCount(0);
  });

  /*
    The calendar is not in the bottom bar, so an admin who never taps "see all"
    never meets the button that fills it. Iana looked straight at this section
    and could not find a way to add anything, which is the whole bug: a section
    you cannot act on reads as a section that does not work.
  */
  test('an admin can start an event from the dashboard, without going to the calendar first', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/');

    await page.getByRole('button', { name: '+ Eveniment nou' }).click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/calendar/new');
    await expect(page.locator('#ev-title')).toBeVisible();
  });

  test('a member is offered no such button', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/');

    await expect(page.getByText('Ce urmează')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Eveniment nou' })).toHaveCount(0);
  });

  test('the button is there before there is anything in the calendar', async ({ page }) => {
    // The empty state is exactly when it matters most, and exactly where a
    // section rendered only around a list would have dropped it.
    const me = fakeUser();
    await signedInAs(page, {
      user: me,
      tables: {
        communities: [community],
        memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'admin', joined_at: new Date().toISOString() }],
        events: [],
      },
    });
    await page.goto('/#/app/');

    await expect(page.getByText('Niciun eveniment programat.')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Eveniment nou' })).toBeVisible();
  });
});
