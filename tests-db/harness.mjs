/*
  The database, tested as the database.

  The Playwright suite answers "what does the screen do with this answer?" and
  says so in its own header: it is a stub, it never proves that Supabase gives
  that answer. Whether a neighbour in one association can read another's
  notices is not a question about screens at all. It is decided by row-level
  security, and the only honest way to test a policy is to be the person it is
  supposed to stop, against a real PostgreSQL, with the real migrations.

  So: every migration in supabase/ is loaded, in order, into a throwaway
  database; two communities are seeded; and each scenario runs as a named
  person — `set local role authenticated`, with their id in the claim that
  auth.uid() reads — inside a transaction that is rolled back afterwards.
  Nothing a scenario does survives it, which is what lets one of them delete
  an account and the next one still find that person in the building.

  A scenario asserts what the documentation promises, not what the code
  happens to do. Where the two disagree the scenario fails, and once that has
  been looked at and found to be the code that is wrong, it is marked `gap`:
  still run on every pass, still expected to fail, and reported loudly on the
  day it stops failing — which is the day the gap was closed and the mark
  should come off.
*/
import pg from 'pg';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { KNOWN } from './known-problems.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DB = process.env.VECINI_TEST_DB || 'vecini_test';
const conn = (database) => ({
  host: process.env.PGHOST || '/var/run/postgresql',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER || userInfo().username,
  password: process.env.PGPASSWORD || undefined,
  database,
});

