import { area, scenario, assert, expectBlocked, expectError, expectOk, U, C, A, B } from '../harness.mjs';

const summary = async (actor, community, fund) =>
  (await actor.rows(`select * from public.fund_summary($1)`, [community])).find((r) => r.fund_id === fund);
const num = (v) => Number(v);

// ===========================================================================
area('FON', 'Fonduri', 'Fondul „Reparație acoperiș” din A: 250 lei de locuință. Dan e scutit (0 lei). Ioana a dat o rată de 100 lei, Mihai a plătit tot.');

scenario('FON-01', 'Un vecin deschide registrul fondului',
  'Își vede doar rândul lui: ce a plătit el și suma lui. Nu vede cine altcineva a plătit sau e în urmă.',
  async ({ as }) => {
    const pays = await as(U.ioana).rows(`select user_id, amount_bani from public.fund_payments where fund_id = $1`, [A.fund]);
    assert.deepEqual(pays.map((p) => p.user_id), [U.ioana]);
    assert.equal(await as(U.ioana).count(`select user_id from public.fund_quotas where fund_id = $1`, [A.fund]), 0, 'vede scutirea lui Dan');
    assert.equal(await as(U.dan).count(`select user_id from public.fund_quotas where fund_id = $1`, [A.fund]), 1, 'Dan trebuie să-și vadă propria scutire');
    assert.equal(await as(U.dan).count(`select id from public.fund_payments where fund_id = $1`, [A.fund]), 0);
    assert.equal(await as(U.maria).count(`select id from public.fund_payments`), 0);
  }, { doc: 'Migrarea 0016: „Your own line, and nothing else. […] Publishing a list of debtors to the whole building is a thing associations have been penalised for.”' });

scenario('FON-02', 'Administrația deschide același registru',
  'Vede toate plățile și toate excepțiile, pentru că ea ține evidența.',
  async ({ as }) => {
    for (const who of [U.ana, U.mihai]) {
      assert.equal(await as(who).count(`select id from public.fund_payments where fund_id = $1`, [A.fund]), 2);
      assert.equal(await as(who).count(`select user_id from public.fund_quotas where fund_id = $1`, [A.fund]), 1);
    }
  }, { doc: 'Migrarea 0016.' });

scenario('FON-03', 'Un vecin își trece singur plata, își micșorează suma sau își șterge o rată',
  'Toate refuzate: o plată o confirmă doar cine a primit banii.',
  async ({ as, sql }) => {
    const i = as(U.ioana);
    expectBlocked(await i.run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 15000, $2)`, [A.fund, U.ioana]));
    expectBlocked(await i.run(`update public.fund_payments set amount_bani = 25000 where fund_id = $1 and user_id = $2`, [A.fund, U.ioana]));
    expectBlocked(await i.run(`delete from public.fund_payments where fund_id = $1 and user_id = $2`, [A.fund, U.ioana]));
    expectBlocked(await i.run(`insert into public.fund_quotas (fund_id, user_id, amount_bani) values ($1, $2, 0)`, [A.fund, U.ioana]));
    expectBlocked(await as(U.dan).run(`update public.fund_quotas set amount_bani = 0 where fund_id = $1`, [A.fundClosed]));
    assert.equal(num((await sql(`select sum(amount_bani) s from public.fund_payments where fund_id = $1 and user_id = $2`, [A.fund, U.ioana]))[0].s), 10000);
  }, { doc: 'Migrarea 0016: „A resident marking themselves paid is not a record, it is a claim.”' });

scenario('FON-04', 'Totalurile fondului, văzute de fiecare vecin',
  'Toți văd aceleași totaluri — 350 din 1.000 lei, 2 locuințe din 5 la zi — și fiecare propria situație. Cine e scutit apare ca „la zi”.',
  async ({ as }) => {
    const i = await summary(as(U.ioana), C.A, A.fund);
    assert.deepEqual([num(i.target_bani), num(i.collected_bani), i.homes, i.homes_paid], [100000, 35000, 5, 2]);
    assert.deepEqual([num(i.my_due_bani), num(i.my_paid_bani)], [25000, 10000]);
    const d = await summary(as(U.dan), C.A, A.fund);
    assert.deepEqual([num(d.target_bani), num(d.collected_bani), num(d.my_due_bani), num(d.my_paid_bani)], [100000, 35000, 0, 0]);
    const m = await summary(as(U.maria), C.A, A.fund);
    assert.deepEqual([num(m.my_due_bani), num(m.my_paid_bani)], [25000, 0]);
    // Maria is in B as well, and the two communities' totals do not bleed.
    const mb = await summary(as(U.maria), C.B, B.fund);
    assert.deepEqual([num(mb.target_bani), num(mb.collected_bani), mb.homes, mb.homes_paid], [150000, 50000, 3, 1]);
  }, { doc: 'Migrarea 0016: „A home owing nothing counts as done”; totalurile sunt pentru toți membrii.' });

scenario('FON-05', 'O plată în rate: a doua rată completează suma',
  'Ratele se adună. După a doua rată, vecinul e trecut „la zi” și totalul crește exact cu rata.',
  async ({ as }) => {
    expectOk(await as(U.ana).run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by, note) values ($1, $2, 15000, $3, 'a doua rată')`, [A.fund, U.ioana, U.ana]), 1);
    const i = await summary(as(U.ioana), C.A, A.fund);
    assert.deepEqual([num(i.collected_bani), i.homes_paid, num(i.my_paid_bani)], [50000, 3, 25000]);
    // One ban short is not paid.
    await as(U.ana).run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 24999, $3)`, [A.fund, U.maria, U.ana]);
    assert.equal((await summary(as(U.dan), C.A, A.fund)).homes_paid, 3);
    await as(U.ana).run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 1, $3)`, [A.fund, U.maria, U.ana]);
    assert.equal((await summary(as(U.dan), C.A, A.fund)).homes_paid, 4);
  }, { doc: 'Migrarea 0016: „a payment in instalments is several payments rather than one number overwritten twice”.' });

