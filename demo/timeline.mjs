/*
  The video, written down once.

  Both the composition and the subtitle file read this, so a change to a scene's
  timing cannot leave the two disagreeing. Times are milliseconds from the start.

  Weighting: getting the app onto the phone takes thirteen seconds and the
  community itself takes forty-four. Installing is a means to an end, and the
  end is what somebody deciding whether to bother needs to see.
*/

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 84000;

/* Where the phone screen sits inside the 1080×1920 frame. */
export const PHONE = { x: 240, y: 300, w: 600, h: 1299 }; // 390×844 at ×1.538

export const BEATS = [
  {
    id: 'intro', t0: 0, t1: 6500,
    screen: '01-landing',
    caption: 'Anunțul s-a pierdut în grup.',
    enter: 'rise',
    vo: 'Anunțul important s-a pierdut printre mesajele din grup. Sesizarea, la fel.',
  },
  {
    id: 'first-open', t0: 6500, t1: 11500,
    screen: '01-landing',
    swap: { screen: '02-landing-features', at: 8800 },
    chrome: true,
    caption: 'Fără magazin de aplicații',
    vo: 'Vecini strânge tot ce ține de blocul tău într-un singur loc. Se deschide în browser, fără magazin de aplicații.',
  },

  /* ---------- onto the phone, briskly ---------- */
  {
    id: 'install', t0: 11500, t1: 16500,
    screen: '06-install-sheet',
    caption: 'Trei pași. Atât.',
    zoom: { at: 13000, until: 15600, x: 300, y: 1120, scale: 1.5 },
    vo: 'Ți-o pui pe ecranul principal în trei pași. Aplicația îți arată exact unde să apeși.',
  },
  {
    id: 'ios-sheet', t0: 16500, t1: 20000,
    mock: 'share-sheet',
    caption: 'Un singur pas',
    tap: { at: 18300, sel: '.sheet .row.hit' },
    vo: 'Alegi „Adaugă la ecranul principal”.',
  },
  {
    id: 'homescreen', t0: 20000, t1: 25000,
    mock: 'home-screen',
    caption: 'Se deschide ca o aplicație',
    tap: { at: 22000, sel: '#home .tile.vecini' },
    vo: 'Gata. Se deschide ca orice altă aplicație, și poate primi notificări.',
  },
  {
    id: 'join', t0: 25000, t1: 31500,
    screen: '03-join-code',
    swap: { screen: '04-join-found', at: 28400 },
    caption: 'Intri pe bază de invitație',
    vo: 'Intri cu codul primit de la administrator. Îți arată comunitatea înainte să te înscrii.',
  },

  /* ---------- and now the part people are deciding on ---------- */
  {
    id: 'home', t0: 31500, t1: 37500,
    screen: '05-dashboard-full', pan: [0, 500],
    caption: 'Tot ce contează, pe prima pagină',
    vo: 'Pe prima pagină vezi tot ce contează: sesizări deschise, voturi în curs, ultimele anunțuri.',
  },
  {
    id: 'ann-list', t0: 37500, t1: 41800,
    screen: '14-announcements-full', pan: [0, 380],
    caption: 'Anunțurile stau la vedere',
    vo: 'Anunțurile oficiale rămân la vedere, cel important fixat sus. Toate, în ordine, într-un singur loc.',
  },
  {
    id: 'ann-detail', t0: 41800, t1: 45000,
    screen: '16-announcement-detail',
    caption: 'Citite întregi, nu pe fugă',
    vo: 'Le citești întregi, cu cine le-a publicat și când.',
  },
  {
    id: 'issues-list', t0: 45000, t1: 51000,
    screen: '08-issues-list-full', pan: [0, 480],
    caption: 'Fiecare sesizare, cu statusul ei',
    vo: 'Sesizările sunt într-o listă, fiecare cu statusul ei: nouă, în lucru, rezolvată.',
  },
  {
    id: 'report', t0: 51000, t1: 57000,
    screen: '11-report-empty',
    swap: { screen: '12-report-filled', at: 53800 },
    caption: 'Raportezi în câteva secunde',
    vo: 'Raportezi o problemă în câteva secunde, cu poză și cu locul unde e.',
  },
  {
    id: 'status', t0: 57000, t1: 63500,
    screen: '09-issue-detail-full', pan: [0, 560],
    caption: 'Vezi ce se întâmplă cu ea',
    vo: 'Pe urmă vezi ce se întâmplă cu ea: cine a preluat-o, ce s-a schimbat, ce spun vecinii.',
  },
  {
    id: 'poll-vote', t0: 63500, t1: 67500,
    screen: '17-poll-detail',
    caption: 'Decizii prin vot',
    vo: 'Deciziile se iau prin vot, nu prin ceartă. Alegi și trimiți.',
  },
  {
    id: 'poll-result', t0: 67500, t1: 71500,
    screen: '18-poll-voted',
    caption: 'Rezultatul, la vedere',
    vo: 'Rezultatul e la vedere pentru toți, iar votul tău rămâne anonim.',
  },
  {
    id: 'neighbours', t0: 71500, t1: 76000,
    screen: '13-neighbours-full', pan: [0, 260],
    caption: 'Îți suni vecinul direct',
    vo: 'Și îți suni vecinul direct din aplicație.',
  },
  {
    id: 'outro', t0: 76000, t1: 84000,
    outro: true,
    vo: 'Vecini. Tot ce ține de bloc, într-un singur loc liniștit. vecini punct app.',
  },
];

