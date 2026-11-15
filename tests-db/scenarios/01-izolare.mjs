import { area, scenario, assert, expectBlocked, expectError, U, C, A, B } from '../harness.mjs';

/*
  One community must not see into another.

  Carmen lives on Strada Popești (B). Everything below is Carmen, or her
  administrator Bogdan, trying to reach Aleea Teilor (A) — by reading, by
  writing, and by the functions that run with more rights than she has.
  Bogdan matters as much as Carmen: being staff somewhere must not make
  anybody staff everywhere.
*/
area('IZO', 'Izolarea între comunități',
  'Carmen și Bogdan locuiesc pe Strada Popești (B). Niciunul nu are ce căuta în datele de pe Aleea Teilor (A) — nici ca vecin, nici ca administrator al altei comunități.');

const DOC_RLS = 'Studiu de caz, „Tehnologie”: autorizarea stă în baza de date, ca o regulă să nu poată fi ocolită de nimic care ajunge la date pe altă cale.';

// ---- reading -------------------------------------------------------------
const READS = [
  ['announcements', `select id from public.announcements where community_id = $1`, 'anunțurile'],
  ['discussions', `select id from public.discussions where community_id = $1`, 'discuțiile'],
  ['discussion_replies', `select r.id from public.discussion_replies r where r.discussion_id = '${A.disc}' and $1::uuid is not null`, 'răspunsurile din discuții'],
  ['issues', `select id from public.issues where community_id = $1`, 'sesizările'],
  ['issue_comments', `select id from public.issue_comments where issue_id = '${A.issue}' and $1::uuid is not null`, 'comentariile de la sesizări'],
  ['issue_history', `select id from public.issue_history where issue_id = '${A.issue}' and $1::uuid is not null`, 'istoricul sesizărilor'],
  ['issue_supporters', `select user_id from public.issue_supporters where issue_id = '${A.issue}' and $1::uuid is not null`, 'cine susține o sesizare'],
  ['polls', `select id from public.polls where community_id = $1`, 'sondajele'],
  ['poll_options', `select id from public.poll_options where poll_id = '${A.poll}' and $1::uuid is not null`, 'variantele de vot'],
  ['poll_votes', `select user_id from public.poll_votes where poll_id = '${A.poll}' and $1::uuid is not null`, 'voturile'],
  ['funds', `select id from public.funds where community_id = $1`, 'fondurile'],
  ['fund_payments', `select id from public.fund_payments where fund_id = '${A.fund}' and $1::uuid is not null`, 'plățile la fonduri'],
  ['fund_quotas', `select user_id from public.fund_quotas where fund_id = '${A.fund}' and $1::uuid is not null`, 'sumele individuale la fonduri'],
  ['documents', `select id from public.documents where community_id = $1`, 'documentele'],
  ['memberships', `select user_id from public.memberships where community_id = $1`, 'lista de membri'],
  ['reactions', `select id from public.reactions where issue_comment_id = '${A.comment}' and $1::uuid is not null`, 'aprecierile'],
  ['deleted_accounts', `select id from public.deleted_accounts where community_id = $1`, 'evidența conturilor șterse'],
];
READS.forEach(([table, sql, what], i) => {
  const n = String(i + 1).padStart(2, '0');
  scenario(`IZO-${n}`, `Un vecin din B încearcă să citească ${what} comunității A`,
    'Nu primește niciun rând.',
    async ({ as }) => {
      assert.equal(await as(U.carmen).count(sql, [C.A]), 0, `Carmen (B) vede ${table} din A`);
      // Staff in B is still nobody in A.
      assert.equal(await as(U.bogdan).count(sql, [C.A]), 0, `Bogdan (admin B) vede ${table} din A`);
      // And somebody with an account but no community sees nothing at all.
      assert.equal(await as(U.radu).count(sql, [C.A]), 0, `Radu (fără comunitate) vede ${table} din A`);
    }, { doc: DOC_RLS });
});

