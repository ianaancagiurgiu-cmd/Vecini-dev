/*
  The scenarios, written out for somebody who is not going to read the code.

  Generated from the same registry the runner executes, so the document
  cannot describe a test that does not exist or miss one that does — the
  failure mode of every hand-kept test plan. Rewritten on each full run.
*/
import { NAMES } from './harness.mjs';

const SEV = [
  ['critic', 'Critic', 'Datele unei comunități ajung la cineva din afara ei.'],
  ['ridicat', 'Ridicat', 'O promisiune pe care produsul o face în scris și nu o ține.'],
  ['mediu', 'Mediu', 'O regulă care poate fi ocolită de cineva deja aflat în comunitate.'],
  ['scazut', 'Scăzut', 'Dezordine cu efect limitat, sau care cere un efort neobișnuit ca să conteze.'],
];
const ROOTS = {
  intrare: 'Intrarea în comunitate',
  profiluri: 'Profiluri',
  vot: 'Sondaje',
  notificari: 'Notificări',
  moderare: 'Moderare și status',
  timp: 'Mesaje și momentul lor',
  fonduri: 'Fonduri',
  fisiere: 'Fișiere',
  limite: 'Limite de text',
};
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const ICON = { OK: '✅ trece', PROBLEMA: '❌ problemă', ESEC: '🟥 eșec neașteptat', INCHIS: '🟦 de actualizat' };

export function render({ ranAt, migrations, results }) {
  const n = (o) => results.filter((r) => r.outcome === o).length;
  const problems = results.filter((r) => r.outcome === 'PROBLEMA');
  const decide = results.filter((r) => r.decide);
  const day = new Date(ranAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
  const out = [];
  const p = (...lines) => out.push(...lines, '');

  p('# Scenarii de test pentru baza de date');
  p('> Document generat automat de `npm run test:db`. Nu îl edita de mână: se rescrie la fiecare rulare, din aceleași scenarii care se execută.');

  p('## Pe scurt');
  p(`Rulat la ${day}, pe o bază de date PostgreSQL reală, cu toate cele ${migrations.length} migrări aplicate în ordine.`);
  p(`| | |`, `|---|---|`,
    `| Scenarii rulate | **${results.length}** |`,
    `| Trec | **${n('OK')}** |`,
    `| Probleme confirmate | **${n('PROBLEMA')}** |`,
    `| De decis (comportament nedocumentat) | **${decide.length}** |`,
    `| Eșecuri neașteptate | **${n('ESEC')}** |`);
  for (const [key, label] of SEV) {
    const c = problems.filter((r) => r.gap.sev === key).length;
    if (c) out.push(`- **${label}:** ${c}`);
  }
  out.push('');

  p('## Ce se testează și cum');
  p('Testele de interfață (cele din `tests/`) verifică ce face un ecran cu un răspuns dat. Nu pot dovedi că o comunitate nu vede datele alteia, pentru că răspunsul îl dau ele însele. Regula aceea nu stă în ecrane, ci în baza de date.');
  p('De aceea scenariile de aici rulează direct pe baza de date: fiecare e executat **ca un anume om** — cu rolul și identitatea lui, exact cum îl vede Supabase — și încearcă ceva ce are sau nu are voie să facă. După fiecare scenariu, tot ce a făcut se anulează, deci scenariile nu se influențează între ele.');
  p('Fiecare scenariu verifică ce **promite documentația** (studiul de caz și explicațiile din migrări), nu ce se întâmplă să facă codul. Unde cele două diferă, scenariul pică și apare mai jos ca problemă.');

  p('### Personajele');
  p('| Cine | Unde locuiește | Rol |', '|---|---|---|',
    `| ${NAMES.ana} | A — Aleea Teilor 15-20 | administrator |`,
    `| ${NAMES.mihai} | A | moderator |`,
    `| ${NAMES.ioana} | A | vecin |`,
    `| ${NAMES.dan} | A | vecin |`,
    `| ${NAMES.bogdan} | B — Strada Popești 8 | administrator |`,
    `| ${NAMES.carmen} | B | vecin |`,
    `| ${NAMES.maria} | A și B | vecin în amândouă |`,
    `| ${NAMES.radu} | nicăieri | are cont, dar nicio comunitate |`,
    '| vizitatorul | — | fără cont, doar cu cheia publică a aplicației |');

  p('## Probleme găsite');
  if (!problems.length) p('Niciuna.');
  for (const [key, label, meaning] of SEV) {
    const group = problems.filter((r) => r.gap.sev === key);
    if (!group.length) continue;
    p(`### ${label} — ${group.length}`, `*${meaning}*`);
    const roots = [...new Set(group.map((r) => r.gap.root))];
    for (const root of roots) {
      p(`**${ROOTS[root] || root}**`);
      out.push('| Nr. | Ce s-a încercat | Ce ar fi trebuit să se întâmple | De ce se întâmplă altfel |', '|---|---|---|---|');
      for (const r of group.filter((x) => x.gap.root === root)) {
        out.push(`| ${r.id} | ${cell(r.title)} | ${cell(r.expected)} | ${cell(r.gap.why)} |`);
      }
      out.push('');
    }
  }

  p('## De decis');
  p('Scenariile de mai jos trec: ele doar fixează ce se întâmplă astăzi. Dar ce se întâmplă astăzi nu e scris nicăieri ca fiind intenționat, așa că rămâne o decizie de produs, nu un defect.');
  out.push('| Nr. | Situația | Ce se întâmplă astăzi | De hotărât |', '|---|---|---|---|');
  for (const r of decide) out.push(`| ${r.id} | ${cell(r.title)} | ${cell(r.expected)} | ${cell(r.decide)} |`);
  out.push('');

  p('## Toate scenariile');
  let last = null;
  for (const r of results) {
    if (r.area.code !== last) {
      if (last) out.push('');
      p(`### ${r.area.code} — ${r.area.title}`);
      if (r.area.intro) p(r.area.intro);
      out.push('| Nr. | Scenariu | Rezultat așteptat | Rezultat | Regula vine din |', '|---|---|---|---|---|');
      last = r.area.code;
    }
    const outcome = r.decide && r.outcome === 'OK' ? '⚠️ trece, de decis' : ICON[r.outcome];
    out.push(`| ${r.id} | ${cell(r.title)} | ${cell(r.expected)} | ${outcome} | ${cell(r.doc || (r.decide ? '— (nedocumentat)' : ''))} |`);
  }
  out.push('');

  p('## Cum se rulează');
  p('```', 'npm run test:db            # toate scenariile; rescrie și acest document',
    'node tests-db/run.mjs IZO  # doar o arie', "node tests-db/run.mjs 'SON-0[78]'  # doar câteva", '```');
  p('Are nevoie de un PostgreSQL local în care poate crea și șterge o bază de date de test (`vecini_test`). Nu se conectează niciodată la baza de date reală.');
  p('Când o problemă e reparată, scenariul ei începe să treacă și rularea o semnalează ca „de actualizat”: atunci se șterge rândul ei din `tests-db/known-problems.mjs`, iar scenariul devine un test obișnuit, care de-acum trebuie să treacă mereu.');
  return out.join('\n');
}