scenario('FON-06', 'Sume imposibile: plată de zero sau negativă, fond de zero lei, scutire negativă',
  'Toate refuzate. O scutire de exact zero lei e permisă.',
  async ({ as }) => {
    const a = as(U.ana);
    const pay = `insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, $3, $4)`;
    expectError(await a.run(pay, [A.fund, U.ioana, 0, U.ana]), /check constraint/);
    expectError(await a.run(pay, [A.fund, U.ioana, -5000, U.ana]), /check constraint/);
    expectError(await a.run(`insert into public.funds (community_id, title, amount_bani, created_by) values ($1, 'x', 0, $2)`, [C.A, U.ana]), /check constraint/);
    expectError(await a.run(`insert into public.funds (community_id, title, amount_bani, created_by) values ($1, 'x', -1, $2)`, [C.A, U.ana]), /check constraint/);
    expectError(await a.run(`insert into public.fund_quotas (fund_id, user_id, amount_bani) values ($1, $2, -1)`, [A.fund, U.ioana]), /check constraint/);
    expectOk(await a.run(`insert into public.fund_quotas (fund_id, user_id, amount_bani) values ($1, $2, 0)`, [A.fund, U.ioana]), 1);
    // Half a ban does not exist.
    expectError(await a.run(pay, [A.fund, U.ioana, '100.5', U.ana]), /invalid input syntax/);
  }, { doc: 'Migrarea 0016: sume întregi, în bani; „zero is allowed, and is the point”.' });

scenario('FON-07', 'Un vecin care a plătit pleacă din comunitate',
  'Banii lui rămân în totalul strâns: au fost încasați, indiferent unde locuiește el acum.',
  async ({ as, sql }) => {
    const before = num((await summary(as(U.dan), C.A, A.fund)).collected_bani);
    await sql(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.mihai, C.A]);
    const after = num((await summary(as(U.dan), C.A, A.fund)).collected_bani);
    assert.equal(after, before, `totalul strâns a scăzut de la ${before / 100} la ${after / 100} lei când Mihai a plecat`);
  }, { doc: 'Migrarea 0016: „the record of who paid for the roof is worth more a year later than it is now”.' });

scenario('FON-08', 'Administrația înregistrează o plată pe numele cuiva care nu e în comunitate',
  'Refuzat: registrul unei comunități e despre oamenii ei.',
  async ({ as }) => {
    const r = await as(U.ana).run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by, note) values ($1, $2, 5000, $3, 'greșeală de nume')`, [A.fund, U.carmen, U.ana]);
    expectBlocked(r, 'plata pe numele cuiva din altă comunitate');
    // What the mistake costs: the outsider can read a row from A's ledger.
    assert.equal(await as(U.carmen).count(`select note from public.fund_payments where fund_id = $1`, [A.fund]), 0);
  }, { doc: 'Migrarea 0016.' });

scenario('FON-09', 'Un moderator își trece singur plata ca făcută',
  'Astăzi reușește: administrația poate înregistra o plată și pe propriul nume.',
  async ({ as }) => {
    expectOk(await as(U.mihai).run(`insert into public.fund_payments (fund_id, user_id, amount_bani, recorded_by) values ($1, $2, 10000, $2)`, [A.fundClosed, U.mihai]), 1);
  }, { decide: 'Regula din documentație e că „cine a dat banii nu e niciodată cel care a scris plata”. Pentru un vecin simplu, baza de date o impune. Pentru un moderator sau administrator care își plătește propria cotă, nu — își poate confirma singur plata. Variante: cere ca plata proprie să fie înregistrată de alt membru al administrației, sau acceptă situația ca firească în asociațiile mici.' });

scenario('FON-10', 'O sumă absurd de mare la un fond',
  'Fondul greșit poate arăta ce vrea; celelalte fonduri ale comunității trebuie să rămână vizibile.',
  async ({ as }) => {
    expectOk(await as(U.ana).run(`insert into public.funds (community_id, title, amount_bani, created_by) values ($1, 'Greșeală de tastare', 9000000000000000000, $2)`, [C.A, U.ana]), 1);
    const r = await as(U.ioana).run(`select * from public.fund_summary($1)`, [C.A]);
    assert.ok(!r.error, `un singur fond cu sumă uriașă strică totalurile tuturor fondurilor: ${r.error?.message}`);
  }, { doc: 'Migrarea 0016: totalul e o sumă; nimic nu îi limitează mărimea.' });

scenario('FON-11', 'Un fond încheiat',
  'Rămâne vizibil tuturor membrilor, cu tot cu totaluri.',
  async ({ as }) => {
    assert.equal(await as(U.ioana).count(`select id from public.funds where id = $1 and closed_at is not null`, [A.fundClosed]), 1);
    const s = await summary(as(U.ioana), C.A, A.fundClosed);
    assert.deepEqual([num(s.target_bani), num(s.collected_bani), s.homes_paid], [50000, 0, 0]);
  }, { doc: 'Migrarea 0016: „Closed funds stay readable”.' });

scenario('FON-12', 'Un fond e șters cu totul',
  'Plățile și excepțiile lui dispar odată cu el; factura atașată rămâne printre documente, fără fond.',
  async ({ as, sql }) => {
    expectOk(await as(U.ana).run(`delete from public.funds where id = $1`, [A.fund]), 1);
    assert.equal((await sql(`select count(*)::int n from public.fund_payments where fund_id = $1`, [A.fund]))[0].n, 0);
    assert.equal((await sql(`select count(*)::int n from public.fund_quotas where fund_id = $1`, [A.fund]))[0].n, 0);
    const [doc] = await sql(`select fund_id from public.documents where id = $1`, [A.doc]);
    assert.equal(doc.fund_id, null);
  }, { doc: 'Migrarea 0017: „an invoice outlives the collection it was raised for”.' });

// ===========================================================================
area('DOC', 'Documente și fișiere', 'Fișierele stau în două locuri private: documentele asociației și pozele de la sesizări.');

scenario('DOC-01', 'Un vecin deschide documentele asociației',
  'Le vede pe toate ale comunității lui și poate ajunge la fișier. Nu poate adăuga, redenumi sau șterge.',
  async ({ as }) => {
    const d = as(U.dan);
    assert.equal(await d.count(`select id from public.documents`), 1);
    assert.equal(await d.count(`select name from storage.objects where bucket_id = 'documents'`), 1);
    expectBlocked(await d.run(`update public.documents set title = 'Altceva' where id = $1`, [A.doc]));
    expectBlocked(await d.run(`delete from public.documents where id = $1`, [A.doc]));
    expectBlocked(await d.run(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${C.A}/al-meu.pdf`, U.dan]));
    expectBlocked(await d.run(`delete from storage.objects where name = $1`, [A.docPath]));
  }, { doc: 'Migrarea 0017: „Every member reads them; only staff put them there.”' });

