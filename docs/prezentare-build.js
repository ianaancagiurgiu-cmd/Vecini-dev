const pptxgen = require('pptxgenjs');
const D = __dirname;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';           // 13.3 x 7.5
pres.author = 'Vecini';
pres.title = 'Vecini — comunitatea ta, într-un singur loc';

/* ---------- palette, taken from the product itself ---------- */
const INK    = '1A1C18';
const GREEN  = '2F6B4F';
const DEEP   = '1D3B2C';
const LIGHT  = 'EAF1EC';   // pale green card tint
const WHITE  = 'FFFFFF';
const MUTED  = '5A6152';
const CLAY   = 'B4532A';   // the sharp accent, only where something is wrong
const SAND   = 'F0EADC';

const H = 'Cambria';        // safe-list serif, close to the product's Newsreader
const B = 'Calibri';        // safe-list sans

const W = 13.3, HT = 7.5;

/* Repeated motif: a filled circle carrying a glyph, and rounded phone shots. */
function circle(slide, x, y, d, fill, glyph, glyphColor, size) {
  slide.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill } });
  slide.addText(glyph, {
    x, y, w: d, h: d, isTextBox: true, margin: 0,
    align: 'center', valign: 'middle',
    fontFace: B, fontSize: size || 17, bold: true, color: glyphColor || WHITE,
  });
}

function phone(slide, file, x, y, h) {
  slide.addImage({
    path: `${D}/${file}`, x, y, h, w: h * (620 / 1341),
    rounding: false,
    shadow: { type: 'outer', angle: 90, blur: 18, offset: 4, opacity: 0.22, color: '000000' },
  });
}

function sectionLabel(slide, text, color) {
  slide.addText(text, {
    x: 0.85, y: 0.5, w: 8, h: 0.3, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 12, bold: true, charSpacing: 2.4,
    color: color || GREEN,
  });
}

/* ============================ 1. TITLE ============================ */
{
  const s = pres.addSlide();
  s.background = { color: DEEP };

  s.addText('Vecini', {
    x: 0.85, y: 2.05, w: 7.6, h: 1.5, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 88, bold: true, color: WHITE,
  });
  s.addText('Tot ce ține de asociația ta,\nîntr-un singur loc liniștit.', {
    x: 0.9, y: 3.5, w: 7.2, h: 1.4, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 26, color: 'A8D5BC', lineSpacing: 34,
  });
  s.addText('vecini.app', {
    x: 0.9, y: 5.25, w: 4, h: 0.45, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 17, bold: true, color: WHITE, charSpacing: 1.5,
  });

  phone(s, 'dash.png', 9.35, 0.95, 5.6);
  s.addNotes('Vecini este o aplicație pentru comunitățile de proprietari: blocuri, case sau mixt. Se instalează din browser, fără magazin de aplicații.');
}

/* ============================ 2. PROBLEM ============================ */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionLabel(s, 'PROBLEMA', CLAY);

  s.addText('Totul trece prin grup,\niar grupul uită.', {
    x: 0.85, y: 1.0, w: 7.4, h: 1.7, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 38, bold: true, color: INK, lineSpacing: 46,
  });
  s.addText(
    'Anunțurile despre lucrări, sesizările și deciziile despre banii comuni ' +
    'trec toate prin aceeași conversație. În câteva ore, tot ce era important ' +
    'a coborât sub discuții despre altceva.',
    {
      x: 0.85, y: 2.95, w: 6.1, h: 1.6, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 16, color: MUTED, lineSpacing: 26,
    });

  /* A stack of chat bubbles, with the notice that matters buried in it. */
  const bx = 7.9;
  const bubbles = [
    ['Cine a parcat pe locul 12?', false],
    ['Apa caldă se oprește joi, 9–15', true],
    ['😀😀', false],
    ['Mulțumim!', false],
    ['Cineva are un instalator bun?', false],
    ['Ce ziceți de sâmbătă?', false],
  ];
  let by = 1.15;
  bubbles.forEach(([txt, important]) => {
    const w = important ? 4.5 : 3.2 + Math.random() * 0.6;
    s.addShape(pres.ShapeType.roundRect, {
      x: bx, y: by, w, h: 0.62, rectRadius: 0.14,
      fill: { color: important ? SAND : 'F1F2EF' },
    });
    s.addText(txt, {
      x: bx + 0.22, y: by, w: w - 0.4, h: 0.62, isTextBox: true, margin: 0,
      valign: 'middle', fontFace: B, fontSize: important ? 13.5 : 12.5,
      bold: important, color: important ? CLAY : '8A9086',
    });
    by += 0.78;
  });
  s.addText('↑  Anunțul care conta, la 4 mesaje distanță de invizibil', {
    x: bx, y: by + 0.05, w: 4.6, h: 0.4, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 11.5, italic: true, color: CLAY,
  });

  s.addNotes('Problema nu e că oamenii nu comunică. E că mediul în care comunică nu păstrează nimic.');
}

