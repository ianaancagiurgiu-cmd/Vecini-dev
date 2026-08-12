# Push notifications — what's built and what still needs doing

Everything in the app and database is finished. Three setup steps remain, and
they all need account access that only the project owner has.

## Important: push needs the whole `dist/` folder deployed

The live site is currently published as a **single HTML file**
(`deploy/vecini.html`). Push cannot work that way, and this is not a
limitation that can be coded around: a browser will only accept a service
worker that is served as its own file from the site root (`/sw.js`), and a
one-file bundle has no other files. The manifest (`/manifest.webmanifest`)
and the icons have the same requirement.

So the site must be published as a normal multi-file build — the contents of
`dist/` — before any of the following matters. The simplest way is to link the
GitHub repository to Netlify so it builds on every push (Netlify project →
Build & deploy → Continuous deployment → Repository → Link repository).

## Step 1 — run the database migration

In the Supabase dashboard: **SQL Editor** → paste the contents of
`supabase/0002_push.sql` → Run. It is safe to run more than once.

This adds the `push_subscriptions` table and the `notify_members` /
`notify_user` functions that make the notification preference toggles real.

> Note: until this migration runs, posting an announcement will fail, because
> the app now calls `notify_members` instead of inserting notification rows
> directly. Run it at the same time as deploying the new build.

## Step 2 — set the VAPID keys

Push messages are signed with a VAPID key pair. The pair for this project was
generated already; the private key is **not** stored in this repository
because the repository is public.

The public key is not a secret — it ships inside the browser bundle by design —
so it is recorded here for convenience:

```
BJDjEx6c_8U-VluF4qPWKvou8IfgUIYe1HDgGXlIrD7gpw_p0FhUuwMqcQDRhtJL_ociRnU8Txc9x4vQhjG5BPg
```

It goes in the site build, as a Netlify environment variable:

```
VITE_VAPID_PUBLIC_KEY = BJDjEx6c_8U-VluF4qPWKvou8IfgUIYe1HDgGXlIrD7gpw_p0FhUuwMqcQDRhtJL_ociRnU8Txc9x4vQhjG5BPg
```

The private key goes to Supabase, where the Edge Function can reach it and
nobody else can:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="<public key>" \
  VAPID_PRIVATE_KEY="<private key>" \
  VAPID_SUBJECT="mailto:you@yourdomain.com"
```

These can also be set in the Supabase dashboard under
**Project Settings → Edge Functions → Secrets**.

`VAPID_SUBJECT` must be a real `mailto:` address or an https URL — push
services use it to contact you if something is wrong with your sending.

If the keys are ever lost, generate a new pair with `node scripts/gen-vapid.mjs`.
Changing the pair invalidates every existing subscription; the app detects the
mismatch and re-subscribes each device automatically on next open.

## Step 3 — deploy the Edge Function

```bash
supabase functions deploy send-push --project-ref <your-project-ref>
```

Or paste `supabase/functions/send-push/index.ts` into the dashboard editor
("Deploy a new function" → "Via Editor").

**Mind the name.** The dashboard pre-fills an auto-generated name such as
`swift-api`, and whatever it is deployed as is what the app must call. On the
live project the function ended up named `swift-api`, so that is the default in
`src/state/store.jsx`. If you redeploy it under a different name, set
`VITE_PUSH_FUNCTION` in Netlify to match — otherwise the app calls a function
that does not exist, and because `functions.invoke` reports HTTP failures
through its return value rather than by throwing, the only sign is a console
error.

## How it fits together

1. Someone posts an announcement.
2. The app calls the `notify_members` database function, which writes
   in-app notification rows **only** for members who haven't muted that
   category, and returns who it notified.
3. The app calls the `send-push` Edge Function with that list.
4. The function checks each user opted in to push, looks up their device
   subscriptions, and sends the message.
5. The service worker (`public/sw.js`) shows the notification and, on tap,
   focuses an existing Vecini window or opens a new one at the right screen.

Preference filtering happens in the database on purpose: row-level security
correctly stops the browser from reading other members' preferences, so the
client cannot decide who wants what.

## iPhone / iPad

Web push on iOS only works for apps added to the home screen — a Safari tab
gets nothing, and there is no way to prompt for this automatically. The
notification settings screen detects this and shows instructions instead of a
toggle that would silently fail.

Practically: iPhone users must open the site in Safari, tap Share, then
"Add to Home Screen", open Vecini from that icon, and only then enable
notifications. Android and desktop Chrome need no install step.

## Testing

`tests/13-push.spec.js` covers the manifest, the icons, the service worker
registering and activating in a real browser, and the service worker's push
and notification-click handling. Delivery itself (Supabase → FCM/APNs) is not
covered, because it needs deployed secrets and outbound network access.

Run with `npm test`.
