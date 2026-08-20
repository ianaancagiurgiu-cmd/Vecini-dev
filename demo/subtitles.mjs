/*
  The subtitle file, generated from the same SUBS the composition draws, so the
  burned-in line and the .srt can never drift apart.
*/
import { writeFileSync } from 'node:fs';
import { SUBS } from './timeline.mjs';

const stamp = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const f = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(f, 3)}`;
};

export const srt = () =>
  SUBS.map(([a, b, text], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${text}\n`).join('\n');

/* Same lines, for a voice-over artist or a text-to-speech run. */
export const voiceOver = () =>
  SUBS.map(([a, , text]) => `[${stamp(a).slice(3, 8)}] ${text}`).join('\n');

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync('demo/out/vecini-demo.srt', srt());
  writeFileSync('demo/out/voice-over.txt', voiceOver());
  console.log(`  ✓ ${SUBS.length} subtitles`);
}