/* ============================ 3. THREE FAILURES ============================ */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  sectionLabel(s, 'CE SE STRICĂ, CONCRET', CLAY);

  s.addText('Trei lucruri care nu se rezolvă de la sine.', {
    x: 0.85, y: 1.0, w: 11, h: 0.95, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 34, bold: true, color: INK,
  });

  const items = [
    ['Se pierde', 'Anunțul important coboară sub conversație în câteva ore. Cine nu a fost pe telefon atunci, nu îl mai vede niciodată.'],
    ['Se repetă', 'O sesizare nu are stadiu. Aceeași ușă stricată e raportată de patru ori, de patru oameni care cred fiecare că nu s-a ocupat nimeni.'],
    ['Se contestă', 'Deciziile se iau de cine mai are chef să scrie seara târziu. A doua zi nimeni nu mai știe cine cu ce a fost de acord.'],
  ];
  let x = 0.85;
  items.forEach(([title, body], i) => {
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.05, w: 3.75, h: 3.5, rectRadius: 0.16, fill: { color: 'F7F8F5' },
    });
    circle(s, x + 0.42, 2.45, 0.62, CLAY, String(i + 1), WHITE, 20);
    s.addText(title, {
      x: x + 0.42, y: 3.32, w: 2.9, h: 0.45, isTextBox: true, margin: 0,
      fontFace: H, fontSize: 24, bold: true, color: INK,
    });
    s.addText(body, {
      x: x + 0.42, y: 3.88, w: 2.95, h: 1.5, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 13.5, color: MUTED, lineSpacing: 21,
    });
    x += 4.05;
  });
  s.addNotes('Fiecare dintre cele trei costă timp administratorului și încredere comunității.');
}

/* ============================ 4. NEEDS ============================ */
{
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  sectionLabel(s, 'NEVOILE UNEI ASOCIAȚII', GREEN);

  s.addText('Ce trebuie de fapt, dincolo de o conversație.', {
    x: 0.85, y: 1.0, w: 8.4, h: 1.25, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 34, bold: true, color: INK,
  });

  const needs = [
    ['📌', 'Un loc unde anunțul rămâne', 'Informația oficială să stea la vedere cât timp contează, nu până o acoperă altcineva.'],
    ['🛠', 'Sesizări cu stadiu', 'Să se vadă ce s-a raportat deja, cine s-a ocupat și unde a rămas.'],
    ['🗳', 'Decizii cu urmă', 'Vot, număr, dată. Nu „am discutat pe grup".'],
    ['🔒', 'Date personale tratate serios', 'Într-o comunitate mică toți se cunosc. O expunere nu se mai retrage.'],
  ];
  let y = 2.35;
  needs.forEach(([icon, title, body]) => {
    circle(s, 0.9, y, 0.58, GREEN, icon, WHITE, 18);
    s.addText(title, {
      x: 1.72, y: y - 0.03, w: 4.4, h: 0.4, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 16.5, bold: true, color: INK,
    });
    s.addText(body, {
      x: 1.72, y: y + 0.36, w: 5.6, h: 0.65, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 13.5, color: MUTED, lineSpacing: 20,
    });
    y += 1.15;
  });

  phone(s, 'anunturi.png', 9.5, 1.35, 5.3);
  s.addNotes('Nevoile astea nu sunt tehnice. Sunt organizatorice. De asta o aplicație generală de chat nu le rezolvă.');
}