scenario('IZO-18', 'Fără niciun filtru, un vecin din B cere „toate” rândurile din fiecare tabel',
  'Primește doar rândurile comunității lui — niciunul din A.',
  async ({ as, sql }) => {
    const byCommunity = ['announcements', 'discussions', 'issues', 'polls', 'funds', 'documents', 'memberships'];
    for (const t of byCommunity) {
      const rows = await as(U.carmen).rows(`select community_id from public.${t}`);
      assert.ok(rows.length > 0, `${t}: Carmen ar trebui să-și vadă propria comunitate`);
      assert.ok(rows.every((r) => r.community_id === C.B), `${t}: printre rândurile lui Carmen sunt și din altă comunitate`);
    }
    // Tables that reach their community through a parent.
    const truth = await sql(`select id from public.issue_comments where issue_id = $1`, [A.issue]);
    const seen = (await as(U.carmen).rows(`select id from public.issue_comments`)).map((r) => r.id);
    assert.ok(truth.every((r) => !seen.includes(r.id)), 'comentarii din A în lista lui Carmen');
    const votes = await as(U.carmen).rows(`select poll_id from public.poll_votes`);
    assert.ok(votes.every((v) => v.poll_id === B.poll), 'voturi din A în lista lui Carmen');
    const pays = await as(U.bogdan).rows(`select fund_id from public.fund_payments`);
    assert.ok(pays.every((p) => p.fund_id === B.fund), 'plăți din A în lista lui Bogdan');
  }, { doc: DOC_RLS });

scenario('IZO-19', 'Un vecin care e în ambele comunități cere datele fiecăreia',
  'Le vede pe amândouă, fiecare separat, și nimic nu se amestecă între ele.',
  async ({ as }) => {
    const m = as(U.maria);
    const anns = await m.rows(`select id, community_id from public.announcements`);
    assert.deepEqual(anns.map((r) => r.community_id).sort(), [C.A, C.B].sort());
    assert.equal(await m.count(`select id from public.announcements where community_id = $1`, [C.A]), 1);
    assert.equal(await m.count(`select id from public.announcements where community_id = $1`, [C.B]), 1);
    // Belonging to both gives her no staff rights in either.
    expectBlocked(await m.run(`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.A, U.maria]));
    expectBlocked(await m.run(`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.B, U.maria]));
  }, { doc: DOC_RLS });

// ---- writing into the other community -------------------------------------
scenario('IZO-20', 'Un vecin din B încearcă să scrie o discuție, o sesizare și un comentariu în A',
  'Toate trei sunt refuzate.',
  async ({ as, sql }) => {
    const c = as(U.carmen);
    expectError(await c.run(`insert into public.discussions (community_id, author_id, title, body) values ($1, $2, 'Bună', 'Sunt din B')`, [C.A, U.carmen]), /row-level security/);
    expectError(await c.run(`insert into public.issues (community_id, reporter_id, title, description) values ($1, $2, 'x', 'y')`, [C.A, U.carmen]), /row-level security/);
    expectError(await c.run(`insert into public.issue_comments (issue_id, author_id, body) values ($1, $2, 'din B')`, [A.issue, U.carmen]), /row-level security/);
    expectError(await c.run(`insert into public.discussion_replies (discussion_id, author_id, body) values ($1, $2, 'din B')`, [A.disc, U.carmen]), /row-level security/);
    assert.equal((await sql(`select count(*)::int n from public.issue_comments where author_id = $1 and issue_id = $2`, [U.carmen, A.issue]))[0].n, 0);
  }, { doc: DOC_RLS });

