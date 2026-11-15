import { area, scenario, assert, expectBlocked, expectError, expectOk, U, C, A, B } from '../harness.mjs';

// ===========================================================================
area('ANU', 'Anunțuri și calendar', 'Scrise de administrație, citite de toți.');

scenario('ANU-01', 'Un anunț cu dată: sfârșit înaintea începutului, sau sfârșit fără început',
  'Ambele sunt refuzate. Un început fără sfârșit, sau cu sfârșit în aceeași clipă, e în regulă.',
  async ({ as }) => {
    const a = as(U.ana);
    const ins = `insert into public.announcements (community_id, author_id, title, body, starts_at, ends_at) values ($1, $2, 'Adunare', 'x', $3, $4)`;
    expectError(await a.run(ins, [C.A, U.ana, '2026-12-10T18:00:00Z', '2026-12-10T17:00:00Z']), /announcements_dates_make_sense/);
    expectError(await a.run(ins, [C.A, U.ana, null, '2026-12-10T17:00:00Z']), /announcements_dates_make_sense/);
    expectOk(await a.run(ins, [C.A, U.ana, '2026-12-10T18:00:00Z', null]), 1);
    expectOk(await a.run(ins, [C.A, U.ana, '2026-12-10T18:00:00Z', '2026-12-10T18:00:00Z']), 1);
    // The same rule has to hold when an existing announcement is edited.
    expectError(await a.run(`update public.announcements set ends_at = starts_at - interval '1 minute' where id = $1`, [A.ann]), /announcements_dates_make_sense/);
  }, { doc: 'Migrarea 0013: „an end before its beginning is a typo rather than a state to render”.' });

scenario('ANU-02', 'Un anunț prioritar al cărui termen a trecut',
  'Nu mai e prioritar, fără ca cineva să fi făcut ceva: prioritatea se citește din dată, nu dintr-o bifă.',
  async ({ as, sql }) => {
    await sql(`update public.announcements set pinned_until = now() - interval '1 minute' where id = $1`, [A.ann]);
    const [row] = await as(U.ioana).rows(`select (pinned_until > now()) as pinned from public.announcements where id = $1`, [A.ann]);
    assert.equal(row.pinned, false);
    assert.equal((await sql(`select count(*)::int n from information_schema.columns where table_name = 'announcements' and column_name = 'pinned'`))[0].n, 0,
      'bifa veche „pinned” încă există lângă dată');
  }, { doc: 'Migrarea 0011 și studiul de caz: „Priority notices carry an expiry date, not a flag”.' });

scenario('ANU-03', 'O ședință anulată e ștearsă din calendar',
  'Administrația o poate șterge; un vecin nu. Ce și-a arhivat cineva despre ea rămâne un rând fără pereche, care nu deranjează pe nimeni.',
  async ({ as, sql }) => {
    expectBlocked(await as(U.ioana).run(`delete from public.announcements where id = $1`, [A.ann]));
    expectOk(await as(U.mihai).run(`delete from public.announcements where id = $1`, [A.ann]), 1);
    assert.equal(await as(U.ioana).count(`select id from public.announcements where id = $1`, [A.ann]), 0);
    assert.equal((await sql(`select count(*)::int n from public.archived_items where item_id = $1`, [A.ann]))[0].n, 1);
  }, { doc: 'Migrarea 0013 („Cancelling”) și 0008 (item_id fără cheie străină, intenționat).' });

// ===========================================================================
area('SES', 'Sesizări', 'Orice vecin raportează; statusul îl schimbă doar administrația.');

scenario('SES-01', 'Cine poate scrie în istoricul unei sesizări',
  'Autorul scrie doar prima linie („nouă”), doar la sesizarea lui. Schimbările de status le scrie administrația.',
  async ({ as }) => {
    const [{ id }] = await as(U.dan).rows(`insert into public.issues (community_id, reporter_id, title, description) values ($1, $2, 'Bec ars', 'Scara B') returning id`, [C.A, U.dan]);
    const h = `insert into public.issue_history (issue_id, status, note, by_id) values ($1, $2, $3, $4)`;
    expectOk(await as(U.dan).run(h, [id, 'new', 'Sesizare trimisă', U.dan]), 1);
    expectBlocked(await as(U.dan).run(h, [id, 'resolved', 'Am rezolvat singur', U.dan]));
    expectBlocked(await as(U.dan).run(h, [id, 'progress', 'x', U.dan]));
    expectBlocked(await as(U.ioana).run(h, [id, 'new', 'x', U.ioana]), 'alt vecin, la sesizarea lui Dan');
    expectOk(await as(U.mihai).run(h, [id, 'progress', 'Am chemat electricianul', U.mihai]), 1);
  }, { doc: 'Migrarea 0003: „a reporter may only add the opening \'new\' entry, and only for an issue they themselves reported”.' });

