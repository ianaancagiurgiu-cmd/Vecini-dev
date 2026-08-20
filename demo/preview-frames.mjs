/* A contact sheet of key moments, to look at before rendering 2460 frames. */
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { BEATS } from './timeline.mjs';
rmSync('demo/preview', { recursive: true, force: true });
mkdirSync('demo/preview', { recursive: true });

// One frame per scene, taken two thirds of the way through it — late enough
// that anything that fades or pans has arrived. Derived from the beats rather
// than typed out, so retiming the video cannot leave this looking at the gaps.
const MOMENTS = BEATS.map((b) => Math.round(b.t0 + (b.t1 - b.t0) * 0.66));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const t of MOMENTS) {
  await p.goto(`http://localhost:4173/demo-stage/stage.html?t=${t}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.dataset.ready === '1', { timeout: 15000 });
  await p.waitForTimeout(250);
  await p.screenshot({ path: `demo/preview/t${String(t).padStart(5, '0')}.png` });
  console.log('  ✓', t + 'ms');
}
await b.close();
