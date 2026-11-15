import { area, scenario, assert, expectBlocked, expectError, expectOk, U, C, A, B } from '../harness.mjs';

// ===========================================================================
area('ANO', 'Vizitatorul fără cont',
  'Cheia publică a aplicației stă în codul paginii, la vedere. Oricine o poate folosi ca să întrebe baza de date direct, fără să se înregistreze. Acestea sunt întrebările lui.');

const PRIVATE_TABLES = [
  'communities', 'memberships', 'announcements', 'discussions', 'discussion_replies', 'issues',
  'issue_supporters', 'issue_history', 'issue_comments', 'polls', 'poll_options', 'poll_votes',
  'notifications', 'notification_prefs', 'push_subscriptions', 'deleted_accounts', 'archived_items',
  'member_phones', 'reactions', 'funds', 'fund_quotas', 'fund_payments', 'documents', 'legacy_issue_photos',
];

scenario('ANO-01', 'Un vizitator fără cont citește, pe rând, fiecare tabel cu date ale comunităților',
  'Nu primește niciun rând din niciunul.',
  async ({ anon }) => {
    for (const t of PRIVATE_TABLES) {
      const r = await anon().run(`select * from public.${t}`);
      assert.ok(r.error || r.rowCount === 0, `${t}: un vizitator fără cont a citit ${r.rowCount} rânduri`);
    }
    const files = await anon().run(`select name from storage.objects`);
    assert.ok(files.error || files.rowCount === 0, 'fișiere vizibile fără cont');
  }, { doc: 'Migrarea 0005: „row-level security (correctly) hides communities from anonymous visitors”.' });

scenario('ANO-02', 'Un vizitator fără cont citește numele și apartamentele tuturor utilizatorilor',
  'Nu primește nimic: numele și apartamentul sunt pentru oameni cu cont.',
  async ({ anon }) => {
    const r = await anon().run(`select full_name, apartment from public.profiles`);
    assert.ok(r.error || r.rowCount === 0, `fără cont se pot citi ${r.rowCount} profiluri, cu nume și apartament`);
  }, { doc: 'Migrarea 0009 descrie profilul ca „readable by anyone signed in” — adică autentificat, nu oricine.' });

scenario('ANO-03', 'Un vizitator verifică un cod de invitație înainte să-și facă cont',
  'Află doar id-ul și numele comunității — fără adresă, cod, descriere sau membri. Codul merge indiferent de majuscule și de spații.',
  async ({ anon }) => {
    const r = await anon().rows(`select * from public.community_by_code('TEILOR-15')`);
    assert.equal(r.length, 1);
    assert.deepEqual(Object.keys(r[0]).sort(), ['id', 'name']);
    assert.equal(r[0].id, C.A);
    for (const v of ['teilor-15', '  TEILOR-15  ', 'Teilor-15']) {
      assert.equal((await anon().rows(`select id from public.community_by_code($1)`, [v])).length, 1, `„${v}” ar trebui recunoscut`);
    }
  }, { doc: 'Migrarea 0005: „it returns the community\'s id and name and nothing else”.' });

scenario('ANO-04', 'Coduri de invitație greșite, goale sau construite ca să ghicească',
  'Niciunul nu întoarce o comunitate: nici bucăți de cod, nici semne de înlocuire, nici text de tip SQL.',
  async ({ anon, sql }) => {
    const wrong = [
      '', '   ', null, 'TEILOR', 'TEILOR-1', 'TEILOR-15X', 'TEILOR-1_', 'TEILOR-%', '%', '_________',
      `' or '1'='1`, `TEILOR-15' --`, `'; drop table public.communities; --`, 'TEILOR‑15' /* cratimă tipografică */,
    ];
    for (const v of wrong) {
      const r = await anon().run(`select id from public.community_by_code($1)`, [v]);
      assert.ok(!r.error, `„${v}” a dat eroare: ${r.error?.message}`);
      assert.equal(r.rowCount, 0, `„${v}” a găsit o comunitate`);
    }
    assert.equal((await sql(`select count(*)::int n from public.communities`))[0].n, 2);
  }, { doc: 'Migrarea 0005.' });

