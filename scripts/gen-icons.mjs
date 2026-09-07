/*
  Draws every raster copy of the Vecini mark from the one vector original.

      node scripts/gen-icons.mjs

  Output:
    public/icon-180.png           iOS home screen (iOS rounds the corners itself)
    public/icon-192.png           Android / desktop, unmasked
    public/icon-512.png           the same, large
    public/icon-maskable-512.png  Android adaptive icons, mark inside the safe circle
    public/favicon.svg            browser tab, mark on its own cream tile
    public/logo-email.png         transparent, for the email templates

  Nothing here is hand-drawn: public/logo.svg is the source and this only places
  it. Re-run it whenever that file changes, and commit what comes out — the PNGs
  are served as-is, they are not part of the Vite build.

  It renders through the Chromium that Playwright already installs for the test
  suite, which is why this is a script you run rather than a build step: a
  contributor without browsers can still build the app.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const out = (name) => fileURLToPath(new URL(`public/${name}`, root));

const source = readFileSync(fileURLToPath(new URL('public/logo.svg', root)), 'utf8');
const inner = source.slice(source.indexOf('>', source.indexOf('<svg')) + 1, source.lastIndexOf('</svg>'));
const [, vbW, vbH] = source.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);

// The cream of the logo artwork, which is also the app's paper.
const CREAM = '#f4efe4';

/*
  Her artwork puts the mark across 69% of the tile, sitting a little below the
  middle — the roof needs less room above it than the two figures need below.
  Reproduced here rather than re-centred, so the icon on the home screen is the
  logo she drew and not a variation on it.
*/
const ART = { scale: 244 / 352, cx: 0.5, cy: 0.531 };

/*
  Android masks an adaptive icon down to whatever shape the launcher likes, and
  guarantees only the middle 80% circle survives. The whole mark has to fit
  inside that circle, corner to corner, which means drawing it smaller.
*/
const SAFE = (() => {
  const half = Math.hypot(vbW, vbH) / 2;                  // mark's half-diagonal
  return { scale: (0.4 * 352 / half) * (vbW / 352), cx: 0.5, cy: 0.5 };
})();

function page(size, { scale, cx, cy }, background) {
  const w = size * scale, h = w * (vbH / vbW);
  return `<!doctype html><meta charset="utf-8"><body style="margin:0">
    <div style="position:relative;width:${size}px;height:${size}px;overflow:hidden;
                background:${background || 'transparent'}">
      <svg viewBox="0 0 ${vbW} ${vbH}" width="${w}" height="${h}"
           xmlns="http://www.w3.org/2000/svg"
           style="position:absolute;left:${size * cx - w / 2}px;top:${size * cy - h / 2}px">${inner}</svg>
    </div></body>`;
}

const browser = await chromium.launch();
const tab = await browser.newPage({ deviceScaleFactor: 1 });

async function shot(file, size, placement, background) {
  await tab.setViewportSize({ width: size, height: size });
  await tab.setContent(page(size, placement, background));
  await tab.screenshot({ path: out(file), omitBackground: !background });
  console.log(file, `${size}x${size}`);
}

await shot('icon-180.png', 180, ART, CREAM);
await shot('icon-192.png', 192, ART, CREAM);
await shot('icon-512.png', 512, ART, CREAM);
await shot('icon-maskable-512.png', 512, SAFE, CREAM);
// Twice the 44 px the emails draw it at, for the screens that ask for it.
await shot('logo-email.png', 88, { scale: 1, cx: 0.5, cy: 0.5 }, null);

await browser.close();

// A tab favicon is a 16 px square: the mark alone would be a smudge of two
// colours, so it keeps the tile the logo artwork gives it.
const w = ART.scale * 100, h = w * (vbH / vbW);
const n = (v) => v.toFixed(2);
writeFileSync(out('favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${CREAM}"/>
  <svg x="${n(100 * ART.cx - w / 2)}" y="${n(100 * ART.cy - h / 2)}" width="${n(w)}" height="${n(h)}"
       viewBox="0 0 ${vbW} ${vbH}">${inner.trim()}</svg>
</svg>
`);
console.log('favicon.svg');
