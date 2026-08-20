/*
  The subtitle file, generated from the same SUBS the composition draws, so the
  burned-in line and the .srt can never drift apart.
*/
import { writeFileSync } from 'node:fs';
import { SUBS, W, H } from './timeline.mjs';

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

/*
  The same lines as ASS, for burning onto the picture.

  Not because .srt cannot be burned — it can — but because it carries no
  resolution, so the renderer invents one (384×288) and every size and margin
  then has to be back-computed through a scale factor that is easy to get
  wrong and impossible to read later. Declaring PlayRes here makes every number
  below a plain pixel count at 1080×1920.

  Colours are &HAABBGGRR: alpha first, then blue, green, red — backwards from
  CSS in two ways at once. With BorderStyle 3 the box is drawn in OutlineColour,
  not BackColour, which is the trap that paints white text on a black slab.
*/
const ass = (hex, alpha = '00') => {
  const [, r, g, b] = /^#?(\w\w)(\w\w)(\w\w)$/.exec(hex);
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
};

export const assFile = ({
  font = 'DejaVu Sans', size = 40, ink = '#1a1c18', box = '#faf7f0', marginV = 96, marginX = 70,
} = {}) => [
  '[Script Info]',
  'ScriptType: v4.00+',
  'WrapStyle: 0',
  'ScaledBorderAndShadow: yes',
  `PlayResX: ${W}`,
  `PlayResY: ${H}`,
  '',
  '[V4+ Styles]',
  'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,'
    + 'Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,'
    + 'Alignment,MarginL,MarginR,MarginV,Encoding',
  `Style: Sub,${font},${size},${ass(ink)},${ass(ink)},${ass(box)},${ass(box)},`
    + `-1,0,0,0,100,100,0,0,3,14,0,2,${marginX},${marginX},${marginV},1`,
  '',
  '[Events]',
  'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
  ...SUBS.map(([a, b, text]) =>
    `Dialogue: 0,${assStamp(a)},${assStamp(b)},Sub,,0,0,0,,${text.replace(/\n/g, '\\N')}`),
].join('\n') + '\n';

// ASS wants h:mm:ss.cc — one digit of hours, hundredths rather than thousandths.
const assStamp = (ms) => {
  const s = stamp(ms);
  return `${Number(s.slice(0, 2))}:${s.slice(3, 8)}.${s.slice(9, 11)}`;
};

/* Same lines, for a voice-over artist or a text-to-speech run. */
export const voiceOver = () =>
  SUBS.map(([a, , text]) => `[${stamp(a).slice(3, 8)}] ${text}`).join('\n');

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync('demo/out/vecini-demo.srt', srt());
  writeFileSync('demo/out/voice-over.txt', voiceOver());
  console.log(`  ✓ ${SUBS.length} subtitles`);
}
