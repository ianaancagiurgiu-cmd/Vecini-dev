import { test, expect } from '@playwright/test';
import { signedInAs, fakeUser } from './helpers.js';

/*
  The notifications screen, which had no test at all until now — the specs that
  covered it were written against the demo data the app stopped using, and have
  been skipped ever since.

  What it is for: telling you what happened while you were not looking. So the
  list holds the unread ones and nothing else. It used to hold everything ever
  sent, read ones greyed out among the unread, which after a fortnight is a
  screen you scroll past instead of reading — and the one thing it exists to
  say, that something is new, is the thing buried in it.

  Read is not deleted. The list and the badge on the bell are two views of the
  same column, which is why a test that only checked the list could pass while
  the badge went on claiming eleven.
*/

const community = {
  id: 'c1', name: 'Aleea Teilor', code: 'TEI-10', kind: 'bloc',
  address: '', description: '', join_mode: 'invite',
};

const hoursAgo = (n) => new Date(Date.now() - n * 3600000).toISOString();

/*
  Answers reads from the same rows the writes land in, so "mark it read" is
  visible to the query that comes after it. The shared harness would hand back
  its fixtures unchanged and every one of these would pass on a stale render.
*/
async function withNotifications(page, rows) {
  const me = fakeUser();
  await signedInAs(page, {
    user: me,
    tables: {
      communities: [community],
      memberships: [{ id: 'm1', user_id: me.id, community_id: 'c1', role: 'member', joined_at: new Date().toISOString() }],
      announcements: [],
    },
  });

  let table = rows.map((r) => ({
    community_id: 'c1', user_id: me.id, type: 'issue', body: '', link: '/app/issues',
    read: false, created_at: hoursAgo(2), ...r,
  }));

  await page.route(/\/rest\/v1\/notifications/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' });
    }
    if (req.method() === 'PATCH') {
      const url = new URL(req.url());
      const patch = JSON.parse(req.postData() || '{}');
      const only = (url.searchParams.get('id') || '').replace(/^eq\./, '');
      table = table.map((n) => ((!only || n.id === only) ? { ...n, ...patch } : n));
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(table.length - 1, 0)}/${table.length}` },
      body: JSON.stringify(table),
    });
  });

  return me;
}

const clearBtn = (page) => page.getByRole('button', { name: 'Golește lista' });

test.describe('Notifications', () => {
  test('shows the unread ones, and not the ones already read', async ({ page }) => {
    await withNotifications(page, [
      { id: 'n1', title: 'Comentariu nou la o sesizare', body: 'Gălăgie!' },
      { id: 'n2', title: 'Anunț nou de la administrație', read: true },
      { id: 'n3', title: 'Sesizarea ta a fost actualizată' },
    ]);
    await page.goto('/#/app/notifications');

    await expect(page.getByText('Comentariu nou la o sesizare')).toBeVisible();
    await expect(page.getByText('Sesizarea ta a fost actualizată')).toBeVisible();
    await expect(page.getByText('Anunț nou de la administrație')).toHaveCount(0);
  });

  test('opening one takes it off the list', async ({ page }) => {
    await withNotifications(page, [
      { id: 'n1', title: 'Comentariu nou la o sesizare', link: '/app/issues' },
      { id: 'n2', title: 'Sesizarea ta a fost actualizată', link: '/app/issues' },
    ]);
    await page.goto('/#/app/notifications');

    await page.getByText('Comentariu nou la o sesizare').click();
    await expect.poll(() => new URL(page.url()).hash).toContain('/app/issues');

    await page.goto('/#/app/notifications');
    await expect(page.getByText('Sesizarea ta a fost actualizată')).toBeVisible();
    await expect(page.getByText('Comentariu nou la o sesizare')).toHaveCount(0);
  });

  test('clearing the list empties it, and says so', async ({ page }) => {
    await withNotifications(page, [
      { id: 'n1', title: 'Comentariu nou la o sesizare' },
      { id: 'n2', title: 'Sesizarea ta a fost actualizată' },
      { id: 'n3', title: 'Vot nou deschis' },
    ]);
    await page.goto('/#/app/notifications');
    await expect(page.getByText('Vot nou deschis')).toBeVisible();

    await clearBtn(page).click();

    await expect(page.getByText('Lista e goală.')).toBeVisible();
    await expect(page.getByText('Nicio notificare nouă.')).toBeVisible();
    await expect(page.getByText('Vot nou deschis')).toHaveCount(0);
    // Nothing left to clear, so nothing offering to.
    await expect(clearBtn(page)).toHaveCount(0);
  });

  test('and it stays empty on the way back', async ({ page }) => {
    // The clearing has to have reached the database, not just the screen: this
    // reloads and asks again.
    await withNotifications(page, [{ id: 'n1', title: 'Comentariu nou la o sesizare' }]);
    await page.goto('/#/app/notifications');
    await clearBtn(page).click();
    await expect(page.getByText('Nicio notificare nouă.')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Nicio notificare nouă.')).toBeVisible();
    await expect(page.getByText('Comentariu nou la o sesizare')).toHaveCount(0);
  });

  test('the bell agrees with the list, before and after', async ({ page }) => {
    /*
      The count and the list read the same column, and this is what says so.
      Written the other way round — list only — it would pass just as happily
      with a bell stuck on three above an empty screen.
    */
    await withNotifications(page, [
      { id: 'n1', title: 'Comentariu nou la o sesizare' },
      { id: 'n2', title: 'Sesizarea ta a fost actualizată' },
      { id: 'n3', title: 'Vot nou deschis', read: true },
    ]);
    await page.goto('/#/app/');

    const bell = page.getByRole('button', { name: 'Notificări' });
    await expect(bell).toContainText('2');

    await page.goto('/#/app/notifications');
    await clearBtn(page).click();
    await expect(page.getByText('Nicio notificare nouă.')).toBeVisible();

    await page.goto('/#/app/');
    await expect(bell).not.toContainText('2');
  });

  test('with nothing unread there is no list and nothing to clear', async ({ page }) => {
    await withNotifications(page, [{ id: 'n1', title: 'Anunț nou', read: true }]);
    await page.goto('/#/app/notifications');

    await expect(page.getByText('Nicio notificare nouă.')).toBeVisible();
    await expect(clearBtn(page)).toHaveCount(0);
  });

  test('the preferences are still one tap away', async ({ page }) => {
    // The two halves of this screen share a header; a change to one of them
    // has form for taking the other with it.
    await withNotifications(page, [{ id: 'n1', title: 'Comentariu nou la o sesizare' }]);
    await page.goto('/#/app/notifications');

    await page.getByRole('button', { name: /Preferințe/ }).click();
    await expect(page.getByText('Toate anunțurile')).toBeVisible();
    // And the clear button belongs to the list, not to the preferences.
    await expect(clearBtn(page)).toHaveCount(0);
  });
});