scenario('ANO-05', 'Un vizitator fără cont încearcă să scrie: o discuție, o apartenență, o notificare, o comunitate',
  'Toate sunt refuzate.',
  async ({ anon }) => {
    const a = anon();
    expectBlocked(await a.run(`insert into public.discussions (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.A, U.ioana]));
    expectBlocked(await a.run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.radu, C.A]));
    expectBlocked(await a.run(`insert into public.notifications (community_id, user_id, type, title, body) values ($1, $2, 'x', 'x', 'x')`, [C.A, U.ioana]));
    expectBlocked(await a.run(`insert into public.communities (name, code) values ('Fantomă', 'FANTOMA-1')`));
    expectBlocked(await a.run(`update public.profiles set full_name = 'Șters' where true`));
    expectBlocked(await a.run(`insert into storage.objects (bucket_id, name) values ('issue-photos', $1)`, [`${C.A}/x.jpg`]));
  }, { doc: 'Migrarea 0001.' });

scenario('ANO-06', 'Un vizitator fără cont apelează funcțiile cu drepturi ridicate',
  'Niciuna nu face nimic pentru el.',
  async ({ anon, sql }) => {
    const a = anon();
    const calls = [
      [`select public.notify_members($1, null, 'announcement', 'x', 'x', '')`, [C.A]],
      [`select public.notify_user($1, $2, 'reply', 'x', 'x', '')`, [C.A, U.ioana]],
      [`select * from public.fund_summary($1)`, [C.A]],
      [`select public.delete_my_account()`, []],
      [`select public.set_member_role($1, $2, 'admin')`, [C.A, U.ioana]],
      [`select public.transfer_admin($1, $2)`, [C.A, U.ioana]],
      [`select public.edit_comment('comment', $1, 'x')`, [A.comment]],
      [`select public.claim_push_subscription('https://push.example/ioana', 'k', 'a')`, []],
      [`select public.release_push_subscription('https://push.example/ioana')`, []],
    ];
    for (const [q, p] of calls) {
      const r = await a.run(q, p);
      assert.ok(r.error || r.rowCount === 0, `${q} a răspuns unui vizitator fără cont`);
    }
    assert.equal((await sql(`select count(*)::int n from public.push_subscriptions`))[0].n, 1);
    assert.equal((await a.rows(`select public.is_member($1) as m, public.shares_community($2) as s, public.can_react($3, null) as r`, [C.A, U.ioana, A.comment]))[0].m, false);
  }, { doc: 'Migrările 0002, 0004, 0007, 0010, 0015, 0016: fiecare funcție e dată doar rolului „authenticated”.' });

// ===========================================================================
area('INT', 'Intrarea într-o comunitate',
  'Radu are cont, dar nu e în nicio comunitate. Singurul lucru care ar trebui să-i deschidă ușa e codul de invitație primit de la un vecin.');

scenario('INT-01', 'Un om cu cont, fără comunitate, cere lista comunităților și codurile lor de invitație',
  'Nu află codul niciunei comunități în care nu e membru.',
  async ({ as }) => {
    const rows = await as(U.radu).rows(`select id, name, code from public.communities`);
    assert.equal(rows.filter((r) => r.code).length, 0, `Radu a citit ${rows.length} comunități, cu tot cu codul de invitație`);
  }, { doc: 'Migrarea 0005: cine are un cod află doar numele comunității. Codul e singura cheie de intrare.' });

scenario('INT-02', 'Un om cu cont intră într-o comunitate fără cod, scriindu-și singur apartenența',
  'Refuzat. Fără cod nu se intră.',
  async ({ as }) => {
    const r = await as(U.radu).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.radu, C.A]);
    expectBlocked(r, 'intrarea fără cod');
  }, { doc: 'Migrarea 0005: „this grants no new ability to get inside a community”.' });

scenario('INT-03', 'Odată intrat astfel, ce poate citi',
  'Nimic din comunitatea în care nu a fost invitat: nici anunțuri, nici plăți, nici telefoane.',
  async ({ as }) => {
    const r = as(U.radu);
    await r.run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.radu, C.A]);
    assert.equal(await r.count(`select id from public.announcements where community_id = $1`, [C.A]), 0, 'citește anunțurile');
    assert.equal(await r.count(`select user_id from public.member_phones where user_id = $1`, [U.ana]), 0, 'citește telefonul administratorului');
    assert.equal(await r.count(`select name from storage.objects where name = $1`, [A.docPath]), 0, 'ajunge la documente');
  }, { doc: 'Studiu de caz: „Access rules could not be a matter of hiding controls in the interface.”' });

scenario('INT-04', 'La intrare, cineva își cere singur rolul de administrator',
  'Rolul cerut e ignorat: cine intră într-o comunitate cu membri e vecin simplu.',
  async ({ as, sql }) => {
    await as(U.radu).run(`insert into public.memberships (user_id, community_id, role) values ($1, $2, 'admin')`, [U.radu, C.A]);
    const rows = await sql(`select role from public.memberships where user_id = $1 and community_id = $2`, [U.radu, C.A]);
    assert.ok(rows.every((r) => r.role === 'member'), 'a intrat direct ca administrator');
    // And nobody already inside can promote themselves by editing their own row.
    expectBlocked(await as(U.ioana).run(`update public.memberships set role = 'admin' where user_id = $1 and community_id = $2`, [U.ioana, C.A]));
    expectBlocked(await as(U.mihai).run(`update public.memberships set role = 'admin' where user_id = $1 and community_id = $2`, [U.mihai, C.A]));
  }, { doc: 'Migrarea 0001: „A client can never grant itself admin/moderator by simply asking for it.”' });

scenario('INT-05', 'Cineva înscrie pe altcineva într-o comunitate, în numele lui',
  'Refuzat: fiecare intră doar el însuși.',
  async ({ as, sql }) => {
    expectError(await as(U.carmen).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.ioana, C.B]), /row-level security/);
    // The administrator's version of the same thing: rewriting a membership
    // row so that it belongs to somebody who never asked.
    const r = await as(U.bogdan).run(`update public.memberships set user_id = $1 where community_id = $2 and user_id = $3`, [U.radu, C.B, U.carmen]);
    expectBlocked(r, 'înscrierea altcuiva prin modificarea unui rând');
    assert.equal((await sql(`select count(*)::int n from public.memberships where user_id = $1`, [U.radu]))[0].n, 0);
  }, { doc: 'Migrarea 0001: „Anyone signed in can insert themselves”.' });

scenario('INT-06', 'Același om intră de două ori în aceeași comunitate',
  'A doua încercare e refuzată; rămâne un singur rând.',
  async ({ as, sql }) => {
    expectError(await as(U.ioana).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.ioana, C.A]), /duplicate key/);
    assert.equal((await sql(`select count(*)::int n from public.memberships where user_id = $1 and community_id = $2`, [U.ioana, C.A]))[0].n, 1);
  }, { doc: 'Migrarea 0001: unique (user_id, community_id).' });

scenario('INT-07', 'Cineva creează o comunitate nouă și intră în ea',
  'Devine administratorul ei; următorul care intră e vecin simplu.',
  async ({ as, sql }) => {
    const [{ id }] = await as(U.radu).rows(`insert into public.communities (name, code) values ('Strada Nouă', 'NOUA-1') returning id`);
    expectOk(await as(U.radu).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.radu, id]), 1);
    await sql(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.carmen, id]);
    const roles = await sql(`select user_id, role from public.memberships where community_id = $1`, [id]);
    assert.equal(roles.find((r) => r.user_id === U.radu).role, 'admin');
    assert.equal(roles.find((r) => r.user_id === U.carmen).role, 'member');
  }, { doc: 'Migrarea 0001: „the first member of a community becomes its admin automatically”.' });

scenario('INT-08', 'Între crearea unei comunități și intrarea fondatorului, altcineva se înscrie primul',
  'Refuzat: fondatorul e administratorul, nu cine ajunge primul la rând.',
  async ({ as, sql }) => {
    // The app makes two requests: create the community, then join it. Anyone
    // who can list communities can land between the two.
    const [{ id }] = await as(U.radu).rows(`insert into public.communities (name, code) values ('Strada Nouă', 'NOUA-1') returning id`);
    await as(U.carmen).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.carmen, id]);
    await as(U.radu).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.radu, id]);
    const roles = await sql(`select user_id, role from public.memberships where community_id = $1`, [id]);
    assert.notEqual(roles.find((r) => r.user_id === U.carmen)?.role, 'admin', 'un străin a devenit administratorul unei comunități create de altcineva');
  }, { doc: 'Migrarea 0001.' });

scenario('INT-09', 'Un vecin iese din comunitate',
  'Nu mai vede nimic din ea, dar ce a scris rămâne la locul lui.',
  async ({ as, sql }) => {
    expectOk(await as(U.dan).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]), 1);
    assert.equal(await as(U.dan).count(`select id from public.announcements`), 0);
    assert.equal(await as(U.dan).count(`select id from public.issue_comments`), 0);
    assert.equal(await as(U.dan).count(`select user_id from public.member_phones where user_id <> $1`, [U.dan]), 0);
    assert.equal((await sql(`select count(*)::int n from public.issue_comments where id = $1`, [A.comment]))[0].n, 1);
    assert.equal(await as(U.ioana).count(`select id from public.issue_comments where id = $1`, [A.comment]), 1);
  }, { doc: 'Migrarea 0001: „members can remove only themselves (leave)”.' });

scenario('INT-10', 'Administratorul scoate un vecin din comunitate',
  'Vecinul pierde accesul pe loc. Un vecin simplu sau un moderator nu pot scoate pe nimeni.',
  async ({ as, sql }) => {
    expectBlocked(await as(U.ioana).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]));
    expectBlocked(await as(U.mihai).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]));
    expectOk(await as(U.ana).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]), 1);
    assert.equal(await as(U.dan).count(`select id from public.issues`), 0);
    expectBlocked(await as(U.dan).run(`insert into public.issue_comments (issue_id, author_id, body) values ($1, $2, 'încă sunt aici')`, [A.issue, U.dan]));
    assert.equal((await sql(`select count(*)::int n from public.memberships where community_id = $1`, [C.A]))[0].n, 4);
  }, { doc: 'Migrarea 0001: „Admins can change roles or remove members”.' });

scenario('INT-11', 'Un vecin scos de administrator se întoarce cu același cod de invitație',
  'Astăzi reușește: codul rămâne valabil până când administratorul îl schimbă.',
  async ({ as, sql }) => {
    await as(U.ana).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]);
    const [found] = await as(U.dan).rows(`select id from public.community_by_code('TEILOR-15')`);
    expectOk(await as(U.dan).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.dan, found.id]), 1);
    assert.equal((await sql(`select role from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]))[0].role, 'member');
  }, { decide: 'Scoaterea unui vecin nu îl împiedică să revină. Dacă scoaterea trebuie să fie definitivă, e nevoie fie de o listă de persoane blocate, fie de schimbarea automată a codului la fiecare excludere.' });

