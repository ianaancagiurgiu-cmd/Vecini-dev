/*
  Turns the composition into an MP4.

  The stage is loaded once and seeked frame by frame rather than reloaded, and
  each frame is handed straight to ffmpeg's stdin, so nothing is written to disk
  except the finished file. At 30fps for 82 seconds that is 2460 frames.
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

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/vecini-demo.srt`, srt());
writeFileSync(`${OUT}/voice-over.txt`, voiceOver());

const ff = spawn(ffmpeg, [
  '-y',
  '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p',            // the format phones and players actually accept
  '-movflags', '+faststart',        // starts playing before the whole file arrives
  `${OUT}/vecini-demo.mp4`,
], { stdio: ['pipe', 'ignore', 'pipe'] });

let ffErr = '';
ff.stderr.on('data', (d) => { ffErr += d; if (ffErr.length > 8000) ffErr = ffErr.slice(-8000); });
const finished = new Promise((res, rej) => {
  ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}\n${ffErr}`))));
});

/* Backpressure: if ffmpeg is slower than the browser, wait rather than buffer. */
const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`${BASE}?t=0`, { waitUntil: 'networkidle' });
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
    const left = Math.round((TOTAL - done) / rate);
    console.log(`  ${String(done).padStart(4)}/${TOTAL}  ${(t / 1000).toFixed(1)}s  ~${left}s left`);
  }
}

ff.stdin.end();
await browser.close();
await finished;
console.log(`\n  ✓ ${OUT}/vecini-demo.mp4`);
console.log(`  ✓ ${OUT}/vecini-demo.srt`);
console.log(`  ✓ ${OUT}/voice-over.txt`);
