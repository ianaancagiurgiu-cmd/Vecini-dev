/*
  The community the demo is filmed in. Every name, flat number and sentence here
  is invented. Nothing touches the real database: these rows are served to the
  app by the recording harness instead of Supabase, in the shape the app expects.
*/
import { PHOTOS } from './photos.mjs';

export const CID = 'c0000000-0000-4000-8000-000000000001';
export const ME  = 'u0000000-0000-4000-8000-000000000001';

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

const COLOURS = ['#2f6b4f', '#b4532a', '#3a6ea8', '#b9802a', '#2f8c5f', '#7a5cc0', '#c04f7a', '#8c3c52'];
const uid = (n) => `u0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// 24 neighbours. The first is who we are signed in as.
const PEOPLE = [
  ['Mihai Georgescu', 'Ap. 12'], ['Ana Popescu', 'Ap. 3'], ['Elena Marin', 'Ap. 21'],
  ['Ion Vasile', 'Ap. 7'], ['Cristina Dobre', 'Ap. 15'], ['Radu Ionescu', 'Ap. 2'],
  ['Gabriela Stan', 'Ap. 18'], ['Andrei Munteanu', 'Ap. 9'], ['Ioana Barbu', 'Ap. 24'],
  ['Victor Sandu', 'Ap. 5'], ['Maria Nistor', 'Ap. 30'], ['Alex Preda', 'Ap. 11'],
  ['Simona Toma', 'Ap. 27'], ['Bogdan Ilie', 'Ap. 6'], ['Carmen Neagu', 'Ap. 19'],
  ['Dan Petrescu', 'Ap. 14'], ['Roxana Lungu', 'Ap. 22'], ['Florin Cristea', 'Ap. 8'],
  ['Alina Matei', 'Ap. 16'], ['Sorin Radu', 'Ap. 4'], ['Diana Enache', 'Ap. 26'],
  ['Paul Grigore', 'Ap. 10'], ['Monica Voicu', 'Ap. 29'], ['Tudor Albu', 'Ap. 1'],
];

export const profiles = PEOPLE.map(([full_name, apartment], i) => ({
  id: uid(i + 1), full_name, apartment, avatar_color: COLOURS[i % COLOURS.length], deleted_at: null,
}));

const P = Object.fromEntries(PEOPLE.map(([n], i) => [n.split(' ')[0], uid(i + 1)]));

export const communities = [{
  id: CID, name: 'Aleea Teilor', address: 'Aleea Teilor 70', description: '',
  code: 'ALEEATEI-70', join_mode: 'invite', kind: 'bloc',
}];

export const memberships = profiles.map((p, i) => ({
  id: `m${i}`, user_id: p.id, community_id: CID,
  role: i === 1 ? 'admin' : i === 2 ? 'moderator' : 'member',
  joined_at: daysAgo(300 - i * 7),
}));

// A few neighbours who chose to be reachable.
export const member_phones = [
  { user_id: P.Ana, phone: '+40 722 118 240', visible: true },
  { user_id: P.Elena, phone: '0733 902 115', visible: true },
  { user_id: P.Radu, phone: '+40 741 336 208', visible: true },
  { user_id: P.Cristina, phone: '0755 214 690', visible: true },
  { user_id: P.Mihai, phone: '+40 726 550 133', visible: false },
];

export const announcements = [
  { id: 'a1', community_id: CID, author_id: P.Ana, pinned: true, created_at: hoursAgo(5),
    title: 'Apa caldă se oprește joi, între 9 și 15',
    body: 'Se înlocuiește o vană pe coloana principală. Lucrarea e anunțată de furnizor și afectează toate cele patru scări. Vă rugăm să vă faceți rezerve de dimineață.' },
  { id: 'a2', community_id: CID, author_id: P.Ana, pinned: false, created_at: daysAgo(2),
    title: 'Adunarea generală, sâmbătă la ora 18',
    body: 'Ne vedem în holul de la scara A. Pe ordinea de zi: bugetul pentru reparația acoperișului și oferta pentru curățenie.' },
  { id: 'a3', community_id: CID, author_id: P.Elena, pinned: false, created_at: daysAgo(4),
    title: 'S-a montat iluminatul nou pe scara C',
    body: 'Becurile vechi au fost înlocuite cu corpuri cu senzor. Dacă observați vreunul care nu pornește, raportați la sesizări.' },
  { id: 'a4', community_id: CID, author_id: P.Ana, pinned: false, created_at: daysAgo(9),
    title: 'Program nou pentru ridicarea gunoiului',
    body: 'De luni, mașina vine marțea și vinerea dimineața. Vă rugăm să scoateți sacii cu o seară înainte.' },
  { id: 'a5', community_id: CID, author_id: P.Elena, pinned: false, created_at: daysAgo(16),
    title: 'Curățenie generală în subsol, duminică',
    body: 'Cine are lucruri depozitate acolo e rugat să le mute până sâmbătă seara.' },
  { id: 'a6', community_id: CID, author_id: P.Ana, pinned: false, created_at: daysAgo(23),
    title: 'Cotele de întreținere pe luna trecută sunt afișate',
    body: 'Le găsiți la avizier și pe grupul asociației. Termenul de plată rămâne data de 25.' },
];

export const issues = [
  { id: 'i1', community_id: CID, reporter_id: P.Ion, status: 'new', category: 'lighting',
    title: 'Becul de pe scara B nu mai merge', location: 'Scara B, etaj 3',
    description: 'De două seri e beznă între etajul 2 și 3. Seara nu se vede treapta de sus.',
    photo_url: PHOTOS.bulb, created_at: hoursAgo(3) },
  { id: 'i2', community_id: CID, reporter_id: P.Cristina, status: 'new', category: 'other',
    title: 'Ușa de la intrare nu se închide bine', location: 'Intrarea principală',
    description: 'Rămâne întredeschisă dacă nu o tragi cu putere. Noaptea stă deschisă.',
    photo_url: PHOTOS.door, created_at: hoursAgo(8) },
  { id: 'i3', community_id: CID, reporter_id: P.Gabriela, status: 'new', category: 'other',
    title: 'Interfonul de la scara A nu sună', location: 'Scara A',
    description: 'Se aude sonerie la parter, dar în apartament nu ajunge niciun sunet.',
    photo_url: PHOTOS.intercom, created_at: hoursAgo(20) },
  { id: 'i4', community_id: CID, reporter_id: P.Andrei, status: 'progress', category: 'elevator',
    title: 'Liftul se oprește între etaje', location: 'Scara B',
    description: 'S-a oprit de trei ori săptămâna asta, între 3 și 4. Ușa nu se deschide singură.',
    photo_url: PHOTOS.lift, created_at: daysAgo(2) },
  { id: 'i5', community_id: CID, reporter_id: P.Elena, status: 'progress', category: 'water',
    title: 'Infiltrații în tavan la ultimul etaj', location: 'Ap. 21, scara C',
    description: 'Pata s-a mărit după ploaia de weekend. Am pus găleată sub ea.',
    photo_url: PHOTOS.damp, created_at: daysAgo(4) },
  { id: 'i6', community_id: CID, reporter_id: P.Victor, status: 'resolved', category: 'cleaning',
    title: 'Saci de gunoi lăsați lângă tomberoane', location: 'Curtea din spate',
    description: 'De vineri stau acolo trei saci, în afara pubelelor.',
    photo_url: PHOTOS.bins, created_at: daysAgo(11) },
  { id: 'i7', community_id: CID, reporter_id: P.Radu, status: 'resolved', category: 'other',
    title: 'Zăpadă netopită pe aleea din față', location: 'Aleea de acces',
    description: 'Alunecă rău dimineața, mai ales pe porțiunea de lângă scara A.',
    photo_url: PHOTOS.snow, created_at: daysAgo(19) },
];

export const issue_supporters = [
  ...['Ana','Cristina','Gabriela','Andrei','Ioana','Maria','Alex'].map((n) => ({ issue_id: 'i1', user_id: P[n] })),
  ...['Ion','Elena','Bogdan','Carmen'].map((n) => ({ issue_id: 'i2', user_id: P[n] })),
  ...['Simona','Dan'].map((n) => ({ issue_id: 'i3', user_id: P[n] })),
  ...['Ana','Elena','Roxana','Florin','Alina','Sorin','Diana','Paul','Monica'].map((n) => ({ issue_id: 'i4', user_id: P[n] })),
  ...['Ana','Tudor','Victor'].map((n) => ({ issue_id: 'i5', user_id: P[n] })),
];

export const issue_history = [
  { id: 'h1', issue_id: 'i1', status: 'new', note: 'Sesizare trimisă.', by_id: P.Ion, at: hoursAgo(3) },
  { id: 'h2', issue_id: 'i4', status: 'new', note: 'Sesizare trimisă.', by_id: P.Andrei, at: daysAgo(2) },
  { id: 'h3', issue_id: 'i4', status: 'progress', note: 'Am chemat firma de service. Vin miercuri dimineață.', by_id: P.Ana, at: hoursAgo(30) },
  { id: 'h4', issue_id: 'i5', status: 'new', note: 'Sesizare trimisă.', by_id: P.Elena, at: daysAgo(4) },
  { id: 'h5', issue_id: 'i5', status: 'progress', note: 'Am urcat pe terasă, se vede de unde intră apa. Cerem ofertă.', by_id: P.Ana, at: daysAgo(3) },
  { id: 'h6', issue_id: 'i6', status: 'new', note: 'Sesizare trimisă.', by_id: P.Victor, at: daysAgo(11) },
  { id: 'h7', issue_id: 'i6', status: 'resolved', note: 'Ridicați azi dimineață. Am vorbit cu firma de salubrizare.', by_id: P.Ana, at: daysAgo(10) },
  { id: 'h8', issue_id: 'i7', status: 'new', note: 'Sesizare trimisă.', by_id: P.Radu, at: daysAgo(19) },
  { id: 'h9', issue_id: 'i7', status: 'resolved', note: 'S-a curățat și s-a pus material antiderapant.', by_id: P.Ana, at: daysAgo(18) },
];

export const issue_comments = [
  { id: 'ic1', issue_id: 'i1', author_id: P.Ana, body: 'Am comandat becurile, ajung joi.', created_at: hoursAgo(2) },
  { id: 'ic2', issue_id: 'i1', author_id: P.Maria, body: 'Și la etajul 4 e la fel de întuneric seara.', created_at: hoursAgo(1) },
  { id: 'ic3', issue_id: 'i4', author_id: P.Ioana, body: 'Mi s-a întâmplat și mie ieri. Am stat blocată vreo cinci minute.', created_at: hoursAgo(28) },
  { id: 'ic4', issue_id: 'i4', author_id: P.Ana, body: 'Am confirmat cu service-ul pentru miercuri la 9.', created_at: hoursAgo(10) },
];

export const discussions = [
  { id: 'd1', community_id: CID, author_id: P.Ioana, status: 'approved', category: 'general', created_at: hoursAgo(6),
    title: 'Ar merge niște bănci în fața scării B?', body: 'M-am gândit că ar fi plăcut pentru cei mai în vârstă.' },
  { id: 'd2', community_id: CID, author_id: P.Bogdan, status: 'approved', category: 'parking', created_at: daysAgo(1),
    title: 'Locurile de parcare din spate', body: 'Propun să le marcăm, se parchează haotic în ultima vreme.' },
  { id: 'd3', community_id: CID, author_id: P.Carmen, status: 'approved', category: 'general', created_at: daysAgo(3),
    title: 'Cine recomandă un instalator bun?', body: 'Am nevoie de cineva serios pentru o baterie.' },
  { id: 'd4', community_id: CID, author_id: P.Sorin, status: 'approved', category: 'green', created_at: daysAgo(6),
    title: 'Plantăm ceva în fața blocului primăvara asta?', body: 'Aș contribui cu bani și cu munca.' },
  { id: 'd5', community_id: CID, author_id: P.Diana, status: 'approved', category: 'general', created_at: daysAgo(12),
    title: 'Program de liniște în weekend', body: 'Ar fi util să ne înțelegem asupra unui interval.' },
];

export const discussion_replies = [
  { id: 'r1', discussion_id: 'd1', author_id: P.Ana, body: 'Bună idee. Putem discuta la adunare.', created_at: hoursAgo(4) },
  { id: 'r2', discussion_id: 'd1', author_id: P.Tudor, body: 'Susțin, mai ales lângă intrare.', created_at: hoursAgo(3) },
  { id: 'r3', discussion_id: 'd2', author_id: P.Florin, body: 'De acord, dar cine plătește marcajul?', created_at: hoursAgo(20) },
  { id: 'r4', discussion_id: 'd2', author_id: P.Alina, body: 'Am cerut un preț anul trecut, era rezonabil.', created_at: hoursAgo(14) },
  { id: 'r5', discussion_id: 'd3', author_id: P.Paul, body: 'Îți dau un număr în privat.', created_at: daysAgo(2) },
  { id: 'r6', discussion_id: 'd4', author_id: P.Monica, body: 'Mă bag și eu cu câteva plante.', created_at: daysAgo(5) },
];

export const polls = [
  { id: 'p1', community_id: CID, author_id: P.Ana, question: 'Reparăm acoperișul anul acesta sau amânăm?',
    multi: false, closed: false, ends_at: daysAgo(-4), created_at: daysAgo(3) },
  { id: 'p2', community_id: CID, author_id: P.Ana, question: 'Ce zi preferați pentru curățenia scărilor?',
    multi: false, closed: false, ends_at: daysAgo(-9), created_at: daysAgo(1) },
];

export const poll_options = [
  { id: 'o1', poll_id: 'p1', label: 'Reparăm acum' },
  { id: 'o2', poll_id: 'p1', label: 'Amânăm pentru anul viitor' },
  { id: 'o3', poll_id: 'p2', label: 'Marți' },
  { id: 'o4', poll_id: 'p2', label: 'Vineri' },
];

const voters1 = ['Ion','Cristina','Gabriela','Andrei','Ioana','Victor','Maria','Alex','Simona','Bogdan','Carmen'];
const voters2 = ['Dan','Roxana','Florin'];
export const poll_votes = [
  ...voters1.map((n) => ({ poll_id: 'p1', option_id: 'o1', user_id: P[n] })),
  ...voters2.map((n) => ({ poll_id: 'p1', option_id: 'o2', user_id: P[n] })),
  ...['Ana','Elena','Ion','Alina','Sorin'].map((n) => ({ poll_id: 'p2', option_id: 'o3', user_id: P[n] })),
  ...['Diana','Paul','Monica'].map((n) => ({ poll_id: 'p2', option_id: 'o4', user_id: P[n] })),
];

export const notifications = [
  { id: 'n1', community_id: CID, user_id: ME, type: 'announcement', read: false, created_at: hoursAgo(5),
    title: 'Anunț nou', body: 'Apa caldă se oprește joi, între 9 și 15', link: '/app/announcements/a1' },
  { id: 'n2', community_id: CID, user_id: ME, type: 'issue', read: false, created_at: hoursAgo(3),
    title: 'Sesizare nouă', body: 'Becul de pe scara B nu mai merge', link: '/app/issues/i1' },
  { id: 'n3', community_id: CID, user_id: ME, type: 'poll', read: true, created_at: daysAgo(3),
    title: 'Vot nou', body: 'Reparăm acoperișul anul acesta sau amânăm?', link: '/app/polls/p1' },
];

export const notification_prefs = [
  { user_id: ME, announcements: true, replies: true, issues: true, polls: true, push: true },
];

export const TABLES = {
  profiles, memberships, communities, announcements, discussions, discussion_replies,
  issues, issue_supporters, issue_history, issue_comments,
  polls, poll_options, poll_votes, notifications, notification_prefs,
  member_phones, archived_items: [], deleted_accounts: [],
};

export const ME_PROFILE = profiles[0];