scenario('INT-12', 'Doar administratorul schimbă codul de invitație și setările comunității',
  'Vecinul și moderatorul sunt refuzați. După schimbare, codul vechi nu mai deschide nimic.',
  async ({ as, anon }) => {
    expectBlocked(await as(U.ioana).run(`update public.communities set code = 'AL-MEU-1' where id = $1`, [C.A]));
    expectBlocked(await as(U.mihai).run(`update public.communities set name = 'Alt nume' where id = $1`, [C.A]));
    expectOk(await as(U.ana).run(`update public.communities set code = 'TEILOR-99' where id = $1`, [C.A]), 1);
    assert.equal((await anon().rows(`select id from public.community_by_code('TEILOR-15')`)).length, 0);
    assert.equal((await anon().rows(`select id from public.community_by_code('TEILOR-99')`)).length, 1);
  }, { doc: 'Migrarea 0001: „Only an admin of that community can change its settings.”' });

scenario('INT-13', 'Un administrator își pune drept cod codul altei comunități, scris cu litere mici',
  'Refuzat: două comunități nu pot avea același cod, indiferent de majuscule — altfel invitații uneia ajung în cealaltă.',
  async ({ as, anon }) => {
    expectError(await as(U.bogdan).run(`update public.communities set code = 'TEILOR-15' where id = $1`, [C.B]), /duplicate key/);
    // The lookup ignores case; the uniqueness rule does not.
    const r = await as(U.bogdan).run(`update public.communities set code = 'teilor-15' where id = $1`, [C.B]);
    expectBlocked(r, 'codul dublat');
    const found = await anon().rows(`select id from public.community_by_code('TEILOR-15')`);
    assert.deepEqual(found.map((f) => f.id), [C.A]);
  }, { doc: 'Migrarea 0001 (code unique) + 0005 (căutarea ignoră majusculele).' });

