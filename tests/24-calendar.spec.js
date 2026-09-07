import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  The calendar, which is not a place but a view.

  An announcement carrying a date is what used to be an event. There is one
  table, one composer and one detail screen; the calendar is the same list
  filtered to the dated ones and sorted forwards instead of backwards. So what
  is worth testing is mostly the seam: that a date puts something in the
  calendar and no date keeps it out, and that neither view has quietly stopped
  showing the other's rows.

  Two things stay easy to get subtly wrong and impossible to see in a passing
  build. Whether something counts as past has to be judged by the day it falls
  on, not by hours elapsed, or an event at nine tomorrow morning stops saying
  "tomorrow" some time this evening. And an all-day date stored at midnight
  slides onto the previous day for anyone whose clock is behind, which is why it
  is stored at midday instead.
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

// One row shape now, whether or not it has a date on it.
const ann = (me, over) => ({
  community_id: 'c1', author_id: me, body: '', pinned_until: null,
  starts_at: null, ends_at: null, all_day: false, location: '',
  created_at: new Date(Date.now() - day).toISOString(),
  ...over,
});

function announcements(me) {
  return [
    ann(me, {
      id: 'e1', title: 'Adunarea generală', body: 'Pe ordinea de zi: bugetul.',
      location: 'Holul scării A', starts_at: atHour(3, 18),
    }),
    ann(me, { id: 'e2', title: 'Deratizare la subsol', starts_at: noonIn(1), all_day: true }),
    ann(me, { id: 'e3', title: 'Curățenie de primăvară', starts_at: atHour(-9, 10) }),
    // No date: a notice, and nothing the calendar should ever show.
    ann(me, { id: 'a1', title: 'Liftul e reparat', body: 'A fost schimbat cablul.' }),
  ];
}

async function asRole(page, role, rows) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role, joined_at: new Date().toISOString() }],
      announcements: rows ? rows(me.id) : announcements(me.id),
    },
  });
  return me;
}