// ---------------------------------------------------------------------------
// Who lives where. Fixed ids, so a failing assertion names a person.
// ---------------------------------------------------------------------------
const u = (prefix, n) => `${prefix}0000000-0000-4000-8000-00000000000${n}`;
export const U = {
  ana: u('a', 1),     // A — administrator
  mihai: u('a', 2),   // A — moderator
  ioana: u('a', 3),   // A — vecin
  dan: u('a', 4),     // A — vecin
  bogdan: u('b', 1),  // B — administrator
  carmen: u('b', 2),  // B — vecin
  maria: u('c', 1),   // vecin și în A, și în B
  radu: u('d', 1),    // are cont, nu e în nicio comunitate
};
export const NAMES = {
  ana: 'Ana Pop', mihai: 'Mihai Georgescu', ioana: 'Ioana Rusu', dan: 'Dan Marin',
  bogdan: 'Bogdan Ilie', carmen: 'Carmen Dobre', maria: 'Maria Stan', radu: 'Radu Neagu',
};
export const C = {
  A: 'aaaaaaaa-0000-4000-8000-00000000000a',
  B: 'bbbbbbbb-0000-4000-8000-00000000000b',
};
const s = (prefix, n) => `${prefix}-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
// Seeded rows, by community. Named for what they are.
export const A = {
  ann: s('a1000000', 1), disc: s('a2000000', 1), discHidden: s('a2000000', 2), reply: s('a2100000', 1),
  issue: s('a3000000', 1), comment: s('a3100000', 1), commentOld: s('a3100000', 2),
  poll: s('a4000000', 1), opt1: s('a4100000', 1), opt2: s('a4100000', 2),
  pollClosed: s('a4000000', 2), optClosed: s('a4100000', 3),
  pollExpired: s('a4000000', 3), optExpired: s('a4100000', 4),
  pollMulti: s('a4000000', 4), optM1: s('a4100000', 5), optM2: s('a4100000', 6),
  fund: s('a5000000', 1), fundClosed: s('a5000000', 2), doc: s('a6000000', 1),
  docPath: `${C.A}/pv-august.pdf`, photoPath: `${C.A}/${U.ioana}-1.jpg`,
};
export const B = {
  ann: s('b1000000', 1), disc: s('b2000000', 1), reply: s('b2100000', 1),
  issue: s('b3000000', 1), comment: s('b3100000', 1),
  poll: s('b4000000', 1), opt1: s('b4100000', 1), opt2: s('b4100000', 2),
  fund: s('b5000000', 1), doc: s('b6000000', 1),
  docPath: `${C.B}/contract.pdf`, photoPath: `${C.B}/${U.carmen}-1.jpg`,
};

async function seed(c) {
  for (const [key, id] of Object.entries(U)) {
    await c.query(
      `insert into auth.users (id, email, raw_user_meta_data, encrypted_password, phone)
       values ($1, $2, $3, 'hash', null)`,
      [id, `${key}@exemplu.ro`, JSON.stringify({ full_name: NAMES[key] })],
    );
    await c.query('insert into auth.identities (user_id, identity_data) values ($1, $2)', [id, JSON.stringify({ email: `${key}@exemplu.ro` })]);
  }
  await c.query(`update public.profiles set apartment = 'Ap. 12' where id = $1`, [U.ioana]);
  await c.query(`update public.profiles set apartment = 'Casa 3' where id = $1`, [U.carmen]);

  await c.query(
    `insert into public.communities (id, name, address, description, code, kind) values
       ($1, 'Aleea Teilor 15-20', 'Aleea Teilor 15', 'Asociația de proprietari', 'TEILOR-15', 'bloc'),
       ($2, 'Strada Popești 8', 'Str. Popești 8', '', 'POPESTI-8', 'houses')`,
    [C.A, C.B],
  );
  // The first to arrive is made admin by the trigger; the rest are members,
  // whatever is asked for, so the moderator is promoted afterwards.
  const join = async (user, community, minutesAgo) => c.query(
    `insert into public.memberships (user_id, community_id, joined_at) values ($1, $2, now() - ($3 || ' minutes')::interval)`,
    [user, community, minutesAgo],
  );
  await join(U.ana, C.A, 1000); await join(U.mihai, C.A, 900); await join(U.ioana, C.A, 800);
  await join(U.dan, C.A, 700); await join(U.maria, C.A, 600);
  await join(U.bogdan, C.B, 1000); await join(U.carmen, C.B, 900); await join(U.maria, C.B, 800);
  await c.query(`update public.memberships set role = 'moderator' where user_id = $1 and community_id = $2`, [U.mihai, C.A]);

  // ---- A ----
  await c.query(
    `insert into public.announcements (id, community_id, author_id, title, body, pinned_until, starts_at, all_day, location)
     values ($1, $2, $3, 'Apa caldă se oprește joi', 'Se înlocuiește o vană.', now() + interval '3 days', now() + interval '2 days', true, 'Scara A')`,
    [A.ann, C.A, U.ana]);
  await c.query(
    `insert into public.discussions (id, community_id, author_id, title, body, status) values
       ($1, $3, $4, 'Idei pentru curte', 'Ce ziceți de niște bănci?', 'approved'),
       ($2, $3, $5, 'Vecinul de la 14', 'Text ascuns de moderator.', 'hidden')`,
    [A.disc, A.discHidden, C.A, U.ioana, U.dan]);
  await c.query(`insert into public.discussion_replies (id, discussion_id, author_id, body) values ($1, $2, $3, 'De acord.')`, [A.reply, A.disc, U.dan]);
  await c.query(
    `insert into public.issues (id, community_id, reporter_id, title, category, location, description, photo_path)
     values ($1, $2, $3, 'Liftul se oprește', 'other', 'Scara A', 'Între etajele 3 și 4.', $4)`,
    [A.issue, C.A, U.ioana, A.photoPath]);
  await c.query(`insert into public.issue_history (issue_id, status, note, by_id) values ($1, 'new', 'Sesizare trimisă', $2)`, [A.issue, U.ioana]);
  await c.query(
    `insert into public.issue_comments (id, issue_id, author_id, body, created_at) values
       ($1, $3, $4, 'Am sunat la firma de lift.', now() - interval '2 minutes'),
       ($2, $3, $5, 'Se întâmplă de o săptămână.', now() - interval '20 minutes')`,
    [A.comment, A.commentOld, A.issue, U.dan, U.ioana]);
  await c.query(`insert into public.issue_supporters (issue_id, user_id) values ($1, $2)`, [A.issue, U.dan]);
  await c.query(`insert into public.reactions (issue_comment_id, user_id) values ($1, $2)`, [A.comment, U.ioana]);

  await c.query(
    `insert into public.polls (id, community_id, author_id, question, multi, closed, ends_at) values
       ($1, $5, $6, 'Schimbăm poarta?', false, false, now() + interval '5 days'),
       ($2, $5, $6, 'Vopsim scara?', false, true, now() + interval '5 days'),
       ($3, $5, $6, 'Reparăm acoperișul?', false, false, now() - interval '1 day'),
       ($4, $5, $6, 'Ce plantăm în curte?', true, false, now() + interval '5 days')`,
    [A.poll, A.pollClosed, A.pollExpired, A.pollMulti, C.A, U.ana]);
  await c.query(
    `insert into public.poll_options (id, poll_id, label) values
       ($1, $7, 'Da'), ($2, $7, 'Nu'), ($3, $8, 'Da'), ($4, $9, 'Da'), ($5, $10, 'Tei'), ($6, $10, 'Trandafiri')`,
    [A.opt1, A.opt2, A.optClosed, A.optExpired, A.optM1, A.optM2, A.poll, A.pollClosed, A.pollExpired, A.pollMulti]);
  await c.query(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt1, U.ioana]);

  await c.query(
    `insert into public.funds (id, community_id, title, amount_bani, created_by, closed_at) values
       ($1, $3, 'Reparație acoperiș', 25000, $4, null),
       ($2, $3, 'Poarta veche', 10000, $4, now() - interval '30 days')`,
    [A.fund, A.fundClosed, C.A, U.ana]);
  await c.query(`insert into public.fund_quotas (fund_id, user_id, amount_bani) values ($1, $2, 0)`, [A.fund, U.dan]);
  await c.query(
    `insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by, note) values
       ($1, $2, 10000, $4, 'prima rată'), ($1, $3, 25000, $4, '')`,
    [A.fund, U.ioana, U.mihai, U.ana]);
  await c.query(
    `insert into public.documents (id, community_id, title, kind, path, mime, size_bytes, fund_id, uploaded_by)
     values ($1, $2, 'Proces-verbal august', 'minutes', $3, 'application/pdf', 240000, $4, $5)`,
    [A.doc, C.A, A.docPath, A.fund, U.ana]);
  await c.query(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2), ('issue-photos', $3, $4)`, [A.docPath, U.ana, A.photoPath, U.ioana]);

  await c.query(
    `insert into public.member_phones (user_id, phone, visible) values
       ($1, '0711 000 001', true), ($2, '0722 000 003', false), ($3, '0733 000 004', true),
       ($4, '0744 000 101', true), ($5, '0755 000 102', true)`,
    [U.ana, U.ioana, U.dan, U.bogdan, U.carmen]);
  await c.query(
    `insert into public.notifications (community_id, user_id, type, title, body, link) values
       ($1, $2, 'issue', 'Comentariu nou', 'Am sunat la firma de lift.', '/app/issues/x'),
       ($1, $3, 'announcement', 'Anunț nou', 'Apa caldă', '/app/announcements/x'),
       ($4, $5, 'announcement', 'Anunț nou', 'Gunoiul', '/app/announcements/y')`,
    [C.A, U.ioana, U.ana, C.B, U.carmen]);
  await c.query(`insert into public.notification_prefs (user_id, announcements, funds, push) values ($1, false, false, true)`, [U.dan]);
  await c.query(`insert into public.archived_items (user_id, kind, item_id) values ($1, 'announcement', $2)`, [U.ioana, A.ann]);
  await c.query(`insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example/ioana', $1, 'k', 'a')`, [U.ioana]);

  // ---- B ----
  await c.query(`insert into public.announcements (id, community_id, author_id, title, body) values ($1, $2, $3, 'Se ridică gunoiul marți', 'Scoateți pubelele.')`, [B.ann, C.B, U.bogdan]);
  await c.query(`insert into public.discussions (id, community_id, author_id, title, body) values ($1, $2, $3, 'Asfaltarea străzii', 'Când începe?')`, [B.disc, C.B, U.carmen]);
  await c.query(`insert into public.discussion_replies (id, discussion_id, author_id, body) values ($1, $2, $3, 'Din octombrie.')`, [B.reply, B.disc, U.bogdan]);
  await c.query(
    `insert into public.issues (id, community_id, reporter_id, title, description, photo_path) values ($1, $2, $3, 'Groapă în fața casei 3', 'S-a adâncit.', $4)`,
    [B.issue, C.B, U.carmen, B.photoPath]);
  await c.query(`insert into public.issue_history (issue_id, status, note, by_id) values ($1, 'new', 'Sesizare trimisă', $2)`, [B.issue, U.carmen]);
  await c.query(`insert into public.issue_comments (id, issue_id, author_id, body) values ($1, $2, $3, 'Am anunțat primăria.')`, [B.comment, B.issue, U.bogdan]);
  await c.query(`insert into public.polls (id, community_id, author_id, question, ends_at) values ($1, $2, $3, 'Punem barieră?', now() + interval '5 days')`, [B.poll, C.B, U.bogdan]);
  await c.query(`insert into public.poll_options (id, poll_id, label) values ($1, $3, 'Da'), ($2, $3, 'Nu')`, [B.opt1, B.opt2, B.poll]);
  await c.query(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [B.poll, B.opt2, U.carmen]);
  await c.query(`insert into public.funds (id, community_id, title, amount_bani, created_by) values ($1, $2, 'Barieră', 50000, $3)`, [B.fund, C.B, U.bogdan]);
  await c.query(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 50000, $3)`, [B.fund, U.carmen, U.bogdan]);
  await c.query(
    `insert into public.documents (id, community_id, title, kind, path, uploaded_by) values ($1, $2, 'Contract barieră', 'contract', $3, $4)`,
    [B.doc, C.B, B.docPath, U.bogdan]);
  await c.query(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2), ('issue-photos', $3, $4)`, [B.docPath, U.bogdan, B.photoPath, U.carmen]);
}