scenario('SES-02', 'Autorul unei sesizări mai adaugă linii „nouă” în istoric, cu orice text',
  'Refuzat: prima linie se scrie o singură dată.',
  async ({ as, sql }) => {
    // Ioana's issue already has its opening entry from the seed.
    await as(U.ioana).run(`insert into public.issue_history (issue_id, status, note, by_id) values ($1, 'new', 'Rezolvat de administrație, mulțumim!', $2)`, [A.issue, U.ioana]);
    assert.equal((await sql(`select count(*)::int n from public.issue_history where issue_id = $1`, [A.issue]))[0].n, 1,
      'autorul a adăugat o a doua linie în istoric, cu text ales de el');
  }, { doc: 'Migrarea 0003: „only the opening entry”.' });

scenario('SES-03', 'Statusul unei sesizări',
  'Doar administrația îl schimbă, și doar într-una din cele trei valori.',
  async ({ as }) => {
    expectBlocked(await as(U.ioana).run(`update public.issues set status = 'resolved' where id = $1`, [A.issue]), 'chiar și autorul');
    expectError(await as(U.mihai).run(`update public.issues set status = 'closed' where id = $1`, [A.issue]), /check constraint/);
    expectError(await as(U.mihai).run(`update public.issues set status = '' where id = $1`, [A.issue]), /check constraint/);
    expectOk(await as(U.mihai).run(`update public.issues set status = 'resolved' where id = $1`, [A.issue]), 1);
    // Reopening is a status change like any other.
    expectOk(await as(U.ana).run(`update public.issues set status = 'new' where id = $1`, [A.issue]), 1);
  }, { doc: 'Migrarea 0001.' });

scenario('SES-04', '„Susțin această sesizare”: o dată, în nume propriu, și retras doar de cel care a pus-o',
  'A doua apăsare nu numără de două ori; nimeni nu poate retrage susținerea altcuiva.',
  async ({ as, sql }) => {
    expectError(await as(U.dan).run(`insert into public.issue_supporters (issue_id, user_id) values ($1, $2)`, [A.issue, U.dan]), /duplicate key/);
    expectBlocked(await as(U.ioana).run(`delete from public.issue_supporters where issue_id = $1 and user_id = $2`, [A.issue, U.dan]));
    expectBlocked(await as(U.ana).run(`delete from public.issue_supporters where issue_id = $1 and user_id = $2`, [A.issue, U.dan]), 'nici administratorul');
    expectOk(await as(U.dan).run(`delete from public.issue_supporters where issue_id = $1 and user_id = $2`, [A.issue, U.dan]), 1);
    assert.equal((await sql(`select count(*)::int n from public.issue_supporters where issue_id = $1`, [A.issue]))[0].n, 0);
  }, { doc: 'Migrarea 0001.' });

scenario('SES-05', 'După trimitere, sesizarea și comentariile ei nu mai pot fi șterse sau rescrise direct',
  'Nici de autor, nici de alt vecin. Singura cale de a corecta un comentariu e funcția cu fereastra de 15 minute.',
  async ({ as }) => {
    for (const who of [U.ioana, U.dan]) {
      expectBlocked(await as(who).run(`update public.issues set title = 'altceva' where id = $1`, [A.issue]));
      expectBlocked(await as(who).run(`delete from public.issues where id = $1`, [A.issue]));
      expectBlocked(await as(who).run(`delete from public.issue_comments where id = $1`, [A.comment]));
      expectBlocked(await as(who).run(`update public.issue_comments set body = 'altceva' where id = $1`, [A.comment]));
      expectBlocked(await as(who).run(`update public.discussion_replies set body = 'altceva' where id = $1`, [A.reply]));
      expectBlocked(await as(who).run(`delete from public.issue_history where issue_id = $1`, [A.issue]));
    }
  }, { doc: 'Migrarea 0015: „the tables stay closed to updates entirely, and this is the only door”.' });