scenario('DOC-02', 'Un vecin atașează o poză la sesizare',
  'O poate încărca doar în folderul comunității lui. Nu poate șterge sau înlocui poza altcuiva — nici pe a lui.',
  async ({ as }) => {
    const d = as(U.dan);
    expectOk(await d.run(`insert into storage.objects (bucket_id, name, owner) values ('issue-photos', $1, $2)`, [`${C.A}/${U.dan}-7.jpg`, U.dan]), 1);
    expectBlocked(await d.run(`delete from storage.objects where name = $1`, [A.photoPath]));
    expectBlocked(await d.run(`update storage.objects set name = $1 where name = $2`, [`${C.A}/alta.jpg`, A.photoPath]));
    expectBlocked(await as(U.ioana).run(`delete from storage.objects where name = $1`, [A.photoPath]));
    // Somebody in both communities files each photo where it belongs, and
    // cannot use one membership to write into the other's documents.
    expectOk(await as(U.maria).run(`insert into storage.objects (bucket_id, name, owner) values ('issue-photos', $1, $2)`, [`${C.B}/${U.maria}-1.jpg`, U.maria]), 1);
    expectBlocked(await as(U.maria).run(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${C.B}/x.pdf`, U.maria]));
  }, { doc: 'Migrarea 0018.' });

scenario('DOC-03', 'Un document al cărui rând arată spre fișierul altei comunități',
  'Rândul poate exista, dar fișierul rămâne de neatins: accesul se decide la fișier, nu la rând.',
  async ({ as }) => {
    expectOk(await as(U.ana).run(`insert into public.documents (community_id, title, path, uploaded_by) values ($1, 'Contractul vecinilor', $2, $3)`, [C.A, B.docPath, U.ana]), 1);
    assert.equal(await as(U.ana).count(`select name from storage.objects where name = $1`, [B.docPath]), 0);
    assert.equal(await as(U.ioana).count(`select name from storage.objects where name = $1`, [B.docPath]), 0);
  }, { doc: 'Migrarea 0017: „storage policies see the object, not our tables”.' });

scenario('DOC-04', 'Un fișier pus într-un bucket care nu există, sau într-un al treilea bucket',
  'Refuzat: sunt permise doar cele două locuri cunoscute.',
  async ({ as }) => {
    expectBlocked(await as(U.ana).run(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [`${C.A}/x.png`, U.ana]));
    expectBlocked(await as(U.ana).run(`insert into storage.objects (bucket_id, name, owner) values (null, $1, $2)`, [`${C.A}/x.png`, U.ana]));
  }, { doc: 'Migrările 0017 și 0018.' });

// ===========================================================================
area('TEL', 'Numere de telefon și profiluri', 'Ana și Dan și-au făcut numărul vizibil. Ioana are un număr salvat, dar ascuns.');

scenario('TEL-01', 'Cineva își salvează numărul fără să aleagă nimic despre vizibilitate',
  'Numărul e ascuns până când omul alege altfel.',
  async ({ as }) => {
    expectOk(await as(U.mihai).run(`insert into public.member_phones (user_id, phone) values ($1, '0766 000 002')`, [U.mihai]), 1);
    assert.equal(await as(U.dan).count(`select phone from public.member_phones where user_id = $1`, [U.mihai]), 0);
    assert.equal(await as(U.mihai).count(`select phone from public.member_phones where user_id = $1`, [U.mihai]), 1);
  }, { doc: 'Studiu de caz: „A phone number is optional, off by default”.' });

scenario('TEL-02', 'Cine vede un număr făcut vizibil',
  'Doar vecinii din aceeași comunitate. Nu cei din altă comunitate, nu cei fără comunitate, nu vizitatorii.',
  async ({ as, anon }) => {
    const q = `select phone from public.member_phones where user_id = $1`;
    assert.equal(await as(U.dan).count(q, [U.ana]), 1);
    assert.equal(await as(U.maria).count(q, [U.ana]), 1);
    assert.equal(await as(U.maria).count(q, [U.bogdan]), 1, 'Maria e și în B');
    assert.equal(await as(U.carmen).count(q, [U.ana]), 0);
    assert.equal(await as(U.bogdan).count(q, [U.ana]), 0);
    assert.equal(await as(U.radu).count(q, [U.ana]), 0);
    const r = await anon().run(q, [U.ana]);
    assert.ok(r.error || r.rowCount === 0);
    // Seen from A, the whole table is A's visible numbers plus your own.
    const all = await as(U.ioana).rows(`select user_id from public.member_phones`);
    assert.deepEqual(all.map((x) => x.user_id).sort(), [U.ana, U.dan, U.ioana].sort());
  }, { doc: 'Studiu de caz: „visible only to members of the same community […] a database policy rather than interface logic”.' });

scenario('TEL-03', 'Un număr ascuns, cerut de administrator',
  'Nici administratorul nu îl vede.',
  async ({ as }) => {
    assert.equal(await as(U.ana).count(`select phone from public.member_phones where user_id = $1`, [U.ioana]), 0);
    assert.equal(await as(U.mihai).count(`select phone from public.member_phones where user_id = $1`, [U.ioana]), 0);
  }, { doc: 'Migrarea 0009: „only if they chose to be reachable”.' });

scenario('TEL-04', 'Un vecin pleacă din comunitate',
  'Din acea clipă nu mai vede numerele foștilor vecini, iar ei nu îl mai văd pe al lui.',
  async ({ as }) => {
    await as(U.dan).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]);
    assert.equal(await as(U.dan).count(`select phone from public.member_phones where user_id = $1`, [U.ana]), 0);
    assert.equal(await as(U.ana).count(`select phone from public.member_phones where user_id = $1`, [U.dan]), 0);
  }, { doc: 'Migrarea 0009: „only by the people they actually live near”.' });

scenario('TEL-05', 'Cineva schimbă numărul altcuiva sau i-l face vizibil',
  'Refuzat, inclusiv pentru administrator.',
  async ({ as, sql }) => {
    for (const who of [U.dan, U.ana]) {
      expectBlocked(await as(who).run(`update public.member_phones set visible = true where user_id = $1`, [U.ioana]));
      expectBlocked(await as(who).run(`update public.member_phones set phone = '0000' where user_id = $1`, [U.ioana]));
      expectBlocked(await as(who).run(`delete from public.member_phones where user_id = $1`, [U.ioana]));
    }
    expectBlocked(await as(U.dan).run(`insert into public.member_phones (user_id, phone, visible) values ($1, '0000', true)`, [U.mihai]));
    const [row] = await sql(`select phone, visible from public.member_phones where user_id = $1`, [U.ioana]);
    assert.deepEqual([row.phone, row.visible], ['0722 000 003', false]);
  }, { doc: 'Migrarea 0009: „Your own row, always, to read and to change.”' });

scenario('TEL-06', 'Cineva schimbă numele sau apartamentul din profilul altcuiva',
  'Refuzat: fiecare își schimbă doar profilul lui.',
  async ({ as, sql }) => {
    expectBlocked(await as(U.dan).run(`update public.profiles set full_name = 'Altcineva' where id = $1`, [U.ioana]));
    expectBlocked(await as(U.ana).run(`update public.profiles set apartment = 'Ap. 99' where id = $1`, [U.ioana]));
    expectOk(await as(U.ioana).run(`update public.profiles set apartment = 'Ap. 13' where id = $1`, [U.ioana]), 1);
    assert.equal((await sql(`select full_name from public.profiles where id = $1`, [U.ioana]))[0].full_name, 'Ioana Rusu');
  }, { doc: 'Migrarea 0001.' });

scenario('TEL-07', 'Cineva cu cont, din altă comunitate sau din niciuna, citește numele și apartamentele tuturor',
  'Astăzi reușește: orice om cu cont vede numele și apartamentul oricărui utilizator al platformei.',
  async ({ as }) => {
    const rows = await as(U.radu).rows(`select full_name, apartment from public.profiles`);
    assert.equal(rows.length, 8);
    assert.ok(rows.some((r) => r.apartment === 'Ap. 12'));
  }, { decide: 'Migrarea 0009 spune explicit că e intenționat pentru nume și apartament. Dar înseamnă că oricine își face un cont, fără să fie în vreo comunitate, poate descărca lista cu numele și apartamentul fiecărui utilizator din toate comunitățile. Studiul de caz numește datele personale „neobișnuit de sensibile”. De reconsiderat: profilul vizibil doar vecinilor din aceeași comunitate.' });

// ===========================================================================
area('STE', 'Ștergerea contului', 'Contul se golește, nu dispare: omul pleacă, ce a scris rămâne.');

scenario('STE-01', 'Un vecin își șterge contul',
  'Dispar numele, apartamentul, telefonul, adresa de email, parola, notificările, preferințele, abonamentul de push și ce avea arhivat. Nu se mai poate autentifica.',
  async ({ as, sql }) => {
    expectOk(await as(U.ioana).run(`select public.delete_my_account()`));
    const [p] = await sql(`select full_name, apartment, deleted_at from public.profiles where id = $1`, [U.ioana]);
    assert.equal(p.full_name, 'Vecin'); assert.equal(p.apartment, null); assert.ok(p.deleted_at);
    const [u] = await sql(`select email, raw_user_meta_data, encrypted_password, phone, banned_until::text from auth.users where id = $1`, [U.ioana]);
    assert.match(u.email, /^sters-[0-9a-f]{32}@invalid\.invalid$/);
    assert.deepEqual(u.raw_user_meta_data, {});
    assert.equal(u.encrypted_password, null);
    assert.equal(u.banned_until, 'infinity');
    for (const [t, col] of [['memberships', 'user_id'], ['notifications', 'user_id'], ['notification_prefs', 'user_id'],
      ['push_subscriptions', 'user_id'], ['archived_items', 'user_id'], ['member_phones', 'user_id']]) {
      assert.equal((await sql(`select count(*)::int n from public.${t} where ${col} = $1`, [U.ioana]))[0].n, 0, `${t} mai are rânduri`);
    }
    assert.equal((await sql(`select count(*)::int n from auth.identities where user_id = $1`, [U.ioana]))[0].n, 0);
    // Nothing anywhere still says "ioana" or "Rusu".
    const leftovers = await sql(
      `select 1 from auth.users where id = $1 and (email ilike '%ioana%' or raw_user_meta_data::text ilike '%rusu%')
       union all select 1 from public.profiles where id = $1 and full_name ilike '%ioana%'`, [U.ioana]);
    assert.equal(leftovers.length, 0);
  }, { doc: 'Studiu de caz: „Identity, contact details and access are deleted.” Migrarea 0007.' });

scenario('STE-02', 'Ce rămâne în urma unui cont șters',
  'Sesizarea, discuția, comentariile și votul rămân la locul lor, atribuite unui vecin care a plecat. Ceilalți le văd în continuare.',
  async ({ as, sql }) => {
    await as(U.ioana).run(`select public.delete_my_account()`);
    assert.equal(await as(U.dan).count(`select id from public.issues where id = $1`, [A.issue]), 1);
    assert.equal(await as(U.dan).count(`select id from public.discussions where id = $1`, [A.disc]), 1);
    assert.equal(await as(U.dan).count(`select id from public.issue_comments where id = $1`, [A.commentOld]), 1);
    assert.equal((await sql(`select count(*)::int n from public.poll_votes where user_id = $1`, [U.ioana]))[0].n, 1);
    const [who] = await as(U.dan).rows(`select full_name, deleted_at from public.profiles where id = $1`, [U.ioana]);
    assert.equal(who.full_name, 'Vecin'); assert.ok(who.deleted_at);
    // And the person behind the emptied account can no longer read any of it.
    assert.equal(await as(U.ioana).count(`select id from public.issues`), 0);
    assert.equal(await as(U.ioana).count(`select id from public.issue_comments`), 0);
  }, { doc: 'Studiu de caz: „Contributions remain, attributed to a member who left.”' });

scenario('STE-03', 'Singurul administrator al unei comunități cu membri își șterge contul',
  'Comunitatea nu rămâne fără conducere: administrator devine vecinul cu cea mai mare vechime.',
  async ({ as, sql }) => {
    expectOk(await as(U.ana).run(`select public.delete_my_account()`));
    const admins = await sql(`select user_id from public.memberships where community_id = $1 and role = 'admin'`, [C.A]);
    assert.deepEqual(admins.map((a) => a.user_id), [U.mihai]);
    assert.equal((await sql(`select count(*)::int n from public.memberships where user_id = $1`, [U.ana]))[0].n, 0);
    // Her announcement is still on the board, and the new admin can run things.
    assert.equal(await as(U.dan).count(`select id from public.announcements where id = $1`, [A.ann]), 1);
    expectOk(await as(U.mihai).run(`select public.set_member_role($1, $2, 'moderator')`, [C.A, U.dan]));
  }, { doc: 'Migrarea 0007: „hand the keys to the longest-standing member who is left”.' });

scenario('STE-04', 'Administratorul își șterge contul când mai există un al doilea administrator',
  'Nu se schimbă rolul nimănui: comunitatea are deja pe cineva la conducere.',
  async ({ as, sql }) => {
    await as(U.ana).run(`select public.set_member_role($1, $2, 'admin')`, [C.A, U.dan]);
    await as(U.ana).run(`select public.delete_my_account()`);
    const roles = Object.fromEntries((await sql(`select user_id, role from public.memberships where community_id = $1`, [C.A])).map((r) => [r.user_id, r.role]));
    assert.equal(roles[U.dan], 'admin');
    assert.equal(roles[U.mihai], 'moderator', 'moderatorul a fost promovat fără motiv');
  }, { doc: 'Migrarea 0007.' });

scenario('STE-05', 'Cineva din două comunități își șterge contul',
  'Fiecare comunitate numără o plecare, iar administrația fiecăreia o vede doar pe a ei. Nimeni nu poate scrie în această evidență.',
  async ({ as, sql }) => {
    await as(U.maria).run(`select public.delete_my_account()`);
    assert.equal(await as(U.ana).count(`select id from public.deleted_accounts`), 1);
    assert.equal(await as(U.bogdan).count(`select id from public.deleted_accounts`), 1);
    assert.equal(await as(U.ioana).count(`select id from public.deleted_accounts`), 0, 'un vecin simplu vede evidența');
    const cols = (await sql(`select column_name from information_schema.columns where table_name = 'deleted_accounts'`)).map((c) => c.column_name).sort();
    assert.deepEqual(cols, ['community_id', 'deleted_at', 'id'], 'evidența păstrează ceva ce duce înapoi la persoană');
    expectBlocked(await as(U.ana).run(`insert into public.deleted_accounts (community_id) values ($1)`, [C.A]));
    expectBlocked(await as(U.ana).run(`delete from public.deleted_accounts where community_id = $1`, [C.A]));
  }, { doc: 'Migrarea 0007: „Deliberately holds no reference back to the person”.' });

scenario('STE-06', 'Ștergerea e cerută de două ori la rând',
  'A doua cerere nu strică nimic și nu mai numără o plecare.',
  async ({ as, sql }) => {
    await as(U.dan).run(`select public.delete_my_account()`);
    expectOk(await as(U.dan).run(`select public.delete_my_account()`));
    assert.equal((await sql(`select count(*)::int n from public.deleted_accounts where community_id = $1`, [C.A]))[0].n, 1);
  }, { doc: 'Migrarea 0007.' });

scenario('STE-07', 'Un vecin care a plătit la un fond își șterge contul',
  'Plățile lui rămân în registru și în totalul strâns: banii au fost încasați.',
  async ({ as, sql }) => {
    const before = num((await summary(as(U.dan), C.A, A.fund)).collected_bani);
    await as(U.ioana).run(`select public.delete_my_account()`);
    assert.equal((await sql(`select count(*)::int n from public.fund_payments where user_id = $1`, [U.ioana]))[0].n, 1, 'plata a dispărut din registru');
    const after = num((await summary(as(U.dan), C.A, A.fund)).collected_bani);
    assert.equal(after, before, `totalul strâns a scăzut de la ${before / 100} la ${after / 100} lei`);
  }, { doc: 'Studiu de caz: „Contributions remain”. Migrarea 0016.' });

// ===========================================================================
area('NOT', 'Notificări', 'Ale fiecăruia, private, și trimise doar celor care nu le-au oprit.');

scenario('NOT-01', 'Cineva citește sau marchează ca citite notificările altcuiva',
  'Refuzat. Fiecare își vede doar lista lui.',
  async ({ as, sql }) => {
    assert.equal(await as(U.dan).count(`select id from public.notifications`), 0);
    assert.equal(await as(U.ana).count(`select id from public.notifications where user_id = $1`, [U.ioana]), 0);
    expectBlocked(await as(U.dan).run(`update public.notifications set read = true where user_id = $1`, [U.ioana]));
    expectBlocked(await as(U.ana).run(`delete from public.notifications where user_id = $1`, [U.ioana]));
    expectOk(await as(U.ioana).run(`update public.notifications set read = true where user_id = $1`, [U.ioana]), 1);
    assert.equal((await sql(`select read from public.notifications where user_id = $1`, [U.ana]))[0].read, false);
  }, { doc: 'Migrarea 0001: „strictly private to their owner”.' });

scenario('NOT-02', 'Se trimite o notificare tuturor vecinilor, iar unul dintre ei a oprit acel fel de notificări',
  'Primesc toți, mai puțin cel care a trimis-o și cel care le-a oprit. Dan a oprit anunțurile și fondurile, nu și sesizările.',
  async ({ as }) => {
    const ids = async (type) => (await as(U.ana).rows(`select public.notify_members($1, $2, $3, 'Titlu', 'Text', '') as uid`, [C.A, U.ana, type])).map((r) => r.uid).sort();
    assert.deepEqual(await ids('announcement'), [U.mihai, U.ioana, U.maria].sort());
    assert.deepEqual(await ids('fund'), [U.mihai, U.ioana, U.maria].sort());
    assert.deepEqual(await ids('issue'), [U.mihai, U.ioana, U.dan, U.maria].sort());
    assert.deepEqual(await ids('event'), [U.mihai, U.ioana, U.dan, U.maria].sort());
    // Nobody in B hears about it.
    assert.equal(await as(U.carmen).count(`select id from public.notifications where title = 'Titlu'`), 0);
  }, { doc: 'Migrările 0002, 0012, 0016: fiecare comutator din Setări are o ramură în pref_allows.' });

scenario('NOT-03', 'Un vecin care a oprit anunțurile primește totuși unul, scris direct în lista lui de către alt vecin',
  'Refuzat: preferințele se respectă pe orice cale ajunge notificarea.',
  async ({ as, sql }) => {
    await as(U.ioana).run(
      `insert into public.notifications (community_id, user_id, type, title, body, link) values ($1, $2, 'announcement', 'Anunț nou', 'Ședință diseară', '')`,
      [C.A, U.dan]);
    assert.equal((await sql(`select count(*)::int n from public.notifications where user_id = $1 and type = 'announcement'`, [U.dan]))[0].n, 0,
      'Dan a primit un anunț deși le-a oprit');
  }, { doc: 'Migrarea 0002: „honouring notification preferences […] the filtering has to happen server-side”.' });

scenario('NOT-04', 'Notificare către sine, către nimeni, către cineva din afară',
  'Nu se trimite nimic în niciunul din cazuri, și nu apare nicio eroare.',
  async ({ as, sql }) => {
    const n = async () => (await sql(`select count(*)::int n from public.notifications`))[0].n;
    const before = await n();
    for (const target of [U.ioana, null, U.carmen, U.radu]) {
      expectOk(await as(U.ioana).run(`select public.notify_user($1, $2, 'reply', 'x', 'y', '')`, [C.A, target]));
    }
    assert.equal(await n(), before);
    expectOk(await as(U.ioana).run(`select public.notify_user($1, $2, 'reply', 'x', 'y', '')`, [C.A, U.dan]));
    assert.equal(await n(), before + 1);
  }, { doc: 'Migrarea 0002.' });

scenario('NOT-05', 'Un vecin simplu trimite tuturor o notificare care arată ca un anunț oficial, cu un link din afara aplicației',
  'Astăzi reușește: funcția de trimitere verifică doar că ești membru, nu și ce trimiți.',
  async ({ as, sql }) => {
    expectOk(await as(U.dan).run(
      `select public.notify_members($1, $2, 'announcement', 'Anunț nou', 'Plătiți întreținerea în contul nou', 'https://exemplu-fals.invalid/plata')`, [C.A, U.dan]));
    // Everyone but the sender — Dan's own switch does not come into it.
    assert.equal((await sql(`select count(*)::int n from public.notifications where link like 'https://exemplu-fals%'`))[0].n, 4);
  }, { decide: 'Notificările sunt create de aplicația fiecărui utilizator, nu de server. Orice vecin poate deci trimite celorlalți o notificare cu orice titlu și orice link, inclusiv una care imită un anunț al administrației sau duce în afara aplicației. Variante: notificările să fie create de baza de date atunci când apare anunțul/comentariul (declanșatoare), sau măcar linkul să fie limitat la adrese din aplicație.' });

scenario('NOT-06', 'Cineva citește sau schimbă preferințele de notificare ale altcuiva',
  'Refuzat.',
  async ({ as, sql }) => {
    assert.equal(await as(U.ana).count(`select user_id from public.notification_prefs`), 0);
    expectBlocked(await as(U.ana).run(`update public.notification_prefs set announcements = true where user_id = $1`, [U.dan]));
    expectBlocked(await as(U.ana).run(`insert into public.notification_prefs (user_id, push) values ($1, true)`, [U.ioana]));
    assert.equal((await sql(`select announcements from public.notification_prefs where user_id = $1`, [U.dan]))[0].announcements, false);
  }, { doc: 'Migrarea 0001.' });

// ===========================================================================
area('ARH', 'Arhivare și push', 'Lucruri care țin de un singur om și de telefonul lui.');

scenario('ARH-01', 'Un vecin își arhivează un anunț',
  'Dispare doar din lista lui. Ceilalți îl văd în continuare, și nimeni nu vede ce a arhivat altcineva.',
  async ({ as }) => {
    assert.equal(await as(U.dan).count(`select item_id from public.archived_items`), 0);
    assert.equal(await as(U.ana).count(`select item_id from public.archived_items`), 0);
    assert.equal(await as(U.dan).count(`select id from public.announcements where id = $1`, [A.ann]), 1);
    expectBlocked(await as(U.dan).run(`insert into public.archived_items (user_id, kind, item_id) values ($1, 'announcement', $2)`, [U.ana, A.ann]));
    expectBlocked(await as(U.dan).run(`delete from public.archived_items where user_id = $1`, [U.ioana]));
    expectError(await as(U.dan).run(`insert into public.archived_items (user_id, kind, item_id) values ($1, 'poll', $2)`, [U.dan, A.poll]), /check constraint/);
    expectOk(await as(U.ioana).run(`delete from public.archived_items where user_id = $1 and item_id = $2`, [U.ioana, A.ann]), 1);
  }, { doc: 'Migrarea 0008: „a private act of tidying, not moderation”.' });

scenario('ARH-02', 'Abonamentul de push al unui telefon',
  'Fiecare îl vede doar pe al lui. Când altcineva se autentifică pe același telefon, abonamentul trece la el și fostul proprietar nu mai primește nimic acolo.',
  async ({ as, sql }) => {
    assert.equal(await as(U.dan).count(`select endpoint from public.push_subscriptions`), 0);
    expectBlocked(await as(U.dan).run(`update public.push_subscriptions set user_id = $1 where endpoint = 'https://push.example/ioana'`, [U.dan]));
    expectBlocked(await as(U.dan).run(`insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example/x', $1, 'k', 'a')`, [U.ioana]));
    expectOk(await as(U.dan).run(`select public.claim_push_subscription('https://push.example/ioana', 'k2', 'a2')`));
    const rows = await sql(`select user_id from public.push_subscriptions where endpoint = 'https://push.example/ioana'`);
    assert.deepEqual(rows.map((r) => r.user_id), [U.dan]);
    expectError(await as(U.dan).run(`select public.claim_push_subscription(null, 'k', 'a')`), /required/);
    expectOk(await as(U.ioana).run(`select public.release_push_subscription('https://push.example/ioana')`));
    assert.equal((await sql(`select count(*)::int n from public.push_subscriptions`))[0].n, 0);
  }, { doc: 'Migrarea 0004: „A push subscription belongs to a browser, not to an account.”' });

// ===========================================================================
area('DAT', 'Date la limită', 'Ce se întâmplă cu texte ciudate, foarte lungi sau goale.');

scenario('DAT-01', 'Texte cu diacritice, emoji, ghilimele, alfabete diferite și bucăți de cod',
  'Sunt păstrate și întoarse exact cum au fost scrise, fără să strice nimic.',
  async ({ as, sql }) => {
    const texts = [
      'Șțăîâ ȘȚĂÎÂ — „ghilimele” și ’apostrof’',
      '👨‍👩‍👧‍👦 🏡 ❤️‍🔥',
      'Árvíztűrő tükörfúrógép',
      'مرحبا بالجيران',
      `'; drop table public.issues; --`,
      '<script>alert(1)</script> <img src=x onerror=alert(1)>',
      '{/* comentariu */} ${process.env.SECRET} {{7*7}}',
      'rând 1\nrând 2\r\n\ttab',
    ];
    for (const text of texts) {
      const [row] = await as(U.dan).rows(
        `insert into public.discussions (community_id, author_id, title, body) values ($1, $2, $3, $3) returning id`, [C.A, U.dan, text]);
      const [back] = await as(U.ioana).rows(`select title, body from public.discussions where id = $1`, [row.id]);
      assert.equal(back.title, text); assert.equal(back.body, text);
    }
    assert.ok((await sql(`select to_regclass('public.issues') as t`))[0].t, 'tabelul de sesizări a dispărut');
  }, { doc: 'Studiu de caz: trei limbi de la prima versiune, inclusiv maghiara.' });

scenario('DAT-02', 'Un comentariu de două milioane de caractere',
  'Refuzat: un mesaj are o lungime maximă, altfel un singur om poate îngreuna aplicația pentru toată comunitatea.',
  async ({ as, sql }) => {
    await as(U.dan).run(`insert into public.issue_comments (issue_id, author_id, body) values ($1, $2, repeat('a', 2000000))`, [A.issue, U.dan]);
    const [row] = await sql(`select coalesce(max(char_length(body)), 0)::int n from public.issue_comments where issue_id = $1`, [A.issue]);
    assert.ok(row.n < 100000, `a fost primit un comentariu de ${row.n.toLocaleString('ro-RO')} caractere`);
  }, { doc: 'Migrarea 0014 limitează un emoji la 8 caractere „so the column cannot be used to store a paragraph”; pentru texte nu există nicio limită.' });

scenario('DAT-03', 'Un comentariu, o discuție sau o sesizare fără niciun text',
  'Refuzate: ce nu are conținut nu se trimite.',
  async ({ as, sql }) => {
    const d = as(U.dan);
    await d.run(`insert into public.issue_comments (issue_id, author_id, body) values ($1, $2, '')`, [A.issue, U.dan]);
    await d.run(`insert into public.discussion_replies (discussion_id, author_id, body) values ($1, $2, '   ')`, [A.disc, U.dan]);
    await d.run(`insert into public.discussions (community_id, author_id, title, body) values ($1, $2, '', '')`, [C.A, U.dan]);
    await d.run(`insert into public.issues (community_id, reporter_id, title, description) values ($1, $2, ' ', '')`, [C.A, U.dan]);
    const empty = await sql(
      `select 'comentariu' k from public.issue_comments where btrim(body) = ''
       union all select 'răspuns' from public.discussion_replies where btrim(body) = ''
       union all select 'discuție' from public.discussions where btrim(title) = ''
       union all select 'sesizare' from public.issues where btrim(title) = ''`);
    assert.equal(empty.length, 0, `au fost primite fără text: ${empty.map((e) => e.k).join(', ')}`);
  }, { doc: 'Migrarea 0015 refuză corectarea „into nothing”; trimiterea inițială nu are aceeași regulă.' });

scenario('DAT-04', 'Valori lipsă acolo unde sunt obligatorii, și valori din afara listei permise',
  'Refuzate de baza de date, nu doar de formular.',
  async ({ as }) => {
    const a = as(U.ana);
    expectError(await a.run(`insert into public.announcements (community_id, author_id, title, body) values ($1, $2, null, 'x')`, [C.A, U.ana]), /null value/);
    expectError(await a.run(`insert into public.polls (community_id, author_id, question) values ($1, $2, 'x?')`, [C.A, U.ana]), /null value/);
    expectError(await a.run(`insert into public.funds (community_id, title, amount_bani, created_by) values ($1, null, 100, $2)`, [C.A, U.ana]), /null value/);
    expectError(await a.run(`update public.communities set kind = 'castel' where id = $1`, [C.A]), /check constraint/);
    expectError(await a.run(`update public.communities set join_mode = 'oricine' where id = $1`, [C.A]), /check constraint/);
    expectError(await as(U.dan).run(`insert into public.discussions (community_id, author_id, title, body, status) values ($1, $2, 'x', 'y', 'fixat')`, [C.A, U.dan]), /check constraint/);
    expectError(await as(U.dan).run(`insert into public.issues (community_id, reporter_id, title, description, status) values ($1, $2, 'x', 'y', 'urgent')`, [C.A, U.dan]), /check constraint/);
    expectError(await as(U.dan).run(`insert into public.issue_comments (issue_id, author_id, body) values ($1, $2, 'x')`, ['00000000-0000-4000-8000-000000000000', U.dan]), /row-level security/);
  }, { doc: 'Migrările 0001, 0006, 0016.' });

scenario('DAT-05', 'Un vecin își deschide sesizarea direct cu statusul „rezolvat”',
  'Statusul de pornire îl dă sistemul, nu cel care scrie.',
  async ({ as, sql }) => {
    await as(U.dan).run(`insert into public.issues (community_id, reporter_id, title, description, status) values ($1, $2, 'Totul e bine', 'x', 'resolved')`, [C.A, U.dan]);
    assert.equal((await sql(`select count(*)::int n from public.issues where title = 'Totul e bine' and status <> 'new'`))[0].n, 0,
      'o sesizare a fost creată direct ca „rezolvată” de un vecin simplu');
  }, { doc: 'Migrarea 0001: „Issues: members read+write; staff update status”.' });