scenario('INT-14', 'Comunitatea e pusă pe „intrare cu aprobare”, iar cineva cu codul se înscrie',
  'Nu devine membru până nu îl aprobă cineva din administrație.',
  async ({ as, sql }) => {
    expectOk(await as(U.ana).run(`update public.communities set join_mode = 'approval' where id = $1`, [C.A]), 1);
    await as(U.radu).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.radu, C.A]);
    assert.equal(await as(U.radu).count(`select id from public.announcements where community_id = $1`, [C.A]), 0,
      'a intrat și citește anunțurile fără să-l fi aprobat nimeni');
    assert.ok((await sql(`select 1 from public.communities where id = $1 and join_mode = 'approval'`, [C.A])).length === 1);
  }, { doc: 'Ecranul „Setări comunitate” oferă trei moduri de intrare, între care „cu aprobare”.' });

scenario('INT-15', 'Toți membrii pleacă dintr-o comunitate, apoi cineva intră cu vechiul cod',
  'Astăzi, primul venit devine administrator și moștenește toată arhiva: registrul de plăți, documentele, discuțiile.',
  async ({ as, sql }) => {
    for (const who of [U.carmen, U.maria]) {
      await as(who).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [who, C.B]);
    }
    // The last admin of a community that is empty but for them may leave.
    expectOk(await as(U.bogdan).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.bogdan, C.B]), 1);
    const [found] = await as(U.radu).rows(`select id from public.community_by_code('POPESTI-8')`);
    await as(U.radu).run(`insert into public.memberships (user_id, community_id) values ($1, $2)`, [U.radu, found.id]);
    assert.equal((await sql(`select role from public.memberships where user_id = $1 and community_id = $2`, [U.radu, C.B]))[0].role, 'admin');
    assert.equal(await as(U.radu).count(`select id from public.fund_payments where fund_id = $1`, [B.fund]), 1);
  }, { decide: 'O comunitate rămasă fără niciun membru își păstrează conținutul și codul. Primul care intră ulterior îi devine administrator și vede tot ce a fost acolo, inclusiv cine cât a plătit. Variante: comunitatea goală se arhivează, sau codul ei se dezactivează când pleacă ultimul om.' });