scenario('IZO-21', 'Administratorul din B încearcă să publice un anunț, un sondaj, un fond și un document în A',
  'Toate sunt refuzate: e administrator doar la el acasă.',
  async ({ as }) => {
    const b = as(U.bogdan);
    expectError(await b.run(`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'Anunț fals', 'x')`, [C.A, U.bogdan]), /row-level security/);
    expectError(await b.run(`insert into public.polls (community_id, author_id, question, ends_at) values ($1, $2, 'x?', now() + interval '1 day')`, [C.A, U.bogdan]), /row-level security/);
    expectError(await b.run(`insert into public.funds (community_id, title, amount_bani, created_by) values ($1, 'x', 100, $2)`, [C.A, U.bogdan]), /row-level security/);
    expectError(await b.run(`insert into public.documents (community_id, title, path, uploaded_by) values ($1, 'x', $3, $2)`, [C.A, U.bogdan, `${C.A}/x.pdf`]), /row-level security/);
    expectError(await b.run(`insert into public.poll_options (poll_id, label) values ($1, 'A treia variantă')`, [A.poll]), /row-level security/);
  }, { doc: DOC_RLS });

scenario('IZO-22', 'Administratorul din B încearcă să modifice sau să șteargă conținut din A',
  'Nimic nu se schimbă în A.',
  async ({ as, sql }) => {
    const b = as(U.bogdan);
    const tries = [
      [`update public.announcements set title = 'spart' where id = $1`, [A.ann]],
      [`delete from public.announcements where id = $1`, [A.ann]],
      [`update public.discussions set status = 'hidden' where id = $1`, [A.disc]],
      [`update public.issues set status = 'resolved' where id = $1`, [A.issue]],
      [`update public.polls set closed = true where id = $1`, [A.poll]],
      [`update public.funds set amount_bani = 1 where id = $1`, [A.fund]],
      [`delete from public.funds where id = $1`, [A.fund]],
      [`delete from public.fund_payments where fund_id = $1`, [A.fund]],
      [`update public.fund_quotas set amount_bani = 999999 where fund_id = $1`, [A.fund]],
      [`delete from public.documents where id = $1`, [A.doc]],
      [`update public.communities set name = 'Preluată' where id = $1`, [C.A]],
      [`update public.memberships set role = 'member' where community_id = $1`, [C.A]],
      [`delete from public.memberships where community_id = $1`, [C.A]],
      [`delete from public.issue_supporters where issue_id = $1`, [A.issue]],
      [`delete from public.reactions where issue_comment_id = $1`, [A.comment]],
    ];
    for (const [q, p] of tries) expectBlocked(await b.run(q, p), q);
    const [ann] = await sql(`select title from public.announcements where id = $1`, [A.ann]);
    assert.equal(ann.title, 'Apa caldă se oprește joi');
    assert.equal((await sql(`select count(*)::int n from public.memberships where community_id = $1`, [C.A]))[0].n, 5);
  }, { doc: DOC_RLS });

scenario('IZO-23', 'Un vecin din B încearcă să voteze, să susțină o sesizare și să aprecieze un comentariu din A',
  'Toate trei sunt refuzate.',
  async ({ as }) => {
    const c = as(U.carmen);
    expectError(await c.run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt1, U.carmen]), /row-level security/);
    expectError(await c.run(`insert into public.issue_supporters (issue_id, user_id) values ($1, $2)`, [A.issue, U.carmen]), /row-level security/);
    expectError(await c.run(`insert into public.reactions (issue_comment_id, user_id) values ($1, $2)`, [A.comment, U.carmen]), /row-level security/);
    expectError(await c.run(`insert into public.reactions (reply_id, user_id) values ($1, $2)`, [A.reply, U.carmen]), /row-level security/);
  }, { doc: DOC_RLS });

