/*
  The video, written down once.

  Both the composition and the subtitle file read this, so a change to a scene's
  timing cannot leave the two disagreeing. Times are milliseconds from the start.
*/

export const FPS = 30;
export const W = 1080;
export const H = 1920;
export const DURATION = 82000;

/* Where the phone screen sits inside the 1080×1920 frame. */
export const PHONE = { x: 240, y: 300, w: 600, h: 1299 }; // 390×844 at ×1.538

export const BEATS = [
  {
    id: 'intro', t0: 0, t1: 9000,
    screen: '01-landing',
    caption: 'Anunțul s-a pierdut în grup.',
    enter: 'rise',
    vo: 'Anunțul important s-a pierdut printre mesajele din grup. Sesizarea, la fel. Vecini strânge tot ce ține de blocul tău într-un singur loc.',
  },
  {
    id: 'first-open', t0: 9000, t1: 16000,
    screen: '01-landing', screenAt: 9000,
    swap: { screen: '02-landing-features', at: 12200 },
    chrome: true,
    caption: 'Fără magazin de aplicații',
    vo: 'Se deschide direct în browser. Fără magazin de aplicații, fără cont până nu vrei tu.',
  },
  {
    id: 'install', t0: 16000, t1: 25000,
    screen: '06-install-sheet',
    caption: 'Trei pași. Atât.',
    zoom: { at: 19500, until: 23000, x: 300, y: 1120, scale: 1.55 },
    vo: 'Aplicația îți arată singură cum să o pui pe ecranul principal. Trei pași, cu butoanele desenate exact cum arată pe telefonul tău.',
  },
  {
    id: 'ios-sheet', t0: 25000, t1: 31000,
    mock: 'share-sheet',
    caption: 'Un singur pas',
    tap: { at: 28200, sel: '.sheet .row.hit' },
    vo: 'Alegi „Adaugă la ecranul principal” și gata.',
  },
  {
    id: 'homescreen', t0: 31000, t1: 39000,
    mock: 'home-screen',
    caption: 'Se deschide ca o aplicație',
    tap: { at: 34500, sel: '#home .tile.vecini' },
    vo: 'De atunci se deschide de pe ecranul principal, ca orice altă aplicație. Și poate primi notificări.',
  },
  {
    id: 'join', t0: 39000, t1: 49000,
    screen: '03-join-code',
    swap: { screen: '04-join-found', at: 43800 },
    caption: 'Intri pe bază de invitație',
    vo: 'Intri cu codul primit de la administrator. A-le-ea-tei șaptezeci. Îți arată comunitatea înainte să te înscrii, ca să știi că e cea corectă.',
  },
  {
    id: 'home', t0: 49000, t1: 55500,
    screen: '05-dashboard-full', pan: [0, 560],
    caption: 'Tot ce contează, pe prima pagină',
    vo: 'Pe prima pagină vezi tot ce contează: câte sesizări sunt deschise, ce se votează acum, ultimele anunțuri.',
  },
  {
    id: 'report', t0: 55500, t1: 62000,
    screen: '11-report-empty',
    swap: { screen: '12-report-filled', at: 58600 },
    caption: 'Raportezi în câteva secunde',
    vo: 'Raportezi o problemă în câteva secunde, cu poză.',
  },
  {
    id: 'status', t0: 62000, t1: 67500,
    screen: '09-issue-detail-full', pan: [0, 720],
    caption: 'Vezi ce se întâmplă cu ea',
    vo: 'Vezi în ce stadiu e.',
  },
  {
    id: 'neighbours', t0: 67500, t1: 73000,
    screen: '13-neighbours-full', pan: [0, 300],
    caption: 'Îți suni vecinul direct',
    vo: 'Și îți suni vecinul direct din aplicație.',
  },
  {
    id: 'outro', t0: 73000, t1: 82000,
    outro: true,
    vo: 'Vecini. Tot ce ține de bloc, într-un singur loc liniștit. vecini punct app.',
  },
];

/* Subtitles, split so no line outstays its sentence. */
export const SUBS = [
  [600, 4200, 'Anunțul important s-a pierdut printre mesajele din grup.'],
  [4300, 6200, 'Sesizarea, la fel.'],
  [6300, 8900, 'Vecini strânge tot ce ține de blocul tău într-un singur loc.'],
  [9300, 12000, 'Se deschide direct în browser.'],
  [12100, 15800, 'Fără magazin de aplicații, fără cont până nu vrei tu.'],
  [16300, 20000, 'Aplicația îți arată singură cum să o pui pe ecranul principal.'],
  [20100, 24800, 'Trei pași, cu butoanele desenate exact cum arată pe telefonul tău.'],
  [25400, 30600, 'Alegi „Adaugă la ecranul principal” și gata.'],
  [31300, 35400, 'De atunci se deschide de pe ecranul principal, ca orice altă aplicație.'],
  [35500, 38800, 'Și poate primi notificări.'],
  [39300, 42600, 'Intri cu codul primit de la administrator.'],
  [42700, 44600, 'ALEEATEI-70.'],
  [44700, 48800, 'Îți arată comunitatea înainte să te înscrii, ca să știi că e cea corectă.'],
  [49300, 52400, 'Pe prima pagină vezi tot ce contează:'],
  [52500, 55300, 'câte sesizări sunt deschise, ce se votează, ultimele anunțuri.'],
  [55800, 61800, 'Raportezi o problemă în câteva secunde, cu poză.'],
  [62300, 67300, 'Vezi în ce stadiu e.'],
  [67800, 72800, 'Și îți suni vecinul direct din aplicație.'],
  [73400, 76600, 'Vecini.'],
  [76700, 80200, 'Tot ce ține de bloc, într-un singur loc liniștit.'],
  [80300, 81900, 'vecini.app'],
];

export const beatAt = (t) => BEATS.find((b) => t >= b.t0 && t < b.t1) || BEATS[BEATS.length - 1];
export const subAt = (t) => SUBS.find(([a, b]) => t >= a && t < b);