// ===========================================================================
area('ROL', 'Roluri: vecin, moderator, administrator',
  'În comunitatea A: Ana e administrator, Mihai moderator, Ioana și Dan vecini simpli.');

scenario('ROL-01', 'Un vecin simplu încearcă tot ce e rezervat administrației',
  'Fiecare încercare e refuzată: anunț, sondaj, fond, plată, document, schimbare de status, ascunderea unei discuții.',
  async ({ as }) => {
    const i = as(U.ioana);
    const tries = [
      [`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.A, U.ioana]],
      [`insert into public.polls (community_id, author_id, question, ends_at) values ($1, $2, 'x?', now() + interval '1 day')`, [C.A, U.ioana]],
      [`insert into public.poll_options (poll_id, label) values ($1, 'A treia')`, [A.poll]],
      [`insert into public.funds (community_id, title, amount_bani, created_by) values ($1, 'x', 100, $2)`, [C.A, U.ioana]],
      [`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 15000, $2)`, [A.fund, U.ioana]],
      [`insert into public.fund_quotas (fund_id, user_id, amount_bani) values ($1, $2, 0) on conflict (fund_id, user_id) do update set amount_bani = 0`, [A.fund, U.ioana]],
      [`insert into public.documents (community_id, title, path, uploaded_by) values ($1, 'x', $3, $2)`, [C.A, U.ioana, `${C.A}/x.pdf`]],
      [`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${C.A}/x.pdf`, U.ioana]],
      [`update public.announcements set title = 'x', pinned_until = now() + interval '9 years' where id = $1`, [A.ann]],
      [`delete from public.announcements where id = $1`, [A.ann]],
      [`update public.issues set status = 'resolved' where id = $1`, [A.issue]],
      [`insert into public.issue_history (issue_id, status, note, by_id) values ($1, 'resolved', 'gata', $2)`, [A.issue, U.ioana]],
      [`update public.polls set closed = true where id = $1`, [A.poll]],
      [`update public.funds set closed_at = now() where id = $1`, [A.fund]],
      [`delete from public.documents where id = $1`, [A.doc]],
      [`delete from storage.objects where name = $1`, [A.docPath]],
      [`update public.discussions set status = 'hidden' where id = $1`, [A.reply /* not hers */]],
    ];
    for (const [q, p] of tries) expectBlocked(await i.run(q, p), q);
    // Somebody else's discussion specifically.
    expectBlocked(await as(U.dan).run(`update public.discussions set status = 'hidden' where id = $1`, [A.disc]));
  }, { doc: 'Migrarea 0001 („members read; staff write”), 0012, 0016, 0017.' });

scenario('ROL-02', 'Moderatorul face ce ține de moderare și de avizier',
  'Poate publica și șterge anunțuri, ascunde discuții, schimba statusul unei sesizări, crea sondaje, ține registrul fondurilor și pune documente.',
  async ({ as }) => {
    const m = as(U.mihai);
    expectOk(await m.run(`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'Curățenie sâmbătă', 'La 10.')`, [C.A, U.mihai]), 1);
    expectOk(await m.run(`update public.discussions set status = 'hidden' where id = $1`, [A.disc]), 1);
    expectOk(await m.run(`update public.issues set status = 'progress' where id = $1`, [A.issue]), 1);
    expectOk(await m.run(`insert into public.issue_history (issue_id, status, note, by_id) values ($1, 'progress', 'Am chemat firma', $2)`, [A.issue, U.mihai]), 1);
    expectOk(await m.run(`insert into public.polls (community_id, author_id, question, ends_at) values ($1, $2, 'x?', now() + interval '1 day')`, [C.A, U.mihai]), 1);
    expectOk(await m.run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 5000, $3)`, [A.fund, U.ioana, U.mihai]), 1);
    expectOk(await m.run(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${C.A}/factura.pdf`, U.mihai]), 1);
    expectOk(await m.run(`insert into public.documents (community_id, title, path, uploaded_by) values ($1, 'Factură', $3, $2)`, [C.A, U.mihai, `${C.A}/factura.pdf`]), 1);
    expectOk(await m.run(`delete from public.announcements where id = $1`, [A.ann]), 1);
  }, { doc: 'Migrarea 0001: „staff (admin/moderator) write”.' });

scenario('ROL-03', 'Moderatorul încearcă ce ține doar de administrator',
  'Refuzat: roluri, predarea comunității, setări, cod, scoaterea membrilor.',
  async ({ as }) => {
    const m = as(U.mihai);
    expectError(await m.run(`select public.set_member_role($1, $2, 'moderator')`, [C.A, U.ioana]), /not_admin/);
    expectError(await m.run(`select public.transfer_admin($1, $2)`, [C.A, U.mihai]), /not_admin|not_yourself/);
    expectBlocked(await m.run(`update public.communities set code = 'M-1' where id = $1`, [C.A]));
    expectBlocked(await m.run(`update public.memberships set role = 'admin' where community_id = $1 and user_id = $2`, [C.A, U.mihai]));
    expectBlocked(await m.run(`delete from public.memberships where community_id = $1 and user_id = $2`, [C.A, U.dan]));
    assert.equal(await m.count(`select id from public.deleted_accounts`), 0);
  }, { doc: 'Migrarea 0010.' });

scenario('ROL-04', 'Cineva scrie în numele altcuiva',
  'Refuzat peste tot: anunț, discuție, sesizare, comentariu, vot, susținere, apreciere, plată, document, arhivare.',
  async ({ as }) => {
    const tries = [
      [U.mihai, `insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.A, U.ana]],
      [U.dan, `insert into public.discussions (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.A, U.ioana]],
      [U.dan, `insert into public.issues (community_id, reporter_id, title, description) values ($1, $2, 'x', 'y')`, [C.A, U.ioana]],
      [U.dan, `insert into public.issue_comments (issue_id, author_id, body) values ($1, $2, 'x')`, [A.issue, U.ana]],
      [U.dan, `insert into public.discussion_replies (discussion_id, author_id, body) values ($1, $2, 'x')`, [A.disc, U.ana]],
      [U.dan, `insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt2, U.mihai]],
      [U.dan, `insert into public.issue_supporters (issue_id, user_id) values ($1, $2)`, [A.issue, U.mihai]],
      [U.dan, `insert into public.reactions (issue_comment_id, user_id) values ($1, $2)`, [A.comment, U.mihai]],
      [U.mihai, `insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 100, $3)`, [A.fund, U.dan, U.ana]],
      [U.mihai, `insert into public.documents (community_id, title, path, uploaded_by) values ($1, 'x', 'p', $2)`, [C.A, U.ana]],
      [U.mihai, `insert into public.polls (community_id, author_id, question, ends_at) values ($1, $2, 'x?', now() + interval '1 day')`, [C.A, U.ana]],
      [U.mihai, `insert into public.funds (community_id, title, amount_bani, created_by) values ($1, 'x', 100, $2)`, [C.A, U.ana]],
      [U.dan, `insert into public.archived_items (user_id, kind, item_id) values ($1, 'announcement', $2)`, [U.mihai, A.ann]],
      [U.dan, `insert into public.issue_history (issue_id, status, note, by_id) values ($1, 'new', 'x', $2)`, [A.issue, U.ioana]],
    ];
    for (const [who, q, p] of tries) expectBlocked(await as(who).run(q, p), q);
  }, { doc: 'Fiecare politică de inserare cere „author_id = auth.uid()” sau echivalentul.' });