/* Subtitles, split so no line outstays its sentence. */
export const SUBS = [
  [600, 3600, 'Anunțul important s-a pierdut printre mesajele din grup.'],
  [3700, 6300, 'Sesizarea, la fel.'],
  [6700, 9200, 'Vecini strânge tot ce ține de blocul tău într-un singur loc.'],
  [9300, 11300, 'Se deschide în browser, fără magazin de aplicații.'],
  [11700, 14200, 'Ți-o pui pe ecranul principal în trei pași.'],
  [14300, 16300, 'Aplicația îți arată exact unde să apeși.'],
  [16700, 19800, 'Alegi „Adaugă la ecranul principal”.'],
  [20200, 22600, 'Gata. Se deschide ca orice altă aplicație.'],
  [22700, 24800, 'Și poate primi notificări.'],
  [25200, 28200, 'Intri cu codul primit de la administrator.'],
  [28300, 31300, 'Îți arată comunitatea înainte să te înscrii.'],
  [31700, 34400, 'Pe prima pagină vezi tot ce contează:'],
  [34500, 37300, 'sesizări deschise, voturi în curs, ultimele anunțuri.'],
  [37700, 40000, 'Anunțurile oficiale rămân la vedere, cel important fixat sus.'],
  [40100, 41600, 'Toate, în ordine, într-un singur loc.'],
  [42000, 44800, 'Le citești întregi, cu cine le-a publicat și când.'],
  [45200, 48200, 'Sesizările sunt într-o listă, fiecare cu statusul ei:'],
  [48300, 50800, 'nouă, în lucru, rezolvată.'],
  [51200, 54000, 'Raportezi o problemă în câteva secunde,'],
  [54100, 56800, 'cu poză și cu locul unde e.'],
  [57200, 60000, 'Pe urmă vezi ce se întâmplă cu ea:'],
  [60100, 63300, 'cine a preluat-o, ce s-a schimbat, ce spun vecinii.'],
  [63700, 66000, 'Deciziile se iau prin vot, nu prin ceartă.'],
  [66100, 67300, 'Alegi și trimiți.'],
  [67700, 69700, 'Rezultatul e la vedere pentru toți,'],
  [69800, 71300, 'iar votul tău rămâne anonim.'],
  [71700, 75800, 'Și îți suni vecinul direct din aplicație.'],
  [76400, 78600, 'Vecini.'],
  [78700, 81800, 'Tot ce ține de bloc, într-un singur loc liniștit.'],
  [81900, 83800, 'vecini.app'],
];

export const beatAt = (t) => BEATS.find((b) => t >= b.t0 && t < b.t1) || BEATS[BEATS.length - 1];
export const subAt = (t) => SUBS.find(([a, b]) => t >= a && t < b);