/* ============================ 5. SOLUTION ============================ */
{
  const s = pres.addSlide();
  s.background = { color: DEEP };

  s.addText('SOLUȚIA', {
    x: 0.85, y: 1.5, w: 6, h: 0.35, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 12, bold: true, charSpacing: 2.4, color: 'A8D5BC',
  });
  s.addText('Cinci funcții, fiecare\ncu un capăt la care ajungi.', {
    x: 0.85, y: 2.0, w: 8.2, h: 1.8, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 40, bold: true, color: WHITE, lineSpacing: 50,
  });
  s.addText(
    'Fără flux nesfârșit, fără reacții, fără notificări care cer atenție degeaba. ' +
    'Aplicația se închide când ai terminat.',
    {
      x: 0.85, y: 4.15, w: 6.4, h: 1, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 16, color: 'A8D5BC', lineSpacing: 26,
    });

  const tags = ['Anunțuri', 'Sesizări', 'Discuții', 'Voturi', 'Vecini'];
  let tx = 0.85;
  tags.forEach((t) => {
    const w = 0.42 + t.length * 0.135;
    s.addShape(pres.ShapeType.roundRect, {
      x: tx, y: 5.5, w, h: 0.55, rectRadius: 0.27,
      fill: { color: DEEP }, line: { color: '5C8C72', width: 1 },
    });
    s.addText(t, {
      x: tx, y: 5.5, w, h: 0.55, isTextBox: true, margin: 0,
      align: 'center', valign: 'middle', fontFace: B, fontSize: 13.5, color: WHITE,
    });
    tx += w + 0.22;
  });

  phone(s, 'sesizari.png', 9.5, 1.0, 5.5);
  s.addNotes('Cinci funcții alese, nu douăzeci. Fiecare are un capăt: lista se termină.');
}

/* ============================ 6. ANUNȚURI ============================ */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  phone(s, 'anunturi.png', 0.95, 0.95, 5.6);

  sectionLabel(s, 'ANUNȚURI', GREEN);
  s.addText('Anunțul stă sus cât timp contează,\napoi coboară singur.', {
    x: 4.6, y: 1.55, w: 8, h: 1.5, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 33, bold: true, color: INK, lineSpacing: 42,
  });
  s.addText(
    [
      { text: 'Administratorul ridică un anunț și spune până în ce zi contează. ', options: { breakLine: true } },
      { text: 'După ziua aceea, anunțul coboară de la sine la locul lui.', options: {} },
    ],
    {
      x: 4.6, y: 3.25, w: 7.4, h: 1, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 16, color: MUTED, lineSpacing: 26,
    });

  const pts = [
    'Nimeni nu trebuie să-și amintească să-l dea jos',
    'Se vede cine l-a publicat și când',
    'Notificare pe telefon, dacă vecinul o vrea',
  ];
  let py = 4.45;
  pts.forEach((p) => {
    circle(s, 4.6, py + 0.02, 0.3, GREEN, '✓', WHITE, 11);
    s.addText(p, {
      x: 5.1, y: py, w: 7, h: 0.35, isTextBox: true, margin: 0,
      valign: 'middle', fontFace: B, fontSize: 14.5, color: INK,
    });
    py += 0.62;
  });
  s.addNotes('Termenul e obligatoriu. Asta rezolvă problema anunțurilor vechi rămase în capul listei.');
}

/* ============================ 7. SESIZĂRI ============================ */
{
  const s = pres.addSlide();
  s.background = { color: 'F7F8F5' };
  phone(s, 'sesizare.png', 10.2, 0.95, 5.6);

  sectionLabel(s, 'SESIZĂRI', GREEN);
  s.addText('Fiecare problemă are un stadiu,\no poză și un istoric.', {
    x: 0.85, y: 1.55, w: 8, h: 1.5, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 33, bold: true, color: INK, lineSpacing: 42,
  });
  s.addText(
    'Un vecin raportează în câteva secunde, cu fotografie și loc. ' +
    'Toată lumea vede în ce stadiu e, deci aceeași defecțiune nu mai ajunge de patru ori la administrator.',
    {
      x: 0.85, y: 3.2, w: 7.2, h: 1.1, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 16, color: MUTED, lineSpacing: 26,
    });

  const states = [['Nouă', '3A6EA8', 'DDE8F3'], ['În lucru', 'B9802A', 'F7EFE0'], ['Rezolvată', '2F8C5F', 'E3F1E9']];
  let sx = 0.85;
  states.forEach(([label, fg, bg]) => {
    s.addShape(pres.ShapeType.roundRect, { x: sx, y: 4.65, w: 2.15, h: 0.72, rectRadius: 0.16, fill: { color: bg } });
    s.addText(label, {
      x: sx, y: 4.65, w: 2.15, h: 0.72, isTextBox: true, margin: 0,
      align: 'center', valign: 'middle', fontFace: B, fontSize: 15, bold: true, color: fg,
    });
    sx += 2.45;
  });
  s.addText('Stadiul e vizibil pentru toată lumea, nu doar pentru comitet.', {
    x: 0.85, y: 5.6, w: 7, h: 0.4, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 13.5, italic: true, color: MUTED,
  });
  s.addNotes('Istoricul arată cine a schimbat stadiul și ce a scris. Asta reduce reclamațiile către administrator.');
}