scenario('IZO-24', 'Administratorul din B încearcă să înregistreze o plată la un fond din A',
  'Refuzat: registrul unei comunități îl scriu doar oamenii ei.',
  async ({ as }) => {
    const b = as(U.bogdan);
    expectError(await b.run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 100, $3)`, [A.fund, U.ioana, U.bogdan]), /row-level security/);
    expectError(await b.run(`insert into public.fund_quotas (fund_id, user_id, amount_bani) values ($1, $2, 1)`, [A.fund, U.ioana]), /row-level security/);
  }, { doc: 'Migrarea 0016: „Staff see everything, because they are the ones keeping the record.” — staff-ul comunității respective.' });

// ---- the functions that run with more rights than the caller --------------
scenario('IZO-25', 'Un vecin din B cere totalurile fondurilor din A (fund_summary)',
  'Funcția nu întoarce nimic cui nu e membru.',
  async ({ as }) => {
    assert.equal(await as(U.carmen).count(`select * from public.fund_summary($1)`, [C.A]), 0);
    assert.equal(await as(U.bogdan).count(`select * from public.fund_summary($1)`, [C.A]), 0);
    assert.equal(await as(U.radu).count(`select * from public.fund_summary($1)`, [C.A]), 0);
    assert.equal(await as(U.ioana).count(`select * from public.fund_summary($1)`, [C.A]), 2);
  }, { doc: 'Migrarea 0016: „the one thing it must not do is hand the totals of a community to somebody who is not in it.”' });

scenario('IZO-26', 'Un vecin din B trimite notificări în A prin notify_members și notify_user',
  'Ambele funcții refuză pe cine nu e membru al comunității numite.',
  async ({ as, sql }) => {
    const c = as(U.carmen);
    expectError(await c.run(`select public.notify_members($1, null, 'announcement', 'Fals', 'x', '')`, [C.A]), /not a member/);
    expectError(await c.run(`select public.notify_user($1, $2, 'reply', 'Fals', 'x', '')`, [C.A, U.ioana]), /not a member/);
    assert.equal((await sql(`select count(*)::int n from public.notifications where title = 'Fals'`))[0].n, 0);
  }, { doc: 'Migrarea 0002: „security definer bypasses RLS, so re-check the caller belongs here.”' });

scenario('IZO-27', 'Un vecin din B folosește notify_user din propria comunitate ca să scrie cuiva din A',
  'Nu se trimite nimic: destinatarul trebuie să fie membru al aceleiași comunități.',
  async ({ as, sql }) => {
    const r = await as(U.carmen).run(`select public.notify_user($1, $2, 'reply', 'Peste gard', 'x', '')`, [C.B, U.ioana]);
    assert.ok(!r.error);
    assert.equal((await sql(`select count(*)::int n from public.notifications where user_id = $1 and title = 'Peste gard'`, [U.ioana]))[0].n, 0);
  }, { doc: 'Migrarea 0002.' });

scenario('IZO-28', 'Un vecin din B scrie direct în tabelul de notificări un rând pentru cineva din A',
  'Refuzat: nu poți pune o notificare în lista cuiva cu care nu împarți comunitatea.',
  async ({ as, sql }) => {
    // The policy only asks that the *sender* belongs to the community named
    // on the row; it never asks who the row is for.
    const r = await as(U.carmen).run(
      `insert into public.notifications (community_id, user_id, type, title, body, link)
       values ($1, $2, 'announcement', 'Ați câștigat un premiu', 'Apăsați aici', 'https://exemplu-phishing.invalid')`,
      [C.B, U.ioana]);
    expectBlocked(r, 'notificarea către un om din altă comunitate');
    assert.equal((await sql(`select count(*)::int n from public.notifications where user_id = $1 and title like 'Ați câștigat%'`, [U.ioana]))[0].n, 0);
  }, { doc: 'Migrarea 0001: „Notifications & preferences: strictly private to their owner.”' });

scenario('IZO-29', 'Administratorul din B schimbă roluri sau predă administrarea în A',
  'set_member_role și transfer_admin refuză: nu e administrator acolo.',
  async ({ as, sql }) => {
    const b = as(U.bogdan);
    expectError(await b.run(`select public.set_member_role($1, $2, 'member')`, [C.A, U.mihai]), /not_admin/);
    expectError(await b.run(`select public.set_member_role($1, $2, 'admin')`, [C.A, U.bogdan]), /not_admin/);
    expectError(await b.run(`select public.transfer_admin($1, $2)`, [C.A, U.ioana]), /not_admin/);
    assert.equal((await sql(`select role from public.memberships where community_id = $1 and user_id = $2`, [C.A, U.ana]))[0].role, 'admin');
  }, { doc: 'Migrarea 0010.' });

scenario('IZO-30', 'Administratorul din B mută un membru al lui în A, modificând rândul de apartenență',
  'Refuzat: apartenența la altă comunitate nu se poate fabrica dintr-un rând propriu.',
  async ({ as, sql }) => {
    const r = await as(U.bogdan).run(`update public.memberships set community_id = $1 where community_id = $2 and user_id = $3`, [C.A, C.B, U.carmen]);
    expectBlocked(r);
    assert.equal((await sql(`select count(*)::int n from public.memberships where community_id = $1 and user_id = $2`, [C.A, U.carmen]))[0].n, 0);
  }, { doc: DOC_RLS });

scenario('IZO-31', 'Un vecin din B corectează comentariul altcuiva din A prin edit_comment',
  'Refuzat: funcția schimbă doar mesajele proprii.',
  async ({ as, sql }) => {
    expectError(await as(U.carmen).run(`select public.edit_comment('comment', $1, 'rescris din B')`, [A.comment]), /not yours/);
    expectError(await as(U.bogdan).run(`select public.edit_comment('reply', $1, 'rescris din B')`, [A.reply]), /not yours/);
    assert.equal((await sql(`select body from public.issue_comments where id = $1`, [A.comment]))[0].body, 'Am sunat la firma de lift.');
  }, { doc: 'Migrarea 0015.' });

scenario('IZO-32', 'Un autor din B își mută propria discuție în comunitatea A',
  'Refuzat: un text scris în B nu poate apărea pe avizierul lui A.',
  async ({ as, sql }) => {
    // discussions_update lets the author through on "author_id = auth.uid()"
    // and has no separate check on the row as it will be afterwards.
    const r = await as(U.carmen).run(`update public.discussions set community_id = $1 where id = $2`, [C.A, B.disc]);
    expectBlocked(r, 'mutarea discuției în altă comunitate');
    assert.equal((await sql(`select community_id from public.discussions where id = $1`, [B.disc]))[0].community_id, C.B);
  }, { doc: DOC_RLS });

scenario('IZO-33', 'Un administrator din B atașează un document de-al lui la un fond din A',
  'Chiar dacă rândul se scrie, membrii lui A nu îl văd printre hârtiile fondului lor.',
  async ({ as }) => {
    await as(U.bogdan).run(
      `insert into public.documents (community_id, title, path, uploaded_by, fund_id) values ($1, 'Factură străină', $2, $3, $4)`,
      [C.B, `${C.B}/straina.pdf`, U.bogdan, A.fund]);
    const seen = await as(U.ioana).rows(`select title from public.documents where fund_id = $1`, [A.fund]);
    assert.deepEqual(seen.map((d) => d.title), ['Proces-verbal august']);
  }, { doc: 'Migrarea 0017.' });

// ---- files ---------------------------------------------------------------
scenario('IZO-34', 'Un vecin din B cere fișierele comunității A (documente și poze de la sesizări)',
  'Nu vede niciun fișier din A, deci nu poate obține nici link semnat pentru ele.',
  async ({ as }) => {
    for (const who of [U.carmen, U.bogdan, U.radu]) {
      assert.equal(await as(who).count(`select name from storage.objects where name = $1`, [A.docPath]), 0);
      assert.equal(await as(who).count(`select name from storage.objects where name = $1`, [A.photoPath]), 0);
    }
    assert.equal(await as(U.ioana).count(`select name from storage.objects where name in ($1, $2)`, [A.docPath, A.photoPath]), 2);
    const all = await as(U.carmen).rows(`select name from storage.objects`);
    assert.ok(all.every((o) => o.name.startsWith(C.B)), 'Carmen vede fișiere din afara comunității ei');
  }, { doc: 'Migrările 0017 și 0018: bucket privat, acces după primul folder din cale.' });

scenario('IZO-35', 'Administratorul din B încarcă un fișier în folderul de documente al lui A',
  'Refuzat. La fel pentru o poză de sesizare pusă de un vecin din B în folderul lui A.',
  async ({ as, sql }) => {
    expectError(await as(U.bogdan).run(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${C.A}/fals.pdf`, U.bogdan]), /row-level security/);
    expectError(await as(U.carmen).run(`insert into storage.objects (bucket_id, name, owner) values ('issue-photos', $1, $2)`, [`${C.A}/${U.carmen}-9.jpg`, U.carmen]), /row-level security/);
    expectBlocked(await as(U.bogdan).run(`delete from storage.objects where name = $1`, [A.docPath]), 'ștergerea fișierului din A');
    assert.equal((await sql(`select count(*)::int n from storage.objects where name = $1`, [A.docPath]))[0].n, 1);
  }, { doc: 'Migrările 0017 și 0018.' });