// ===========================================================================
area('MSG', 'Corectarea unui mesaj trimis', 'Cincisprezece minute, doar mesajul tău, și rămâne semnul „editat”.');

scenario('MSG-01', 'Autorul își corectează comentariul la două minute după trimitere',
  'Textul se schimbă și apare momentul corecturii. O a doua corectură, tot în fereastră, merge și ea.',
  async ({ as, sql }) => {
    expectOk(await as(U.dan).run(`select public.edit_comment('comment', $1, 'Am sunat la firma de lift.')`, [A.comment]));
    expectOk(await as(U.dan).run(`select public.edit_comment('comment', $1, 'Am sunat la firma de lift, vin mâine.')`, [A.comment]));
    const [c] = await sql(`select body, edited_at, created_at from public.issue_comments where id = $1`, [A.comment]);
    assert.equal(c.body, 'Am sunat la firma de lift, vin mâine.');
    assert.ok(c.edited_at, 'lipsește semnul „editat”');
    assert.ok(c.created_at < c.edited_at);
    expectOk(await as(U.dan).run(`select public.edit_comment('reply', $1, 'De acord, cu bănci.')`, [A.reply]));
  }, { doc: 'Migrarea 0015.' });

scenario('MSG-02', 'Exact la marginea ferestrei: 14 minute și 59 de secunde, apoi 15 minute și o secundă',
  'Prima corectură trece, a doua e refuzată.',
  async ({ as, sql }) => {
    await sql(`update public.issue_comments set created_at = now() - interval '14 minutes 59 seconds' where id = $1`, [A.comment]);
    expectOk(await as(U.dan).run(`select public.edit_comment('comment', $1, 'încă la timp')`, [A.comment]));
    await sql(`update public.issue_comments set created_at = now() - interval '15 minutes 1 second' where id = $1`, [A.comment]);
    expectError(await as(U.dan).run(`select public.edit_comment('comment', $1, 'prea târziu')`, [A.comment]), /fifteen minutes/);
    assert.equal((await sql(`select body from public.issue_comments where id = $1`, [A.comment]))[0].body, 'încă la timp');
  }, { doc: 'Migrarea 0015: „created_at > now() - interval \'15 minutes\'”.' });

scenario('MSG-03', 'Cineva corectează mesajul altcuiva',
  'Refuzat pentru oricine în afară de autor — inclusiv pentru administrator.',
  async ({ as, sql }) => {
    for (const who of [U.ioana, U.mihai, U.ana]) {
      expectError(await as(who).run(`select public.edit_comment('comment', $1, 'rescris')`, [A.comment]), /not yours/);
    }
    assert.equal((await sql(`select body from public.issue_comments where id = $1`, [A.comment]))[0].body, 'Am sunat la firma de lift.');
  }, { doc: 'Migrarea 0015: „yours, and inside the window”.' });

scenario('MSG-04', 'Corecturi cu valori greșite: text gol, doar spații, tip necunoscut, id de la alt fel de mesaj',
  'Toate refuzate, cu mesajul rămas neatins.',
  async ({ as, sql }) => {
    const d = as(U.dan);
    expectError(await d.run(`select public.edit_comment('comment', $1, '')`, [A.comment]), /into nothing/);
    expectError(await d.run(`select public.edit_comment('comment', $1, '      ')`, [A.comment]), /into nothing/);
    expectError(await d.run(`select public.edit_comment('comment', $1, null)`, [A.comment]), /into nothing/);
    expectError(await d.run(`select public.edit_comment('anunt', $1, 'x')`, [A.comment]), /unknown kind/);
    // A reply's id, presented as a comment's: there is no comment with that id.
    expectError(await d.run(`select public.edit_comment('comment', $1, 'x')`, [A.reply]), /not yours/);
    assert.equal((await sql(`select body from public.issue_comments where id = $1`, [A.comment]))[0].body, 'Am sunat la firma de lift.');
  }, { doc: 'Migrarea 0015.' });

