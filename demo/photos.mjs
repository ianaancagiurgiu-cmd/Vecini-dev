/*
  Pictures for the demo issues.

  Drawn rather than photographed, and deliberately so: there are no real photos
  of this fictional building, and a stock photo pretending to be one would be
  the one dishonest thing in an otherwise real recording. These read as
  illustrations, in the app's own palette, which is a choice a viewer can see.
*/

const ink = '#232620', paper = '#efe9dd', green = '#2f6b4f', amber = '#b9802a', terra = '#b4532a';

const frame = (inner, sky = '#cfd6cf') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#a8b2a8"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="1.1"/></filter>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  ${inner}
  <rect width="800" height="600" fill="none"/>
</svg>`;

const scenes = {
  // A stairwell landing with a dead lamp.
  bulb: frame(`
    <rect x="0" y="380" width="800" height="220" fill="#8e968d"/>
    <rect x="90" y="120" width="220" height="330" fill="#b9c0b6"/>
    <rect x="120" y="160" width="160" height="250" fill="#6f776e"/>
    <circle cx="470" cy="150" r="52" fill="#5c645c"/>
    <circle cx="470" cy="150" r="34" fill="#3c423c"/>
    <path d="M470 98 v-42" stroke="#4a514a" stroke-width="7"/>
    <g opacity=".5"><path d="M540 120 l40 -30 M556 160 l48 -6" stroke="${ink}" stroke-width="5" stroke-linecap="round"/></g>
    <rect x="560" y="250" width="180" height="200" rx="6" fill="#9aa398"/>
    <rect x="590" y="285" width="120" height="130" rx="4" fill="#77806f"/>
  `, '#b3bcb3'),

  // A front door standing ajar.
  door: frame(`
    <rect x="0" y="430" width="800" height="170" fill="#8e968d"/>
    <rect x="150" y="90" width="330" height="345" fill="#a9b1a7"/>
    <g transform="rotate(-7 480 260)">
      <rect x="330" y="95" width="215" height="340" rx="4" fill="${green}" opacity=".85"/>
      <rect x="360" y="130" width="155" height="150" rx="3" fill="#dfe6dd" opacity=".7"/>
      <circle cx="520" cy="285" r="9" fill="#e8e2d4"/>
    </g>
    <rect x="560" y="150" width="180" height="285" rx="5" fill="#98a196"/>
    <path d="M150 435 h620" stroke="${ink}" stroke-width="3" opacity=".25"/>
  `),

  // A lift, stopped between floors.
  lift: frame(`
    <rect x="0" y="440" width="800" height="160" fill="#8e968d"/>
    <rect x="220" y="70" width="370" height="380" fill="#9ba49a"/>
    <rect x="250" y="100" width="150" height="320" fill="#6d756c"/>
    <rect x="410" y="100" width="150" height="320" fill="#6d756c"/>
    <rect x="250" y="240" width="310" height="26" fill="${ink}" opacity=".35"/>
    <rect x="600" y="150" width="66" height="110" rx="8" fill="#dfe6dd"/>
    <text x="633" y="222" font-family="Georgia,serif" font-size="58" fill="${terra}" text-anchor="middle">3</text>
    <circle cx="633" cy="300" r="13" fill="${amber}"/>
  `, '#c3cac2'),

  // Damp spreading across a ceiling corner.
  damp: frame(`
    <rect x="0" y="0" width="800" height="600" fill="#e4e2d8"/>
    <path d="M0 0 h800 v170 q-180 60 -400 20 T0 210 Z" fill="#d5d2c4"/>
    <path d="M90 40 q120 -20 190 60 t150 40 q-90 90 -230 60 T60 150 Z" fill="#b9ae95" opacity=".85"/>
    <path d="M140 70 q80 10 120 70 t90 40" stroke="#8d8168" stroke-width="6" fill="none" opacity=".7" filter="url(#soft)"/>
    <rect x="0" y="470" width="800" height="130" fill="#c8c5b8"/>
    <rect x="520" y="250" width="210" height="220" rx="6" fill="#d8d5c8"/>
  `, '#e4e2d8'),

  // Bins with bags left beside them.
  bins: frame(`
    <rect x="0" y="400" width="800" height="200" fill="#8b937f"/>
    <rect x="120" y="200" width="180" height="205" rx="10" fill="${green}" opacity=".8"/>
    <rect x="330" y="200" width="180" height="205" rx="10" fill="#4a6f8c" opacity=".8"/>
    <rect x="110" y="185" width="200" height="26" rx="8" fill="#24402f"/>
    <rect x="320" y="185" width="200" height="26" rx="8" fill="#2c4557"/>
    <ellipse cx="600" cy="380" rx="78" ry="60" fill="#6f6a5c"/>
    <ellipse cx="672" cy="398" rx="58" ry="44" fill="#7d786a"/>
    <path d="M560 330 q40 -30 80 0" stroke="#55503f" stroke-width="7" fill="none"/>
  `, '#b7c2b2'),

  // A path under snow.
  snow: frame(`
    <rect x="0" y="330" width="800" height="270" fill="#e9edeb"/>
    <path d="M0 330 q200 -40 400 0 t400 -10 v280 H0 Z" fill="#f3f6f4"/>
    <rect x="60" y="120" width="150" height="215" fill="#9aa89c"/>
    <rect x="620" y="90" width="140" height="245" fill="#8fa091"/>
    <path d="M120 470 q140 -40 300 0 t260 -20" stroke="#cdd6d0" stroke-width="30" fill="none" stroke-linecap="round"/>
    <circle cx="300" cy="200" r="6" fill="#fff"/><circle cx="420" cy="150" r="5" fill="#fff"/>
    <circle cx="500" cy="240" r="7" fill="#fff"/><circle cx="220" cy="270" r="5" fill="#fff"/>
  `, '#c9d4d8'),

  // An intercom panel by the entrance.
  intercom: frame(`
    <rect x="0" y="430" width="800" height="170" fill="#8e968d"/>
    <rect x="200" y="60" width="400" height="370" rx="6" fill="#a7b0a5"/>
    <rect x="300" y="120" width="200" height="250" rx="10" fill="#4d554c"/>
    <g fill="#cfd6cd">
      ${[0,1,2,3].map(r => [0,1,2].map(c =>
        `<rect x="${330 + c*46}" y="${160 + r*48}" width="34" height="34" rx="6"/>`).join('')).join('')}
    </g>
    <rect x="330" y="128" width="140" height="22" rx="5" fill="${terra}" opacity=".8"/>
  `),
};

export const PHOTOS = Object.fromEntries(
  Object.entries(scenes).map(([k, svg]) => [
    k, 'data:image/svg+xml;utf8,' + encodeURIComponent(svg.trim().replace(/\s+/g, ' ')),
  ]),
);
