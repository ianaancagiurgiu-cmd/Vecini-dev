/*
  Builds supabase/run-all-pending.sql out of the migration files themselves.

      node scripts/build-pending-sql.mjs

  The bundle is the file Iana actually pastes into the Supabase SQL editor, and
  it used to be assembled by hand. That is why it went stale: three migrations
  were written after it and none of them found their way in, and nothing said
  so. Generating it means the bundle cannot be older than the migrations again.

  It carries everything from 0007 on. Those are the migrations that came after
  the app was first put up, every one of them written to survive being run
  twice, so pasting the whole thing is safe whatever state a database is in —
  which matters, because the honest answer to "what is already applied here?" is
  usually "nobody is quite sure".

  Each migration needs a line in DESCRIERI below, in Romanian, saying what it is
  for. A migration without one stops the build rather than being quietly shipped
  under a filename nobody can read.
*/
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../supabase/', import.meta.url));
const DE_LA = 7;

// Romanian, for the person running it — the migrations themselves explain
// themselves in English to whoever is reading the code.
const DESCRIERI = {
  '0007_account_deletion.sql':
    'stergerea contului: contul se goleste, nu dispare, ca sa nu ramana gauri in istoricul comunitatii',
  '0008_archive.sql':
    'arhivarea: fiecare isi poate da la o parte anunturi si sesizari, fara sa le ascunda si altora',
  '0009_neighbour_phones.sql':
    'numarul de telefon se muta intr-un tabel al lui, cu comutator de vizibilitate, ca sa nu mai fie citibil de oricine e logat',
  '0010_admin_handover.sql':
    'predarea comunitatii si al doilea administrator, plus regula care opreste ramanerea fara niciunul',
  '0011_priority_until.sql':
    'anunturile prioritare capata termen: stau sus pana la o data, apoi coboara singure',
  '0012_events.sql':
    'calendarul asociatiei: sedinte si termene cu data lor, separat de textul anunturilor',
  '0013_announcement_dates.sql':
    'anuntul si evenimentul devin acelasi lucru: un anunt poate avea o data, iar calendarul e felul in care te uiti la cele cu data',
  '0014_reactions.sql':
    'inimioara: poti aprecia un comentariu de la o sesizare sau un raspuns dintr-o discutie, o singura data, si o poti retrage',
  '0015_comment_edits.sql':
    'corectarea propriului mesaj in primele 15 minute, cu marcajul "editat" langa ora',
};

const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .filter((f) => Number(f.slice(0, 4)) >= DE_LA)
  .sort();

const lipsa = files.filter((f) => !DESCRIERI[f]);
if (lipsa.length) {
  console.error(`Fara descriere in scripts/build-pending-sql.mjs: ${lipsa.join(', ')}`);
  console.error('Adauga o linie in DESCRIERI pentru fiecare, apoi ruleaza din nou.');
  process.exit(1);
}

/*
  The whole bundle runs as one transaction, so a failure halfway through leaves
  the database exactly as it was rather than half-migrated. Two of the files
  open one of their own; those have to come out, or the first `commit` would end
  the outer transaction and everything after it would run unprotected.
*/
const body = files.map((f) => {
  const sql = readFileSync(dir + f, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(begin|commit)\s*;\s*$/i.test(line))
    .join('\n')
    .trim();
  const rule = '-- '.padEnd(64, '=');
  return `${rule}\n-- ${f}\n-- ${DESCRIERI[f]}\n${rule}\n\n${sql}\n`;
}).join('\n\n');

const cuprins = files.map((f) => `--   ${f.slice(0, 4)} — ${DESCRIERI[f]}`).join('\n');

const out = `-- Vecini — toate migrarile de dupa lansare, intr-un singur fisier.
--
-- GENERAT. Nu-l edita de mana: modifica fisierul de migrare si ruleaza
--   node scripts/build-pending-sql.mjs
--
-- Se poate rula oricand si de cate ori vrei. Daca o parte e deja aplicata,
-- rularea din nou nu strica nimic si nu pierzi date — fiecare migrare verifica
-- intai ce gaseste. Deci nu trebuie sa stii dinainte ce ai rulat si ce nu.
--
-- Ce contine:
${cuprins}
--
-- Unde se ruleaza: Supabase -> SQL Editor -> New query -> lipesti tot -> Run.
--
-- Ce vezi dupa: ruleaza tot sau nu ruleaza nimic. Totul e intr-o singura
-- tranzactie, asa ca daca se opreste la mijloc baza de date ramane exact cum
-- era inainte, nu pe jumatate migrata.
--
-- Supabase te va avertiza despre "destructive operations". Le stergem intr-adevar
-- pe acestea doua, si pe amandoua le mutam intai in altceva:
--   * profiles.phone      — numerele trec in member_phones inainte (0009)
--   * announcements.pinned — ce era fixat primeste o saptamana de prioritate (0011)
-- In rest nu se sterge nimic.
--
-- Dupa ce rulezi, verifica cu supabase/check-pending.sql: iti spune, pe linii,
-- ce a ajuns in baza de date si ce lipseste.

begin;

${body}
commit;
`;

/*
  check-pending.sql is the other half of this: the bundle applies the
  migrations, that file says which of them arrived. It is hand-written, because
  only a person can say which object proves a migration ran — but it can fall
  behind exactly the way the bundle did, so at least make it impossible to add a
  migration and forget it.
*/
const verificare = readFileSync(dir + 'check-pending.sql', 'utf8');
const neverificate = files.filter((f) => !verificare.includes(f.replace(/\.sql$/, '')));
if (neverificate.length) {
  console.error(`Lipsesc din supabase/check-pending.sql: ${neverificate.join(', ')}`);
  console.error('Adauga acolo un obiect care dovedeste ca migrarea a rulat, apoi ruleaza din nou.');
  process.exit(1);
}

writeFileSync(dir + 'run-all-pending.sql', out);
console.log(`run-all-pending.sql — ${files.length} migrari, ${out.split('\n').length} linii`);
files.forEach((f) => console.log('  ' + f));