export async function setup() {
  const admin = new pg.Client(conn('postgres'));
  await admin.connect();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.query(`create database ${DB}`);
  await admin.end();

  const c = new pg.Client(conn(DB));
  await c.connect();
  await c.query('set client_min_messages = warning');
  await c.query(readFileSync(here('./shim.sql'), 'utf8'));
  const dir = here('../supabase/');
  const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
  /*
    VECINI_TEST_PASSES=2 applies the whole sequence twice before anything is
    seeded. Every migration says "safe to run more than once", and the bundle
    Iana pastes is all of them in order — so the claim worth checking is not
    that one file survives itself, but that running everything again leaves
    the rules exactly where a single run does. Some early files recreate a
    policy a later one tightened; in order, the later one always has the last
    word, and this is what proves it.
  */
  const passes = Number(process.env.VECINI_TEST_PASSES || 1);
  for (let pass = 0; pass < passes; pass++) {
    for (const f of files) {
      try { await c.query(readFileSync(dir + f, 'utf8')); } catch (e) { throw new Error(`${f} (trecerea ${pass + 1}): ${e.message}`); }
    }
  }
  /*
    For checking the checker: a file of SQL applied on top of the migrations,
    used to break one policy on purpose and watch the right scenarios go red.
    A suite that has only ever been seen passing has not been tested itself.
  */
  if (process.env.VECINI_TEST_SABOTAGE) await c.query(readFileSync(process.env.VECINI_TEST_SABOTAGE, 'utf8'));
  await seed(c);
  return { client: c, migrations: files };
}

