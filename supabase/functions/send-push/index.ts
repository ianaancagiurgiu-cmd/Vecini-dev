// Vecini — delivers browser push notifications.
//
// Called by the app right after notification rows are created. It re-checks
// everything itself: an authenticated caller may only push to members of a
// community they belong to, and only to users who opted in to push.
//
// Secrets required (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@vecini.app';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const PREF_COLUMN: Record<string, string> = {
  announcement: 'announcements',
  reply: 'replies',
  issue: 'issues',
  poll: 'polls',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'missing bearer token' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Who is calling?
  const { data: userData, error: userErr } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userErr || !userData?.user) return json({ error: 'invalid token' }, 401);
  const callerId = userData.user.id;

  let payload: {
    communityId?: string;
    userIds?: string[];
    type?: string;
    title?: string;
    body?: string;
    link?: string;
    lang?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const { communityId, type = '', title = 'Vecini', body = '', link = '', lang = 'ro' } = payload;
  const requested = Array.isArray(payload.userIds) ? payload.userIds.filter(Boolean) : [];
  if (!communityId) return json({ error: 'communityId required' }, 400);
  if (requested.length === 0) return json({ sent: 0, failed: 0, skipped: 0 });

  // The caller must belong to the community they claim to be notifying.
  const { data: callerMembership } = await admin
    .from('memberships')
    .select('user_id')
    .eq('community_id', communityId)
    .eq('user_id', callerId)
    .maybeSingle();
  if (!callerMembership) return json({ error: 'not a member of this community' }, 403);

  // Recipients must belong to it too — no pushing to arbitrary user ids.
  const { data: members } = await admin
    .from('memberships')
    .select('user_id')
    .eq('community_id', communityId)
    .in('user_id', requested);
  const allowedIds = (members || []).map((m) => m.user_id as string);
  if (allowedIds.length === 0) return json({ sent: 0, failed: 0, skipped: requested.length });

  // Opted in to push at all, and to this category?
  const { data: prefRows } = await admin
    .from('notification_prefs')
    .select('user_id, push, announcements, replies, issues, polls')
    .in('user_id', allowedIds);
  const prefsById = new Map((prefRows || []).map((p) => [p.user_id as string, p]));
  const prefCol = PREF_COLUMN[type];

  const targetIds = allowedIds.filter((id) => {
    const prefs = prefsById.get(id) as Record<string, boolean> | undefined;
    // push defaults to false, so no prefs row means no push.
    if (!prefs || prefs.push !== true) return false;
    if (prefCol && prefs[prefCol] === false) return false;
    return true;
  });
  if (targetIds.length === 0) return json({ sent: 0, failed: 0, skipped: allowedIds.length });

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', targetIds);
  if (!subs || subs.length === 0) return json({ sent: 0, failed: 0, skipped: targetIds.length });

  const message = JSON.stringify({
    title,
    body,
    link: link || '/app/notifications',
    lang,
    tag: type || undefined,
  });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
        message,
        { TTL: 12 * 60 * 60 },
      ),
    ),
  );

  // 404/410 mean the browser threw the subscription away — stop trying forever.
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      sent++;
      return;
    }
    failed++;
    const status = (r.reason as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) expired.push(subs[i].endpoint as string);
    else console.error('push failed', status, String(r.reason));
  });

  if (expired.length) {
    await admin.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return json({ sent, failed, pruned: expired.length });
});
