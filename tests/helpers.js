// Shared helpers + a test fixture for the Vecini flow tests.
import { test as base, expect } from '@playwright/test';

export const DATA_KEY = 'vecini.data.v1';
export const PREF_KEY = 'vecini.prefs.v1';

// Extend the base test so every page blocks external Google Fonts requests.
// In the sandbox those requests hang (no egress), which would make each page
// load take ~14s. The real deployed app loads them normally.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await use(page);
  },
});
export { expect };

// Load the app once and wipe any stored state so every test starts from the
// pristine demo seed (Aleea Castanilor 12).
export async function fresh(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

// Jump straight into the app as a given role. Each test gets an isolated
// browser context, so localStorage starts empty and the app builds a fresh
// demo seed automatically. We set the auth/role prefs via an init script so
// they are present BEFORE the app mounts (and re-applied on reload, without
// wiping any data created during the test).
export async function enterApp(page, { role = 'admin', lang = 'ro' } = {}) {
  await page.addInitScript(({ role, lang, PREF_KEY }) => {
    localStorage.setItem(PREF_KEY, JSON.stringify({ lang, roleOverride: role, authed: true }));
  }, { role, lang, PREF_KEY });
  await page.goto('/#/app');
  await page.waitForSelector('.bottom-nav');
}

// Real login through the UI.
export async function loginViaUI(page, { email = 'ana@exemplu.ro', password = 'parola123' } = {}) {
  await page.goto('/#/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Intră în cont', exact: true }).click();
}

// Navigate the bottom tab bar.
export async function tab(page, label) {
  await page.locator('.bottom-nav a', { hasText: label }).click();
}

/*
  ---------------------------------------------------------------------------
  Reaching a signed-in screen without a live Supabase.

  Everything under /app is gated on a real session and a real community, which
  is why the flow specs are skipped in the sandbox. These two helpers stand in
  for the service: a session is written straight into the storage the client
  reads on start-up, and the REST calls are answered from a table of fixtures.

  It is a stub, not a substitute. It proves what the screens do with a given
  answer, never that Supabase gives that answer.
  ---------------------------------------------------------------------------
*/

import { readFileSync } from 'node:fs';

// The client derives its storage key from the project ref, so the tests have to
// derive it the same way. The build needs this file too, so if it is missing
// there is no app to test either.
export function supabaseRef() {
  try {
    const m = /VITE_SUPABASE_URL=\s*(\S+)/.exec(readFileSync('.env', 'utf8'));
    return m ? new URL(m[1]).hostname.split('.')[0] : null;
  } catch (e) {
    return null;
  }
}

export const FAKE_USER_ID = '11111111-1111-1111-1111-111111111111';
export const FAKE_COMMUNITY_ID = '22222222-2222-2222-2222-222222222222';

export function fakeUser(over = {}) {
  return {
    id: FAKE_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mihai@exemplu.ro',
    email_confirmed_at: '2026-01-01T00:00:00Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Mihai Georgescu' },
    identities: [{ identity_id: 'i1', provider: 'email' }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': '*',
};

/*
  Enough of PostgREST's filtering to be honest about what a query would return.

  Returning every fixture row regardless of the filters is not a shortcut, it is
  a different answer: .maybeSingle() fails outright when handed several rows, so
  a stub that ignores `?user_id=eq...` turns a perfectly good membership check
  into "you belong to nothing" and bounces the test out of the app entirely.
*/
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function matches(row, op, arg) {
  const value = row === undefined ? undefined : row;
  switch (op) {
    case 'eq': return String(value) === arg;
    case 'neq': return String(value) !== arg;
    case 'is': return arg === 'null' ? value === null || value === undefined : String(value) === arg;
    case 'in': {
      const list = arg.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''));
      return list.includes(String(value));
    }
    default: return true; // anything we do not model does not narrow the result
  }
}

function applyQuery(rows, params) {
  let out = rows;
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const [op, ...rest] = raw.split('.');
    const arg = rest.join('.');
    out = out.filter((row) => matches(row[key], op, arg));
  }
  const limit = Number(params.get('limit'));
  if (Number.isFinite(limit) && limit > 0) out = out.slice(0, limit);
  return out;
}

/**
 * Signs the browser in as `user` and answers every REST read from `tables`.
 * Anything not listed answers with an empty list, which is what most of the
 * app's queries expect.
 */
export async function signedInAs(page, { user = fakeUser(), tables = {} } = {}) {
  const ref = supabaseRef();
  if (!ref) throw new Error('no VITE_SUPABASE_URL in .env, cannot fake a session');

  await page.addInitScript(({ ref, user }) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: 'stub', token_type: 'bearer', expires_in: 999999,
      expires_at: Math.floor(Date.now() / 1000) + 999999,
      refresh_token: 'stub', user,
    }));
  }, { ref, user });

  const fixtures = {
    profiles: [{ id: user.id, full_name: user.user_metadata.full_name, apartment: 'Ap. 12', avatar_color: '#8c3c52' }],
    memberships: [{ id: 'm1', user_id: user.id, community_id: FAKE_COMMUNITY_ID, role: 'member', joined_at: '2026-01-01T00:00:00Z' }],
    communities: [{ id: FAKE_COMMUNITY_ID, name: 'Aleea Teilor 15-20', kind: 'bloc', staircases: 1, member_count: 16, code: 'TEILOR-15' }],
    ...tables,
  };

  await page.route(/\/rest\/v1\//, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });

    const url = new URL(req.url());
    const table = url.pathname.split('/rest/v1/')[1].split('?')[0];
    const rows = applyQuery(fixtures[table] || [], url.searchParams);
    // PostgREST answers a single object, not a list, when the caller asked for
    // one — which is how .single() / .maybeSingle() are sent over the wire.
    const wantsOne = (req.headers()['accept'] || '').includes('pgrst.object');
    const body = wantsOne ? (rows[0] ?? null) : rows;

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      // A counted query reads its total from this header, not from the body,
      // and head:true means there is no body to read anyway.
      headers: { ...CORS, 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(body),
    });
  });
}

/** Answers one auth endpoint, e.g. auth('PUT', 'user', {...}). */
export async function stubAuth(page, path, handler) {
  await page.route(new RegExp(`/auth/v1/${path}`), (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS, body: '' });
    const { status = 200, body = {} } = handler(req) || {};
    return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
  });
}
