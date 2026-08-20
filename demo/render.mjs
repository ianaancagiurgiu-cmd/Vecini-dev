/*
  Turns the composition into MP4s.

  The stage is loaded once and seeked frame by frame rather than reloaded, and
  each frame is handed straight to ffmpeg's stdin, so nothing is written to disk
  except the finished files.

  Two files come out of the one pass. The master carries no text: an editor
  builds its own captions from the .srt, and text baked into the pixels cannot
  be taken back out. The subtitled copy is burned from that same .srt a moment
  later, so the two can never drift apart.

  Both carry a silent AAC track. A video with no audio stream at all confuses
  editors that lay everything out along an audio timeline, and it gives the
  voice-over somewhere to land.
*/
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import { FPS, W, H, DURATION } from './timeline.mjs';
import { srt, voiceOver } from './subtitles.mjs';

const BASE = process.env.STAGE || 'http://localhost:4173/demo-stage/stage.html';
const OUT = 'demo/out';
const TOTAL = Math.round((DURATION / 1000) * FPS);

const MASTER = `${OUT}/vecini-demo-fara-text.mp4`;
const BURNED = `${OUT}/vecini-demo.mp4`;
const SRT = `${OUT}/vecini-demo.srt`;

mkdirSync(OUT, { recursive: true });
writeFileSync(SRT, srt());
writeFileSync(`${OUT}/voice-over.txt`, voiceOver());

const run = (args, label) => new Promise((res, rej) => {
  const p = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; if (err.length > 8000) err = err.slice(-8000); });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error(`${label} exited ${c}\n${err}`))));
});

/* Silence, generated rather than shipped as a file. */
const SILENCE = ['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`];
const AUDIO = ['-c:a', 'aac', '-b:a', '128k', '-shortest'];

/* ---------- pass one: the frames ---------- */
const ff = spawn(ffmpeg, [
  '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0',
  ...SILENCE,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p',            // the format phones and editors actually accept
  '-movflags', '+faststart',        // starts playing before the whole file arrives
  ...AUDIO,
  MASTER,
], { stdio: ['pipe', 'ignore', 'pipe'] });

let ffErr = '';
ff.stderr.on('data', (d) => { ffErr += d; if (ffErr.length > 8000) ffErr = ffErr.slice(-8000); });
const encoded = new Promise((res, rej) => {
  ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}\n${ffErr}`))));
});

/* Backpressure: if ffmpeg is slower than the browser, wait rather than buffer. */
const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`${BASE}?subs=0&t=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 30000 });

const started = Date.now();
for (let f = 0; f < TOTAL; f++) {
  const t = Math.round((f / FPS) * 1000);
  await page.evaluate((ms) => window.__draw(ms), t);
  await page.waitForFunction(() => window.__settled(), { timeout: 10000 });
  await write(await page.screenshot({ type: 'png' }));

  if (f % 150 === 0 || f === TOTAL - 1) {
    const done = f + 1;
    const rate = done / ((Date.now() - started) / 1000);
    console.log(`  ${String(done).padStart(4)}/${TOTAL}  ${(t / 1000).toFixed(1)}s  ~${Math.round((TOTAL - done) / rate)}s left`);
  }
}

ff.stdin.end();
await browser.close();
await encoded;
console.log(`\n  ✓ ${MASTER}`);

/* ---------- pass two: the same file with the captions burned on ---------- */
// Colours are ASS's &HBBGGRR, backwards from CSS. Cream box, near-black text,
// matching the design the preview frames were checked against.
const STYLE = [
  'FontName=DejaVu Sans', 'Fontsize=15', 'Bold=1',
  'PrimaryColour=&H00181C1A', 'BackColour=&H0FF0F7FA',
  'BorderStyle=3', 'Outline=4', 'Shadow=0',
  'Alignment=2', 'MarginV=58', 'MarginL=70', 'MarginR=70',
].join(',');

await run([
  '-y', '-i', MASTER,
  '-vf', `subtitles=${SRT}:force_style='${STYLE}'`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', '-c:a', 'copy',
  BURNED,
], 'burn-in');

console.log(`  ✓ ${BURNED}`);
console.log(`  ✓ ${SRT}`);
console.log(`  ✓ ${OUT}/voice-over.txt`);