// ---------------------------------------------------------------------------
// Scenarios.
// ---------------------------------------------------------------------------
export const registry = [];
let currentArea = null;
export function area(code, title, intro = '') { currentArea = { code, title, intro }; }
/*
  id        — stable, quoted in the report: "IZO-07"
  title     — what is attempted, in Romanian, as a sentence somebody could do
  expected  — what the documentation says must happen
  gap       — not passed here: looked up in known-problems.mjs once a failure
              has been confirmed as a real defect
  opts.decide — the scenario passes, pinning what happens today, but what
              happens today is nowhere written down as intended: a question
              for whoever owns the product, not a defect
  opts.doc  — where the rule being tested is written down
*/
export function scenario(id, title, expected, fn, opts = {}) {
  registry.push({ id, title, expected, fn, area: currentArea, gap: KNOWN[id] || null, ...opts });
}

class Actor {
  constructor(client, role, uid, label) { this.c = client; this.role = role; this.uid = uid; this.label = label; }
  /*
    Never throws. Under RLS "no" has two shapes — an error for an insert that
    fails its check, and silently nothing for a select, update or delete that
    matched no visible row — so the caller gets both and says which it expects.
  */
  async run(sql, params = []) {
    const c = this.c;
    await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [this.uid || '']);
    await c.query('savepoint actor');
    await c.query(`set local role ${this.role}`);
    try {
      const r = await c.query(sql, params);
      await c.query('reset role');
      await c.query('release savepoint actor');
      return { ok: true, rows: r.rows, rowCount: r.rowCount, error: null };
    } catch (error) {
      await c.query('rollback to savepoint actor');
      await c.query('reset role');
      return { ok: false, rows: [], rowCount: 0, error };
    }
  }
  async rows(sql, params) {
    const r = await this.run(sql, params);
    if (r.error) throw new Error(`${this.label}: ${r.error.message}\n  ${sql}`);
    return r.rows;
  }
  async count(sql, params) { return (await this.rows(sql, params)).length; }
}

