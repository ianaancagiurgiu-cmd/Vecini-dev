/*
  node tests-db/run.mjs            — everything
  node tests-db/run.mjs IZO        — one area
  node tests-db/run.mjs 'IZO-2.'   — anything the pattern matches

  Needs a PostgreSQL it may create and drop a database in. Connection comes
  from the usual PG* variables; with none set it uses the local socket.

  Exit code is 0 unless something failed that was not already known about:
  a confirmed gap is reported, counted and does not fail the run, because a
  suite that is always red stops being read.
*/
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setup, runAll, registry } from './harness.mjs';
import { render } from './report.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
for (const f of readdirSync(here('./scenarios/')).filter((x) => x.endsWith('.mjs')).sort()) {
  await import(`./scenarios/${f}`);
}

const ids = registry.map((s) => s.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) { console.error(`Id-uri folosite de două ori: ${dup.join(', ')}`); process.exit(2); }

const pattern = process.argv[2] ? new RegExp(process.argv[2]) : null;
const { client, migrations } = await setup();
const results = await runAll(client, { only: pattern });
await client.end();

const MARK = { OK: '  ok  ', ESEC: ' EȘEC ', PROBLEMA: ' PROBL', INCHIS: 'ÎNCHIS' };
let lastArea = null;
for (const r of results) {
  if (r.area.code !== lastArea) { console.log(`\n${r.area.code} — ${r.area.title}`); lastArea = r.area.code; }
  console.log(`[${MARK[r.outcome]}] ${r.id}  ${r.title}`);
  if (r.outcome === 'ESEC' || r.outcome === 'PROBLEMA') console.log(`           ↳ ${r.detail}`);
  if (r.outcome === 'INCHIS') console.log('           ↳ era trecut ca problemă cunoscută și acum trece — șterge-i rândul din known-problems.mjs.');
}

const n = (o) => results.filter((r) => r.outcome === o).length;
console.log(`\n${results.length} scenarii pe ${migrations.length} migrări: ${n('OK')} trec, ${n('PROBLEMA')} probleme confirmate, ${n('ESEC')} eșecuri neașteptate, ${n('INCHIS')} probleme închise.`);

// Only a full run rewrites the document: a partial one would describe a
// product with a tenth of its rules.
if (!pattern) {
  const doc = here('../docs/scenarii-de-test.md');
  writeFileSync(doc, render({ ranAt: new Date().toISOString(), migrations, results }));
  console.log(`Raport: docs/scenarii-de-test.md`);
}
process.exit(n('ESEC') > 0 ? 1 : 0);