scenario('MSG-08', 'Un comentariu corectat în ceva ce nu se vede: doar rânduri goale și taburi',
  'Refuzat, la fel ca textul gol: un mesaj nu poate fi „corectat” până dispare.',
  async ({ as, sql }) => {
    // btrim() with no second argument strips spaces and nothing else.
    await as(U.dan).run(`select public.edit_comment('comment', $1, $2)`, [A.comment, ' \n\t\n ']);
    assert.equal((await sql(`select body from public.issue_comments where id = $1`, [A.comment]))[0].body, 'Am sunat la firma de lift.',
      'comentariul a fost înlocuit cu rânduri goale');
  }, { doc: 'Migrarea 0015: „a comment cannot be edited into nothing”.' });

scenario('MSG-05', 'Cineva trimite un comentariu cu data pusă de el, în viitor, ca să-l poată corecta oricând',
  'Refuzat: momentul trimiterii îl stabilește serverul, altfel fereastra de 15 minute nu mai înseamnă nimic.',
  async ({ as, sql }) => {
    const r = await as(U.dan).run(
      `insert into public.issue_comments (issue_id, author_id, body, created_at) values ($1, $2, 'Promit că plătesc până vineri.', now() + interval '10 years') returning id, created_at`,
      [A.issue, U.dan]);
    if (!r.error) {
      const [row] = await sql(`select (created_at > now() + interval '1 minute') as future from public.issue_comments where id = $1`, [r.rows[0].id]);
      assert.equal(row.future, false, 'comentariul a rămas datat peste zece ani, deci poate fi rescris oricând');
    }
  }, { doc: 'Migrarea 0015: „a client permitted to write created_at can extend its own deadline”.' });

scenario('MSG-06', 'Cineva trimite un comentariu cu data pusă în trecut, ca să apară înaintea celorlalte',
  'Refuzat: ordinea unei discuții nu poate fi rescrisă.',
  async ({ as, sql }) => {
    const r = await as(U.dan).run(
      `insert into public.discussion_replies (discussion_id, author_id, body, created_at) values ($1, $2, 'Eu am zis asta primul.', '2020-01-01') returning id`,
      [A.disc, U.dan]);
    if (!r.error) {
      const [row] = await sql(`select (created_at < now() - interval '1 minute') as past from public.discussion_replies where id = $1`, [r.rows[0].id]);
      assert.equal(row.past, false, 'răspunsul a rămas datat în 2020');
    }
  }, { doc: 'Migrarea 0015, același principiu.' });

scenario('MSG-07', 'Un vecin scos din comunitate își mai corectează un comentariu trimis cu un minut înainte',
  'Refuzat: cine nu mai e în comunitate nu mai schimbă nimic în ea.',
  async ({ as, sql }) => {
    await as(U.ana).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.dan, C.A]);
    await as(U.dan).run(`select public.edit_comment('comment', $1, 'Text lăsat în urmă după excludere.')`, [A.comment]);
    assert.equal((await sql(`select body from public.issue_comments where id = $1`, [A.comment]))[0].body, 'Am sunat la firma de lift.',
      'comentariul a fost rescris de cineva care nu mai e membru');
  }, { doc: 'Migrarea 0015 nu verifică apartenența; migrarea 0001 o cere pentru orice scriere.' });

// ===========================================================================
area('REA', 'Aprecieri (inimioara)', 'O inimă pe comentariu, de persoană, retrasă doar de cine a pus-o.');

scenario('REA-01', 'Două apăsări una după alta pe aceeași inimă',
  'Rămâne o singură inimă. La fel pentru un răspuns dintr-o discuție.',
  async ({ as, sql }) => {
    expectError(await as(U.ioana).run(`insert into public.reactions (issue_comment_id, user_id) values ($1, $2)`, [A.comment, U.ioana]), /duplicate key/);
    expectOk(await as(U.ioana).run(`insert into public.reactions (reply_id, user_id) values ($1, $2)`, [A.reply, U.ioana]), 1);
    expectError(await as(U.ioana).run(`insert into public.reactions (reply_id, user_id) values ($1, $2)`, [A.reply, U.ioana]), /duplicate key/);
    assert.equal((await sql(`select count(*)::int n from public.reactions where user_id = $1`, [U.ioana]))[0].n, 2);
  }, { doc: 'Migrarea 0014: „Pressing the heart twice in a row must not make two hearts.”' });

