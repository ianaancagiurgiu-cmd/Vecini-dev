// Generates the PWA app icons (public/icon-*.png) from scratch.
// No image libraries available, so this writes minimal PNGs directly:
// a full-bleed Vecini-green square with a white serif-ish "V".
// Full-bleed + centred glyph keeps it valid as a maskable icon.
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

const GREEN = [0x2f, 0x6b, 0x4f];
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Shortest distance from a point to a line segment.
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function renderIcon(size) {
  // "V": two thick strokes meeting at the bottom centre.
  const top = 0.30 * size, bottom = 0.71 * size;
  const leftX = 0.30 * size, rightX = 0.70 * size, midX = 0.5 * size;
  const half = 0.055 * size; // half stroke width

  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      const d = Math.min(
        distToSegment(px, py, leftX, top, midX, bottom),
        distToSegment(px, py, rightX, top, midX, bottom),
      );
      // Anti-alias across one pixel of the stroke edge.
      const cov = Math.max(0, Math.min(1, half + 0.5 - d));
      const c = [0, 1, 2].map((i) => Math.round(GREEN[i] + (WHITE[i] - GREEN[i]) * cov));
      raw[o++] = c[0]; raw[o++] = c[1]; raw[o++] = c[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL('../public/', import.meta.url).pathname, { recursive: true });
for (const size of [180, 192, 512]) {
  const path = new URL(`../public/icon-${size}.png`, import.meta.url).pathname;
  const png = renderIcon(size);
  writeFileSync(path, png);
  console.log(`public/icon-${size}.png`, Math.round(png.length / 1024) + 'KB');
}