scenario('IZO-36', 'Căi de fișier construite ca să păcălească verificarea comunității',
  'Orice cale al cărei prim folder nu e exact id-ul unei comunități în care ești membru e refuzată.',
  async ({ as }) => {
    const c = as(U.carmen);
    const tricks = [
      `${C.B}/../${C.A}/x.jpg`,           // looks like a climb; the first folder is still B, which is fine …
      `../${C.A}/x.jpg`,
      `/${C.A}/x.jpg`,
      `${C.A.toUpperCase()}/x.jpg`,
      ` ${C.A}/x.jpg`,
      `${C.A}`,                            // no folder at all
      `${C.A}x/x.jpg`,
      `not-a-uuid/x.jpg`,
      ``,
      `%/x.jpg`,
    ];
    for (const name of tricks) {
      const r = await c.run(`insert into storage.objects (bucket_id, name, owner) values ('issue-photos', $1, $2)`, [name, U.carmen]);
      // … and so is the only one of these allowed through: it is filed under B.
      if (name.startsWith(`${C.B}/`)) continue;
      expectBlocked(r, `calea „${name}”`);
    }
    // A null path must not raise inside the policy; it must simply be no.
    expectBlocked(await c.run(`insert into storage.objects (bucket_id, name, owner) values ('issue-photos', null, $1)`, [U.carmen]));
  }, { doc: 'Migrarea 0017: „reads it back without letting a malformed path raise”.' });