scenario('REA-02', 'O apreciere cu țintă greșită: pe două mesaje deodată, pe niciunul, sau cu un „emoji” cât un paragraf',
  'Toate refuzate.',
  async ({ as }) => {
    const d = as(U.dan);
    expectError(await d.run(`insert into public.reactions (issue_comment_id, reply_id, user_id) values ($1, $2, $3)`, [A.commentOld, A.reply, U.dan]), /reactions_one_target/);
    expectError(await d.run(`insert into public.reactions (user_id) values ($1)`, [U.dan]), /reactions_one_target|row-level security/);
    expectError(await d.run(`insert into public.reactions (issue_comment_id, user_id, emoji) values ($1, $2, '')`, [A.commentOld, U.dan]), /reactions_emoji_short/);
    expectError(await d.run(`insert into public.reactions (issue_comment_id, user_id, emoji) values ($1, $2, 'un text lung')`, [A.commentOld, U.dan]), /reactions_emoji_short/);
    expectOk(await d.run(`insert into public.reactions (issue_comment_id, user_id, emoji) values ($1, $2, '👍')`, [A.commentOld, U.dan]), 1);
  }, { doc: 'Migrarea 0014.' });

scenario('REA-03', 'Cineva retrage sau modifică inima altcuiva',
  'Refuzat. Toți vecinii văd toate inimile, dar fiecare o retrage doar pe a lui.',
  async ({ as, sql }) => {
    assert.equal(await as(U.dan).count(`select id from public.reactions where issue_comment_id = $1`, [A.comment]), 1);
    expectBlocked(await as(U.dan).run(`delete from public.reactions where issue_comment_id = $1 and user_id = $2`, [A.comment, U.ioana]));
    expectBlocked(await as(U.ana).run(`delete from public.reactions where issue_comment_id = $1`, [A.comment]), 'nici administratorul');
    expectBlocked(await as(U.ioana).run(`update public.reactions set emoji = '💔' where user_id = $1`, [U.ioana]), 'nici autorul nu o poate schimba, doar retrage');
    expectOk(await as(U.ioana).run(`delete from public.reactions where issue_comment_id = $1 and user_id = $2`, [A.comment, U.ioana]), 1);
    assert.equal((await sql(`select count(*)::int n from public.reactions`))[0].n, 0);
  }, { doc: 'Migrarea 0014: „Deliberately no update policy.”' });

scenario('REA-04', 'Cineva pleacă din comunitate și vrea să-și retragă inima rămasă în urmă',
  'Nu mai vede comentariul, dar își poate retrage inima care încă se numără.',
  async ({ as, sql }) => {
    await as(U.ioana).run(`delete from public.memberships where user_id = $1 and community_id = $2`, [U.ioana, C.A]);
    assert.equal(await as(U.ioana).count(`select id from public.issue_comments where id = $1`, [A.comment]), 0);
    expectOk(await as(U.ioana).run(`delete from public.reactions where user_id = $1`, [U.ioana]), 1);
    assert.equal((await sql(`select count(*)::int n from public.reactions`))[0].n, 0);
  }, { doc: 'Migrarea 0014: „Taking yours back needs no membership check.”' });

scenario('REA-05', 'Comentariul apreciat dispare',
  'Inimile lui dispar odată cu el, ca să nu fie numărate la nesfârșit.',
  async ({ sql }) => {
    await sql(`delete from public.issue_comments where id = $1`, [A.comment]);
    assert.equal((await sql(`select count(*)::int n from public.reactions`))[0].n, 0);
  }, { doc: 'Migrarea 0014: „Two real references cascade on their own.”' });

// ===========================================================================
area('SON', 'Sondaje', 'Rezultatul e public, votul e al fiecăruia.');

scenario('SON-01', 'Un vecin votează de două ori aceeași variantă',
  'Al doilea vot e refuzat.',
  async ({ as, sql }) => {
    expectOk(await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt2, U.dan]), 1);
    expectError(await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt2, U.dan]), /already_voted|duplicate key/);
    assert.equal((await sql(`select count(*)::int n from public.poll_votes where poll_id = $1 and user_id = $2`, [A.poll, U.dan]))[0].n, 1);
    // The same in a poll that takes several answers: the same answer twice is still once.
    await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.pollMulti, A.optM1, U.dan]);
    expectError(await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.pollMulti, A.optM1, U.dan]), /duplicate key/);
  }, { doc: 'Migrarea 0001: cheia primară a votului.' });