test.describe('Calendar', () => {
  test('shows what is coming, soonest first, and keeps the past separate', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/calendar');

    const cards = page.locator('.card');
    await expect(cards.first()).toContainText('Deratizare la subsol');
    await expect(cards.nth(1)).toContainText('Adunarea generală');

    await expect(page.getByText('Trecute')).toBeVisible();
    await expect(page.getByText('Curățenie de primăvară')).toBeVisible();
  });

  /*
    The seam. Before the two were folded together this could not go wrong,
    because a notice and an event were different rows in different tables. Now
    one field decides, and getting the filter backwards would either fill the
    calendar with undated notices or empty it entirely.
  */
  test('a notice without a date stays out of the calendar', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/calendar');

    /*
      Anchored on something that must be there before asking what must not be.
      "No such element" is true of a screen that has not drawn yet, so an
      unanchored absence passes against a blank page — which is exactly how this
      test first passed against a filter I had deliberately removed.
    */
    await expect(page.getByText('Deratizare la subsol')).toBeVisible();
    await expect(page.getByText('Liftul e reparat')).toHaveCount(0);

    // And is still on the noticeboard, where it belongs.
    await page.goto('/#/app/announcements');
    await expect(page.getByText('Liftul e reparat')).toBeVisible();
  });

  test('one with a date is in both views, and is the same thing in each', async ({ page }) => {
    await asRole(page, 'member');

    await page.goto('/#/app/announcements');
    await expect(page.getByText('Adunarea generală')).toBeVisible();

    await page.goto('/#/app/announcements/calendar');
    await page.getByText('Adunarea generală').click();

    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements/e1');
    await expect(page.getByText('Pe ordinea de zi: bugetul.')).toBeVisible();
    await expect(page.getByText('Holul scării A')).toBeVisible();
  });

  test('says "tomorrow" rather than printing a date', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/calendar');
    await expect(page.locator('.card').first()).toContainText('Mâine');
  });

  test('an all-day date shows no clock time, a timed one does', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/calendar');

    await expect(page.locator('.card').first()).toContainText('toată ziua');
    await expect(page.locator('.card').nth(1)).toContainText('18:00');
  });

  test('the location is on the card when there is one', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/calendar');
    await expect(page.locator('.card').nth(1)).toContainText('Holul scării A');
  });

  test('the calendar is reachable from the announcements themselves', async ({ page }) => {
    // It has no place in the bottom bar and never will, so this row of pills is
    // its front door.
    await asRole(page, 'member');
    await page.goto('/#/app/announcements');
    await page.getByRole('button', { name: 'Calendar' }).click();

    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements/calendar');
    await expect(page.getByText('Deratizare la subsol')).toBeVisible();
  });

  /*
    An announcement now has two doors, and "back" has to be whichever one you
    came through. Naming a fixed address would be right from the noticeboard and
    wrong from the calendar — the same bug that once sent every settings screen
    to the dashboard.
  */
  test('back returns to the view you came from', async ({ page }) => {
    await asRole(page, 'member');

    await page.goto('/#/app/announcements/calendar');
    await page.getByText('Adunarea generală').click();
    await expect(page.getByText('Pe ordinea de zi: bugetul.')).toBeVisible();
    await page.getByLabel('back').click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements/calendar');

    await page.goto('/#/app/announcements');
    await page.getByText('Adunarea generală').click();
    await expect(page.getByText('Pe ordinea de zi: bugetul.')).toBeVisible();
    await page.getByLabel('back').click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements');
  });

  test('an old calendar link still lands on the right thing', async ({ page }) => {
    /*
      Every event kept its own id when it became an announcement, precisely so
      that the notifications already sitting in people's lists would still work.
      This is the assertion that keeps that promise true.
    */
    await asRole(page, 'member');
    await page.goto('/#/app/calendar/e1');

    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements/e1');
    await expect(page.getByText('Adunarea generală')).toBeVisible();
  });

  test('only staff are offered a way to write', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/calendar');
    await expect(page.getByText('Deratizare la subsol')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Eveniment nou' })).toHaveCount(0);

    // And typing the address in does not get a member past it either.
    await page.goto('/#/app/announcements/new');
    await expect.poll(() => new URL(page.url()).hash).toBe('#/app/announcements');
  });

  test('the date is optional, and off unless it is asked for', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/new');

    await expect(page.locator('#ann-title')).toBeVisible();
    // The notice is the default. Someone writing "the lift is fixed" should not
    // have to dismiss a date field to say it.
    await expect(page.locator('#ann-date')).toHaveCount(0);

    await page.getByRole('switch', { name: 'Se întâmplă la o anumită dată' }).click();
    await expect(page.locator('#ann-date')).toBeVisible();
  });

  test('coming from the calendar opens the form with the date already on', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/calendar');
    await page.getByRole('button', { name: 'Eveniment nou' }).click();
    await expect(page.locator('#ann-date')).toBeVisible();
  });

  test('refuses an end that falls before the start', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/new?date=1');

    await page.locator('#ann-title').fill('Lucrări la acoperiș');
    const start = new Date(Date.now() + 10 * day);
    const end = new Date(Date.now() + 5 * day);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await page.locator('#ann-date').fill(iso(start));
    await page.locator('#ann-end').fill(iso(end));
    await page.getByRole('button', { name: 'Publică anunțul' }).click();

    await expect(page.getByText('Sfârșitul e înaintea începutului.')).toBeVisible();
  });

  test('asks for a title before it will publish', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/new');
    await expect(page.getByRole('button', { name: 'Publică anunțul' })).toBeDisabled();
  });

  test('turning on all day takes the time field away', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/new?date=1');
    await expect(page.locator('#ann-time')).toBeVisible();
    await page.getByRole('switch', { name: 'Toată ziua' }).click();
    await expect(page.locator('#ann-time')).toHaveCount(0);
  });

  test('the detail screen carries the details', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/e1');

    await expect(page.getByText('Adunarea generală')).toBeVisible();
    await expect(page.getByText('Pe ordinea de zi: bugetul.')).toBeVisible();
    await expect(page.getByText('Holul scării A')).toBeVisible();
    await expect(page.getByText('18:00')).toBeVisible();
  });

  test('a member is not offered editing or deletion', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/announcements/e1');
    await expect(page.getByText('Pe ordinea de zi: bugetul.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Modifică anunțul' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Șterge anunțul' })).toHaveCount(0);
  });

  /*
    Deletion is new here. Announcements never had it, because a notice that
    turned out wrong was answered with another notice — but meetings get called
    off, and folding events in would have quietly taken away the only way to
    take one down.
  */
  test('an admin is, and deletion asks first', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/e1');

    await expect(page.getByRole('button', { name: 'Modifică anunțul' })).toBeVisible();
    await page.getByRole('button', { name: 'Șterge anunțul' }).click();
    await expect(page.getByText('Ștergi anunțul? Vecinii nu îl vor mai vedea.')).toBeVisible();
  });

  test('editing opens on the values already there', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/e1/edit');

    await expect(page.locator('#ann-title')).toHaveValue('Adunarea generală');
    await expect(page.locator('#ann-loc')).toHaveValue('Holul scării A');
    await expect(page.locator('#ann-time')).toHaveValue('18:00');
    const d = new Date(Date.now() + 3 * day);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await expect(page.locator('#ann-date')).toHaveValue(iso);
  });

  test('editing a plain notice does not invent a date for it', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/announcements/a1/edit');

    await expect(page.locator('#ann-title')).toHaveValue('Liftul e reparat');
    await expect(page.locator('#ann-date')).toHaveCount(0);
  });

  test('an all-day event today is still upcoming in the evening', async ({ page }) => {
    /*
      The bug this is here for: judging "past" by hours elapsed rather than by
      the day. An all-day event is stored at midday, so from one in the
      afternoon a subtraction of milliseconds calls it over — and the thing
      happening today disappears from the calendar while it is happening.
    */
    const me = fakeUser();
    await signedInAs(page, {
      user: me,
      tables: {
        communities: [community],
        memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
        announcements: [ann(me.id, { id: 'x1', title: 'Deratizare la subsol', starts_at: noonIn(0), all_day: true })],
      },
    });

    // Six in the evening, six hours after the stamp it was stored at.
    await page.clock.setFixedTime(new Date(new Date().setHours(18, 0, 0, 0)));
    await page.goto('/#/app/announcements/calendar');

    await expect(page.getByText('Deratizare la subsol')).toBeVisible();
    await expect(page.locator('.card').first()).toContainText('Astăzi');
    // It has not been swept into the past section six hours after its midday stamp.
    await expect(page.getByText('Trecute')).toHaveCount(0);
  });

  test('the dashboard shows the next two and links to the rest', async ({ page }) => {
    await asRole(page, 'member');
    await page.goto('/#/app/');

    await expect(page.getByText('Ce urmează')).toBeVisible();

    // The cards under "Ce urmează" are the ones carrying a calendar mark.
    const upcoming = page.getByRole('button', { name: /^📅/ });
    await expect(upcoming).toHaveCount(2);
    await expect(upcoming.first()).toContainText('Deratizare la subsol');
    await expect(upcoming.nth(1)).toContainText('Adunarea generală');

    /*
      A meeting that has already happened is still an announcement, and the
      noticeboard half of this screen may well show it. What it must not do is
      claim it is coming up.
    */
    await expect(page.getByRole('button', { name: /^📅.*Curățenie de primăvară/ })).toHaveCount(0);

    /*
      And once each. A dated announcement belongs in both halves of this screen
      by rights, but a screen that shows you the same card twice reads as a bug
      rather than as two true statements.
    */
    await expect(page.getByText('Deratizare la subsol')).toHaveCount(1);
    await expect(page.getByText('Adunarea generală')).toHaveCount(1);
    await expect(page.getByText('Liftul e reparat')).toHaveCount(1);
  });

  test('an admin can start a dated announcement from the dashboard', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/app/');

    await page.getByRole('button', { name: '+ Eveniment nou' }).click();
    await expect.poll(() => new URL(page.url()).hash).toContain('/app/announcements/new');
    await expect(page.locator('#ann-date')).toBeVisible();
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
    await asRole(page, 'admin', () => []);
    await page.goto('/#/app/');

    await expect(page.getByText('Niciun eveniment programat.')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Eveniment nou' })).toBeVisible();
  });
});