/* ============================ 8. VOTURI ============================ */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  phone(s, 'vot.png', 0.95, 0.95, 5.6);

  sectionLabel(s, 'VOTURI', GREEN);
  s.addText('Decizii prin vot,\nnu prin cine scrie mai mult.', {
    x: 4.6, y: 1.55, w: 8, h: 1.5, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 33, bold: true, color: INK, lineSpacing: 42,
  });
  s.addText(
    'Rezultatul e public și se vede oricând. Votul fiecăruia rămâne anonim. ' +
    'Rămâne o urmă a deciziei, cu dată și număr de participanți.',
    {
      x: 4.6, y: 3.25, w: 7.4, h: 1.1, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 16, color: MUTED, lineSpacing: 26,
    });

  s.addShape(pres.ShapeType.roundRect, { x: 4.6, y: 4.6, w: 7.4, h: 1.5, rectRadius: 0.16, fill: { color: LIGHT } });
  s.addText('„Reparăm acoperișul anul acesta sau amânăm?"', {
    x: 4.95, y: 4.8, w: 6.8, h: 0.4, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 16, bold: true, color: DEEP,
  });
  s.addText('14 au votat  ·  se închide în 4 zile  ·  votul tău e anonim', {
    x: 4.95, y: 5.3, w: 6.8, h: 0.4, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 13.5, color: GREEN,
  });
  s.addNotes('Votul anonim scade presiunea socială într-o comunitate unde toți se cunosc.');
}

/* ============================ 9. VECINI & CONFIDENȚIALITATE ============================ */
{
  const s = pres.addSlide();
  s.background = { color: LIGHT };
  phone(s, 'vecini.png', 10.2, 0.95, 5.6);

  sectionLabel(s, 'VECINI ȘI CONFIDENȚIALITATE', GREEN);
  s.addText('Datele personale, tratate ca atare.', {
    x: 0.85, y: 1.5, w: 8.6, h: 1.2, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 33, bold: true, color: INK,
  });

  const cards = [
    ['Numărul de telefon e opțional', 'Dezactivat implicit. Apare doar dacă vecinul alege să fie găsit.'],
    ['Vizibil doar în asociația ta', 'Regula e aplicată în baza de date, nu doar ascunsă în interfață.'],
    ['Ștergerea contului anonimizează', 'Numele, emailul și telefonul dispar. Istoria comunității rămâne întreagă.'],
    ['Votul rămâne anonim', 'Se vede rezultatul, nu cine ce a votat.'],
  ];
  let cx = 0.85, cy = 2.7;
  cards.forEach(([t, b], i) => {
    s.addShape(pres.ShapeType.roundRect, { x: cx, y: cy, w: 4.35, h: 1.55, rectRadius: 0.16, fill: { color: WHITE } });
    s.addText(t, {
      x: cx + 0.3, y: cy + 0.22, w: 3.8, h: 0.4, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 15, bold: true, color: DEEP,
    });
    s.addText(b, {
      x: cx + 0.3, y: cy + 0.68, w: 3.8, h: 0.7, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 13, color: MUTED, lineSpacing: 19,
    });
    if (i % 2 === 0) { cx += 4.65; } else { cx = 0.85; cy += 1.8; }
  });
  s.addNotes('Pentru o asociație, partea de date personale e cea care ridică cele mai multe întrebări. De asta e o secțiune separată.');
}