scenario('SON-02', 'Într-un sondaj cu o singură variantă de ales, un vecin votează și „Da”, și „Nu”',
  'Al doilea vot e refuzat: un om, un vot.',
  async ({ as, sql }) => {
    // Ioana has already voted "Da" in the seed.
    await as(U.ioana).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt2, U.ioana]);
    assert.equal((await sql(`select count(*)::int n from public.poll_votes where poll_id = $1 and user_id = $2`, [A.poll, U.ioana]))[0].n, 1,
      'același om are două voturi într-un sondaj cu alegere unică');
    // Both answers sent together, by somebody who has not voted yet.
    expectError(await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3), ($1, $4, $3)`, [A.poll, A.opt1, U.dan, A.opt2]), /already_voted/);
    assert.equal((await sql(`select count(*)::int n from public.poll_votes where poll_id = $1 and user_id = $2`, [A.poll, U.dan]))[0].n, 0);
  }, { doc: 'Studiu de caz: deciziile au „a record of who agreed to what”; coloana polls.multi deosebește cele două feluri de sondaj.' });

scenario('SON-03', 'Într-un sondaj cu mai multe variante, un vecin alege două',
  'Ambele voturi sunt primite.',
  async ({ as }) => {
    expectOk(await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3), ($1, $4, $3)`, [A.pollMulti, A.optM1, U.dan, A.optM2]), 2);
  }, { doc: 'Migrarea 0001: polls.multi.' });

scenario('SON-04', 'Un vecin votează într-un sondaj închis de administrație',
  'Refuzat.',
  async ({ as }) => {
    expectError(await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.pollClosed, A.optClosed, U.dan]), /poll_closed|row-level security/);
  }, { doc: 'Migrarea 0001: „p.closed = false”.' });

scenario('SON-05', 'Un vecin votează după ce termenul sondajului a trecut, dar nimeni nu l-a închis manual',
  'Refuzat: termenul e termen, chiar dacă administratorul a uitat să apese „închide”.',
  async ({ as, sql }) => {
    await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.pollExpired, A.optExpired, U.dan]);
    assert.equal((await sql(`select count(*)::int n from public.poll_votes where poll_id = $1`, [A.pollExpired]))[0].n, 0,
      'votul a fost primit cu o zi după termen');
  }, { doc: 'Studiu de caz, constrângerea a treia: „Anything that depends on a person remembering to do it will not be done.”' });

scenario('SON-06', 'Un vot care leagă un sondaj de varianta altui sondaj',
  'Refuzat: varianta trebuie să fie a sondajului în care votezi.',
  async ({ as, sql }) => {
    await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.optClosed, U.dan]);
    // Maria belongs to both communities, so she can read both polls.
    await as(U.maria).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, B.opt1, U.maria]);
    const stray = await sql(
      `select v.user_id from public.poll_votes v join public.poll_options o on o.id = v.option_id where o.poll_id <> v.poll_id`);
    assert.equal(stray.length, 0, `${stray.length} voturi indică o variantă din alt sondaj`);
  }, { doc: 'Migrarea 0001: votul are și poll_id, și option_id, fără nicio legătură între ele.' });

scenario('SON-07', 'Un vecin se uită în baza de date cine cu ce a votat',
  'Vede câte voturi are fiecare variantă și dacă el însuși a votat — nu și numele celorlalți.',
  async ({ as }) => {
    const mine = await as(U.dan).rows(`select user_id from public.poll_votes where poll_id = $1`, [A.poll]);
    assert.ok(mine.every((v) => v.user_id === U.dan), 'Dan vede că Ioana a votat „Da”: votul nu e secret');
  }, { doc: 'Studiu de caz, „The product”: „The count is public and the ballot is anonymous.”' });

scenario('SON-08', 'Nici administratorul nu vede cine cu ce a votat',
  'Votul e anonim și față de administrație.',
  async ({ as }) => {
    const seen = await as(U.ana).rows(`select user_id from public.poll_votes where poll_id = $1`, [A.poll]);
    assert.ok(seen.every((v) => v.user_id === U.ana), 'administratorul vede votul fiecărui vecin');
  }, { doc: 'Studiu de caz: „the ballot is anonymous”.' });