export function expectBlocked(r, what = 'operația') {
  assert.ok(r.error || r.rowCount === 0, `${what} trebuia refuzată, dar a trecut (${r.rowCount} rând/uri)`);
}
export function expectError(r, pattern, what = 'operația') {
  assert.ok(r.error, `${what} trebuia să dea eroare, dar a trecut`);
  if (pattern) assert.match(r.error.message, pattern, `${what}: altă eroare decât cea așteptată`);
}
export function expectOk(r, n, what = 'operația') {
  assert.ok(!r.error, `${what} trebuia să reușească: ${r.error?.message}`);
  if (n !== undefined) assert.equal(r.rowCount, n, `${what}: număr de rânduri`);
}

export async function runAll(client, { only } = {}) {
  const results = [];
  for (const sc of registry) {
    if (only && !only.test(sc.id)) continue;
    const ctx = {
      as: (uid) => new Actor(client, 'authenticated', uid, Object.keys(U).find((k) => U[k] === uid) || uid),
      anon: () => new Actor(client, 'anon', '', 'anonim'),
      // The truth, read without any policy in the way.
      sql: async (sql, params = []) => (await client.query(sql, params)).rows,
    };
    let failure = null;
    await client.query('begin');
    try { await sc.fn(ctx); } catch (e) { failure = e; }
    await client.query('rollback');
    await client.query('reset role');

    let outcome;
    if (!failure) outcome = sc.gap ? 'INCHIS' : 'OK';
    else if (sc.gap) outcome = 'PROBLEMA';
    else outcome = 'ESEC';
    results.push({
      id: sc.id, area: sc.area, title: sc.title, expected: sc.expected, doc: sc.doc || null,
      outcome, gap: sc.gap || null, decide: sc.decide || null,
      detail: failure ? String(failure.message).split('\n')[0] : null,
    });
  }
  return results;
}

export { assert };
