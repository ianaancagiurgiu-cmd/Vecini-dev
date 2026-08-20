/* A contact sheet of key moments, to look at before rendering 2460 frames. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('demo/preview', { recursive: true });

const MOMENTS = [3000, 13000, 21000, 28500, 34800, 41000, 46000, 52000, 59500, 65000, 70000, 78000];
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