scenario('SON-12', 'Rezultatul unui sondaj, cerut de un vecin, de un om din altă comunitate și de un vizitator',
  'Vecinul primește numărul de voturi pentru fiecare variantă — inclusiv zero — fără niciun nume. Ceilalți nu primesc nimic.',
  async ({ as, anon }) => {
    await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt1, U.dan]);
    const rows = await as(U.mihai).rows(`select * from public.poll_results($1)`, [C.A]);
    const count = (opt) => rows.find((r) => r.option_id === opt)?.votes;
    assert.equal(count(A.opt1), 2);
    assert.equal(count(A.opt2), 0);
    assert.deepEqual(Object.keys(rows[0]).sort(), ['option_id', 'poll_id', 'votes']);
    assert.equal(rows.length, 6, 'toate variantele tuturor sondajelor comunității');
    assert.equal(await as(U.carmen).count(`select * from public.poll_results($1)`, [C.A]), 0);
    assert.equal(await as(U.radu).count(`select * from public.poll_results($1)`, [C.A]), 0);
    const r = await anon().run(`select * from public.poll_results($1)`, [C.A]);
    assert.ok(r.error || r.rowCount === 0);
    // Somebody in both communities gets each one's own.
    assert.equal(await as(U.maria).count(`select * from public.poll_results($1)`, [C.B]), 2);
  }, { doc: 'Studiu de caz: „The count is public and the ballot is anonymous.” Migrarea 0021.' });

scenario('SON-09', 'Un vot dat nu mai poate fi schimbat sau retras',
  'Nici de cel care a votat, nici de administrație.',
  async ({ as, sql }) => {
    expectBlocked(await as(U.ioana).run(`update public.poll_votes set option_id = $1 where poll_id = $2 and user_id = $3`, [A.opt2, A.poll, U.ioana]));
    expectBlocked(await as(U.ioana).run(`delete from public.poll_votes where poll_id = $1 and user_id = $2`, [A.poll, U.ioana]));
    expectBlocked(await as(U.ana).run(`delete from public.poll_votes where poll_id = $1`, [A.poll]));
    expectBlocked(await as(U.ana).run(`delete from public.polls where id = $1`, [A.poll]), 'un sondaj nu poate fi șters');
    expectBlocked(await as(U.ana).run(`update public.poll_options set label = 'Nu' where id = $1`, [A.opt1]), 'eticheta unei variante nu poate fi schimbată după');
    assert.equal((await sql(`select option_id from public.poll_votes where poll_id = $1 and user_id = $2`, [A.poll, U.ioana]))[0].option_id, A.opt1);
  }, { doc: 'Migrarea 0001: fără politici de modificare sau ștergere pe voturi, variante și sondaje.' });

scenario('SON-10', 'După ce oamenii au votat, administratorul schimbă întrebarea sondajului',
  'Astăzi reușește: voturile date pentru „Schimbăm poarta?” rămân lipite de noua întrebare.',
  async ({ as, sql }) => {
    expectOk(await as(U.ana).run(`update public.polls set question = 'Majorăm fondul de rulment cu 50%?' where id = $1`, [A.poll]), 1);
    assert.equal((await sql(`select count(*)::int n from public.poll_votes where poll_id = $1`, [A.poll]))[0].n, 1);
    // Reopening a closed poll is the same kind of thing.
    expectOk(await as(U.ana).run(`update public.polls set closed = false where id = $1`, [A.pollClosed]), 1);
  }, { decide: 'Administrația poate schimba întrebarea, termenul și tipul unui sondaj după ce s-a votat, poate redeschide unul închis și poate adăuga variante noi. Variantele existente și voturile sunt protejate, întrebarea nu. Dacă sondajele țin loc de „cine a fost de acord cu ce”, întrebarea ar trebui înghețată după primul vot.' });

scenario('SON-11', 'Un vecin votează în numele altuia sau închide el sondajul',
  'Refuzat.',
  async ({ as }) => {
    expectBlocked(await as(U.dan).run(`insert into public.poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)`, [A.poll, A.opt2, U.mihai]));
    expectBlocked(await as(U.dan).run(`update public.polls set closed = true where id = $1`, [A.poll]));
    expectBlocked(await as(U.dan).run(`update public.polls set ends_at = now() - interval '1 day' where id = $1`, [A.poll]));
  }, { doc: 'Migrarea 0001: „Polls: members read+vote; staff create/close.”' });
