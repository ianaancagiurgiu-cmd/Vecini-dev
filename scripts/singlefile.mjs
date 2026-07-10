// Inline built JS/CSS into a single self-contained HTML file at dist/vecini.html
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const dist = new URL('../dist/', import.meta.url).pathname;
let html = readFileSync(dist + 'index.html', 'utf8');
const assets = readdirSync(dist + 'assets');

for (const f of assets) {
  const content = readFileSync(dist + 'assets/' + f, 'utf8');
  if (f.endsWith('.js')) {
    html = html.replace(
      new RegExp(`<script type="module"[^>]*src="/assets/${f}"[^>]*></script>`),
      () => `<script type="module">${content}</script>`
    );
  } else if (f.endsWith('.css')) {
    html = html.replace(
      new RegExp(`<link rel="stylesheet"[^>]*href="/assets/${f}"[^>]*>`),
      () => `<style>${content}</style>`
    );
  }
}

if (html.includes('/assets/')) {
  console.error('ERROR: unresolved asset references remain');
  process.exit(1);
}
writeFileSync(dist + 'vecini.html', html);
console.log('dist/vecini.html written,', Math.round(html.length / 1024), 'KB');
