/* Vecini service worker — push notifications only.
   Deliberately no offline/asset caching: a stale cached bundle is a far worse
   bug than a page that needs the network, and the app is useless offline anyway. */

/* The app uses HashRouter, so in-app routes live after a '#'. Stored links look
   like '/app/announcements/123' and must become '/#/app/announcements/123'. */
function toHashUrl(link) {
  const route = link || '/app/notifications';
  if (route.startsWith('/#')) return route;
  return '/#' + (route.startsWith('/') ? route : '/' + route);
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push with a non-JSON body still deserves to be shown.
    payload = { title: 'Vecini', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Vecini';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    lang: payload.lang || 'ro',
    tag: payload.tag || undefined,
    // Collapse repeats of the same thing, but still buzz the phone.
    renotify: Boolean(payload.tag),
    data: { link: toHashUrl(payload.link) },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/#/app/notifications';
  const target = new URL(link, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Reuse an already-open Vecini window rather than stacking up new ones.
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// Chrome can rotate a subscription; without this the user goes silently dead.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) client.postMessage({ type: 'push-resubscribe' });
    })(),
  );
});
