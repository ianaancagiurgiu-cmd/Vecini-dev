/*
  Serves the real app the demo community instead of Supabase.

  The same stub the test suite uses, lifted here and given a signed-in session,
  so the recording shows genuine screens rendering genuine components — only the
  rows behind them are invented.
*/
import { readFileSync } from 'node:fs';
import { TABLES, CID, ME, ME_PROFILE, communities } from './data.mjs';

const ref = new URL(/VITE_SUPABASE_URL=\s*(\S+)/.exec(readFileSync('.env', 'utf8'))[1]).hostname.split('.')[0];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function applyQuery(rows, params) {
  let out = rows;
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const [op, ...rest] = raw.split('.');
    const arg = rest.join('.');
    out = out.filter((row) => {
      const v = row[key];
      if (op === 'eq') return String(v) === arg;
      if (op === 'neq') return String(v) !== arg;
      if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v));
      return true;
    });
  }
  const limit = Number(params.get('limit'));
  if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);
  return out;
}

export const SESSION_USER = {
  id: ME, aud: 'authenticated', role: 'authenticated', email: 'mihai@exemplu.ro',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: ME_PROFILE.full_name },
  identities: [{ identity_id: 'i1', provider: 'email' }],
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

/** @param {import('@playwright/test').Page} page */
export async function serveCommunity(page, { signedIn = true } = {}) {
  if (signedIn) {
    await page.addInitScript(({ ref, user }) => {
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
        access_token: 'demo', token_type: 'bearer', expires_in: 999999,
        expires_at: Math.floor(Date.now() / 1000) + 999999, refresh_token: 'demo', user,
      }));
    }, { ref, user: SESSION_USER });
  }
  // The active community, so the app does not have to guess on first paint.
  await page.addInitScript((cid) => localStorage.setItem('vecini.activeCommunity.v1', cid), CID);

  await page.route(/\/rest\/v1\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    // Writes are accepted and dropped: nothing in the recording should persist.
    if (!['GET', 'HEAD'].includes(req.method())) {
      return route.fulfill({ status: 201, contentType: 'application/json', headers: CORS, body: '[]' });
    }
    const url = new URL(req.url());
    const table = url.pathname.split('/rest/v1/')[1].split('?')[0];
    const rows = applyQuery(TABLES[table] || [], url.searchParams);
    const wantsOne = (req.headers()['accept'] || '').includes('pgrst.object');
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { ...CORS, 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(wantsOne ? (rows[0] ?? null) : rows),
    });
  });

  /*
    Looking a community up by its invitation code, which the join screen does
    before anyone has an account.

    Registered after the catch-all on purpose: Playwright tries the most
    recently added route first, so a specific handler put in front of a general
    one never runs. This one is a POST, which the catch-all would otherwise
    swallow as a write and answer with an empty list — leaving the join screen
    saying the code is invalid.
  */
  await page.route(/\/rest\/v1\/rpc\/community_by_code/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const asked = (JSON.parse(req.postData() || '{}').p_code || '').trim().toLowerCase();
    const hit = communities.filter((c) => c.code.toLowerCase() === asked)
      .map((c) => ({ id: c.id, name: c.name, address: c.address, code: c.code, member_count: TABLES.memberships.length }));
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(hit) });
  });

  await page.route(/\/auth\/v1\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(SESSION_USER) });
  });
}