scenario('IZO-37', 'Pozele vechi (dinainte de migrarea 0018) și tabelul care le leagă de comunitate',
  'Un vecin din altă comunitate nu vede poza veche, iar tabelul de legătură nu îi spune ce fișiere are altă comunitate.',
  async ({ as, sql }) => {
    const legacy = `${U.ioana}/1786557775450.jpg`;
    await sql(`insert into storage.objects (bucket_id, name, owner) values ('issue-photos', $1, $2)`, [legacy, U.ioana]);
    await sql(`insert into public.legacy_issue_photos (name, community_id) values ($1, $2)`, [legacy, C.A]);
    assert.equal(await as(U.dan).count(`select name from storage.objects where name = $1`, [legacy]), 1, 'vecinul din A trebuie să vadă poza veche');
    assert.equal(await as(U.carmen).count(`select name from storage.objects where name = $1`, [legacy]), 0);
    // The map itself: which paths exist, and whose they are.
    assert.equal(await as(U.carmen).count(`select name from public.legacy_issue_photos where community_id = $1`, [C.A]), 0,
      'tabelul de legătură îi arată lui Carmen fișierele comunității A');
  }, { doc: 'Migrarea 0019.' });

scenario('IZO-38', 'Un utilizator oarecare află din ce comunitate face parte un fond, știindu-i doar id-ul',
  'Funcția ajutătoare nu răspunde celor care nu sunt membri.',
  async ({ as, anon }) => {
    const r = await as(U.carmen).run(`select public.fund_community($1) as cid`, [A.fund]);
    assert.ok(r.error || r.rows[0].cid === null, 'fund_community îi spune lui Carmen comunitatea unui fond din A');
    const r2 = await anon().run(`select public.fund_community($1) as cid`, [A.fund]);
    assert.ok(r2.error || r2.rows[0].cid === null, 'fund_community răspunde și fără cont');
  }, { doc: 'Migrarea 0016.' });
