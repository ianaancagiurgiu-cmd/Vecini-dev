import { chromium } from '@playwright/test';
import { PHOTOS } from './photos.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 800, height: 600 } });
await p.setContent(`<body style="margin:0"><img src="${PHOTOS.door}" style="width:800px;height:600px;display:block"></body>`);
await p.screenshot({ path: 'demo/upload.png' });
await b.close();
console.log('demo/upload.png written');