scenario('ROL-05', 'Un moderator rescrie textul unei discuții sau al unei sesizări scrise de altcineva',
  'Refuzat: moderarea înseamnă a ascunde, nu a pune cuvinte în gura cuiva.',
  async ({ as, sql }) => {
    const m = as(U.mihai);
    const r1 = await m.run(`update public.discussions set body = 'Sunt de acord cu majorarea.' where id = $1`, [A.disc]);
    const r2 = await m.run(`update public.issues set description = 'Nu mai e nicio problemă.', reporter_id = $2 where id = $1`, [A.issue, U.dan]);
    const [d] = await sql(`select body from public.discussions where id = $1`, [A.disc]);
    const [i] = await sql(`select description, reporter_id from public.issues where id = $1`, [A.issue]);
    assert.equal(d.body, 'Ce ziceți de niște bănci?', `textul discuției Ioanei a fost rescris de moderator (${r1.rowCount})`);
    assert.equal(i.reporter_id, U.ioana, `sesizarea a fost trecută pe alt nume (${r2.rowCount})`);
  }, { doc: 'Migrarea 0001: „staff can update status (moderation)”. Migrarea 0015: o corectură lasă întotdeauna un semn.' });

scenario('ROL-06', 'Autorul unei discuții ascunse de moderator și-o face singur vizibilă la loc',
  'Refuzat: ce a ascuns moderatorul rămâne ascuns.',
  async ({ as, sql }) => {
    await as(U.dan).run(`update public.discussions set status = 'approved' where id = $1`, [A.discHidden]);
    assert.equal((await sql(`select status from public.discussions where id = $1`, [A.discHidden]))[0].status, 'hidden',
      'autorul și-a anulat singur moderarea');
  }, { doc: 'Migrarea 0001: statusul unei discuții e decizia administrației.' });