/* ============================ 10. INSTALARE ============================ */
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  phone(s, 'instalare.png', 10.2, 0.95, 5.6);

  sectionLabel(s, 'CUM INTRĂ VECINII', GREEN);
  s.addText('Fără magazin de aplicații.\nFără descărcare.', {
    x: 0.85, y: 1.5, w: 8, h: 1.4, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 33, bold: true, color: INK, lineSpacing: 42,
  });
  s.addText(
    'Administratorul trimite un link. Vecinul îl deschide și, dacă vrea, ' +
    'pune aplicația pe ecranul principal în trei pași.',
    {
      x: 0.85, y: 3.05, w: 7, h: 0.9, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 16, color: MUTED, lineSpacing: 26,
    });

  const steps = [
    ['Primește linkul', 'Pe WhatsApp, pe hârtie la avizier, oricum.'],
    ['Se deschide în browser', 'Nimic de instalat ca să vadă comunitatea.'],
    ['Ajunge pe ecran', 'Aplicația îi arată singură cei trei pași.'],
  ];
  let x = 0.85;
  steps.forEach(([t, b], i) => {
    circle(s, x, 4.25, 0.6, GREEN, String(i + 1), WHITE, 19);
    s.addText(t, {
      x, y: 5.05, w: 2.9, h: 0.4, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 15.5, bold: true, color: INK,
    });
    s.addText(b, {
      x, y: 5.5, w: 2.95, h: 0.8, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 13, color: MUTED, lineSpacing: 19,
    });
    x += 3.05;
  });
  s.addNotes('Bariera de adoptare e cea mai mare problemă la aplicațiile de asociație. De asta nu e în magazin: nimeni nu își face cont ca să vadă un anunț.');
}

/* ============================ 11. PENTRU CINE ============================ */
{
  const s = pres.addSlide();
  s.background = { color: 'F7F8F5' };
  sectionLabel(s, 'PENTRU CINE', GREEN);

  s.addText('Un singur produs, pentru comunități de forme diferite.', {
    x: 0.85, y: 1.0, w: 11.5, h: 1.15, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 33, bold: true, color: INK,
  });
  s.addText('Aplicația întreabă ce fel de comunitate ești și își potrivește textele după asta.', {
    x: 0.85, y: 2.2, w: 9.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 16, color: MUTED,
  });

  const kinds = [
    ['🏢', 'Bloc', 'Asociație de proprietari, cu scări și cote de întreținere.'],
    ['🏡', 'Case', 'Zonă rezidențială sau stradă, fără scări și fără lift.'],
    ['🏘', 'Mixt', 'Blocuri și case la un loc, sub aceeași asociație.'],
  ];
  let x = 0.85;
  kinds.forEach(([icon, t, b]) => {
    s.addShape(pres.ShapeType.roundRect, { x, y: 2.85, w: 3.75, h: 2.7, rectRadius: 0.16, fill: { color: WHITE } });
    circle(s, x + 0.42, 3.25, 0.7, LIGHT, icon, GREEN, 22);
    s.addText(t, {
      x: x + 0.42, y: 4.15, w: 2.9, h: 0.45, isTextBox: true, margin: 0,
      fontFace: H, fontSize: 23, bold: true, color: INK,
    });
    s.addText(b, {
      x: x + 0.42, y: 4.68, w: 2.95, h: 0.8, isTextBox: true, margin: 0,
      fontFace: B, fontSize: 13.5, color: MUTED, lineSpacing: 20,
    });
    x += 4.05;
  });

  s.addText('Trei limbi disponibile: română, engleză, maghiară.', {
    x: 0.85, y: 5.75, w: 8, h: 0.4, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 14, italic: true, color: GREEN,
  });
  s.addNotes('Adaptarea nu e cosmetică: la case nu apare numărul de scări, iar sloganul se schimbă.');
}

/* ============================ 12. CLOSING ============================ */
{
  const s = pres.addSlide();
  s.background = { color: DEEP };

  s.addText('Anunțul e încă acolo\njoi dimineața,\ncând cineva are nevoie de el.', {
    x: 0.85, y: 1.75, w: 8.2, h: 2.6, isTextBox: true, margin: 0,
    fontFace: H, fontSize: 38, bold: true, color: WHITE, lineSpacing: 52,
  });
  s.addText('Asta e tot ce își doreau vecinii.', {
    x: 0.85, y: 4.5, w: 7, h: 0.5, isTextBox: true, margin: 0,
    fontFace: B, fontSize: 17, color: 'A8D5BC',
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 0.85, y: 5.5, w: 3.5, h: 0.85, rectRadius: 0.42, fill: { color: WHITE },
  });
  s.addText('vecini.app', {
    x: 0.85, y: 5.5, w: 3.5, h: 0.85, isTextBox: true, margin: 0,
    align: 'center', valign: 'middle', fontFace: B, fontSize: 20, bold: true, color: DEEP,
  });

  phone(s, 'dash.png', 9.6, 1.0, 5.5);
  s.addNotes('Închiderea: măsura succesului nu e timpul petrecut în aplicație, ci dacă informația se mai găsește atunci când contează.');
}

pres.writeFile({ fileName: `${D}/Vecini-prezentare.pptx` }).then(() => console.log('written'));