scenario('ROL-07', 'Singurul administrator încearcă să plece sau să se retrogradeze, lăsând comunitatea fără nimeni la conducere',
  'Refuzat pe orice cale: ieșire, modificarea propriului rol, funcția de schimbare a rolului.',
  async ({ as, sql }) => {
    const a = as(U.ana);
    expectError(await a.run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.ana, C.A]), /last_admin/);
    expectError(await a.run(`update public.memberships set role = 'member' where user_id = $1 and community_id = $2`, [U.ana, C.A]), /last_admin/);
    expectError(await a.run(`update public.memberships set role = 'moderator' where user_id = $1 and community_id = $2`, [U.ana, C.A]), /last_admin/);
    expectError(await a.run(`select public.set_member_role($1, $2, 'member')`, [C.A, U.ana]), /not_yourself/);
    assert.equal((await sql(`select role from public.memberships where user_id = $1 and community_id = $2`, [U.ana, C.A]))[0].role, 'admin');
  }, { doc: 'Migrarea 0010: „nothing, by any route, may leave a community with members but no admin”.' });

scenario('ROL-08', 'Administratorul predă comunitatea unui vecin',
  'Vecinul devine administrator, fostul administrator devine vecin, într-un singur pas. Către cineva din afară, predarea e refuzată și nu se schimbă nimic.',
  async ({ as, sql }) => {
    const a = as(U.ana);
    expectError(await a.run(`select public.transfer_admin($1, $2)`, [C.A, U.carmen]), /not_a_member/);
    expectError(await a.run(`select public.transfer_admin($1, $2)`, [C.A, U.ana]), /not_yourself/);
    assert.equal((await sql(`select role from public.memberships where user_id = $1 and community_id = $2`, [U.ana, C.A]))[0].role, 'admin');
    expectOk(await a.run(`select public.transfer_admin($1, $2)`, [C.A, U.ioana]));
    const roles = Object.fromEntries((await sql(`select user_id, role from public.memberships where community_id = $1`, [C.A])).map((r) => [r.user_id, r.role]));
    assert.equal(roles[U.ioana], 'admin');
    assert.equal(roles[U.ana], 'member');
    // And the rights follow at once, in both directions.
    expectBlocked(await a.run(`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.A, U.ana]));
    expectOk(await as(U.ioana).run(`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`, [C.A, U.ioana]), 1);
  }, { doc: 'Migrarea 0010.' });

scenario('ROL-09', 'Doi administratori: unul îl retrogradează pe celălalt, apoi rămâne singur',
  'Cât sunt doi, oricare poate pleca sau poate fi retrogradat. Ultimul rămas nu mai poate.',
  async ({ as, sql }) => {
    expectOk(await as(U.ana).run(`select public.set_member_role($1, $2, 'admin')`, [C.A, U.mihai]));
    expectOk(await as(U.mihai).run(`select public.set_member_role($1, $2, 'member')`, [C.A, U.ana]));
    assert.equal((await sql(`select role from public.memberships where user_id = $1 and community_id = $2`, [U.ana, C.A]))[0].role, 'member');
    expectError(await as(U.mihai).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.mihai, C.A]), /last_admin/);
    // The demoted admin has lost the function too.
    expectError(await as(U.ana).run(`select public.set_member_role($1, $2, 'admin')`, [C.A, U.ana]), /not_admin/);
  }, { doc: 'Migrarea 0010: „an admin can make another member an admin, and both stay admins”.' });

scenario('ROL-10', 'Schimbări de rol cu valori greșite',
  'Un rol inexistent e refuzat; la fel schimbarea rolului cuiva care nu e membru.',
  async ({ as }) => {
    const a = as(U.ana);
    expectError(await a.run(`select public.set_member_role($1, $2, 'superadmin')`, [C.A, U.ioana]), /bad_role/);
    expectError(await a.run(`select public.set_member_role($1, $2, '')`, [C.A, U.ioana]), /bad_role/);
    expectError(await a.run(`select public.set_member_role($1, $2, null)`, [C.A, U.ioana]), /bad_role|null/);
    expectError(await a.run(`select public.set_member_role($1, $2, 'moderator')`, [C.A, U.carmen]), /not_a_member/);
    expectError(await a.run(`update public.memberships set role = 'superadmin' where community_id = $1 and user_id = $2`, [C.A, U.ioana]), /check constraint/);
  }, { doc: 'Migrarea 0010.' });

scenario('ROL-11', 'Un moderator e retrogradat în timp ce lucrează',
  'Drepturile dispar imediat, fără să aștepte o nouă autentificare.',
  async ({ as }) => {
    const ins = `insert into public.announcements (community_id, author_id, title, body) values ($1, $2, 'x', 'y')`;
    expectOk(await as(U.mihai).run(ins, [C.A, U.mihai]), 1);
    expectOk(await as(U.ana).run(`select public.set_member_role($1, $2, 'member')`, [C.A, U.mihai]));
    expectBlocked(await as(U.mihai).run(ins, [C.A, U.mihai]));
    assert.equal(await as(U.mihai).count(`select id from public.fund_payments where fund_id = $1`, [A.fund]), 1, 'ar trebui să-și mai vadă doar propria plată');
  }, { doc: 'Migrarea 0001: rolul e citit din baza de date la fiecare cerere.' });

scenario('ROL-12', 'Ultimul om dintr-o comunitate, administrator fiind, pleacă',
  'Are voie: nu mai rămâne nimeni care să fie lăsat fără conducere.',
  async ({ as, sql }) => {
    await sql(`delete from public.memberships where community_id = $1 and user_id <> $2`, [C.B, U.bogdan]);
    expectOk(await as(U.bogdan).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.bogdan, C.B]), 1);
  }, { doc: 'Migrarea 0010: „The last admin of an empty-but-for-them community may still leave”.' });
