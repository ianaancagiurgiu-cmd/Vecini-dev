// Demo seed for "Aleea Castanilor 12". This is the data the app starts with.
// Dates are relative to "now" so the demo always feels fresh.
const now = Date.now();
const H = 3600 * 1000;
const D = 24 * H;

export const AVATAR_COLORS = ['#2f6b4f', '#b4532a', '#3a6ea8', '#b9802a', '#2f8c5f', '#7a5cc0', '#c04f7a'];

export function buildSeed() {
  const users = {
    u_ana:    { id: 'u_ana',    name: 'Ana Popescu',      apartment: 'ap. 23', color: '#2f6b4f' },
    u_mihai:  { id: 'u_mihai',  name: 'Mihai Ionescu',    apartment: 'ap. 14', color: '#3a6ea8' },
    u_elena:  { id: 'u_elena',  name: 'Elena Dumitru',    apartment: 'ap. 41', color: '#b4532a' },
    u_radu:   { id: 'u_radu',   name: 'Radu Marin',       apartment: 'ap. 7',  color: '#b9802a' },
    u_ioana:  { id: 'u_ioana',  name: 'Ioana Stan',       apartment: 'ap. 33', color: '#2f8c5f' },
    u_george: { id: 'u_george', name: 'George Vlad',      apartment: 'ap. 19', color: '#7a5cc0' },
    u_comitet:{ id: 'u_comitet',name: 'Comitetul asociației', apartment: 'Administrație', color: '#1d3b2c' },
  };

  const members = [
    { userId: 'u_ana',     role: 'admin',     joinedAt: now - 210 * D },
    { userId: 'u_comitet', role: 'admin',     joinedAt: now - 260 * D },
    { userId: 'u_mihai',   role: 'moderator', joinedAt: now - 180 * D },
    { userId: 'u_elena',   role: 'moderator', joinedAt: now - 120 * D },
    { userId: 'u_radu',    role: 'member',    joinedAt: now - 90 * D },
    { userId: 'u_ioana',   role: 'member',    joinedAt: now - 60 * D },
    { userId: 'u_george',  role: 'member',    joinedAt: now - 30 * D },
  ];

  const community = {
    id: 'c_castani',
    name: 'Aleea Castanilor 12',
    address: 'Aleea Castanilor 12',
    code: 'CASTANI-12',
    memberCount: 48,
    staircases: 3,
    joinMode: 'invite',
    description: 'Comunitatea celor 48 de vecini din blocul de pe Aleea Castanilor 12, scările A, B și C.',
  };

  const announcements = [
    {
      id: 'a1', official: true, pinned: true, authorId: 'u_comitet',
      createdAt: now - 2 * D,
      title: 'Curățenie generală pe scara A — sâmbătă 28 iunie',
      titleEn: 'General cleaning on staircase A — Saturday June 28',
      body: 'Dragi vecini,\n\nSâmbătă, 28 iunie, între orele 9:00 și 13:00, va avea loc curățenia generală pe scara A. Vă rugăm să eliberați holurile de obiecte personale (biciclete, cutii, ghivece) până vineri seara.\n\nMulțumim pentru înțelegere!\nComitetul asociației',
      bodyEn: 'Dear neighbors,\n\nOn Saturday, June 28, between 9:00 and 13:00, general cleaning will take place on staircase A. Please clear the hallways of personal items (bikes, boxes, plant pots) by Friday evening.\n\nThank you for understanding!\nThe association committee',
    },
    {
      id: 'a2', official: true, pinned: false, authorId: 'u_comitet',
      createdAt: now - 6 * D,
      title: 'Reparație lift blocul B — finalizată',
      titleEn: 'Elevator repair building B — completed',
      body: 'Liftul de pe scara B a fost reparat și repus în funcțiune. Mulțumim pentru răbdare pe durata intervenției.',
      bodyEn: 'The elevator on staircase B has been repaired and is back in service. Thank you for your patience during the works.',
    },
    {
      id: 'a3', official: true, pinned: false, authorId: 'u_comitet',
      createdAt: now - 12 * D,
      title: 'Întreținere iunie — 2.400 lei pe scară',
      titleEn: 'June maintenance — 2,400 lei per staircase',
      body: 'Cotele de întreținere pentru luna iunie au fost afișate la avizier. Termenul de plată este 15 iulie. Detaliile pe apartament le găsiți la administrator.',
      bodyEn: 'June maintenance fees have been posted on the board. Payment deadline is July 15. Per-apartment details are available from the administrator.',
    },
  ];

  const discussions = [
    {
      id: 'd1', category: 'events', authorId: 'u_ioana', createdAt: now - 1 * D, status: 'approved',
      title: 'Idei pentru locul de joacă',
      titleEn: 'Ideas for the playground',
      body: 'Ce ziceți să strângem câțiva bani și să punem un tobogan nou și o bancă la locul de joacă din curte? Copiii ar fi încântați.',
      bodyEn: 'What if we pool some money and add a new slide and a bench at the playground in the yard? The kids would love it.',
      replies: [
        { id: 'd1r1', authorId: 'u_radu', createdAt: now - 20 * H, body: 'Super idee! Mă bag și eu cu o contribuție.', bodyEn: 'Great idea! I’m in with a contribution.' },
        { id: 'd1r2', authorId: 'u_george', createdAt: now - 16 * H, body: 'Ar fi bine și niște umbră, un copac sau o umbrelă mare.', bodyEn: 'Some shade would be nice too — a tree or a big umbrella.' },
      ],
    },
    {
      id: 'd2', category: 'parking', authorId: 'u_mihai', createdAt: now - 3 * D, status: 'approved',
      title: 'Locurile de parcare din spate',
      titleEn: 'The parking spots in the back',
      body: 'Observ că unele mașini stau pe locurile altora. Putem stabili niște reguli clare?',
      bodyEn: 'I notice some cars park in others’ spots. Can we set some clear rules?',
      replies: [
        { id: 'd2r1', authorId: 'u_elena', createdAt: now - 2 * D, body: 'De acord, hai să facem o listă cu numerele de apartament și locurile.', bodyEn: 'Agreed, let’s make a list matching apartment numbers to spots.' },
      ],
    },
    {
      id: 'd3', category: 'general', authorId: 'u_george', createdAt: now - 5 * H, status: 'pending',
      title: 'Reciclare — putem pune mai multe tomberoane?',
      titleEn: 'Recycling — can we add more bins?',
      body: 'Tomberoanele de reciclare se umplu foarte repede. Ar ajuta încă unul pentru plastic.',
      bodyEn: 'The recycling bins fill up very fast. One more for plastic would help.',
      replies: [],
    },
  ];

  const issues = [
    {
      id: 101, category: 'electric', location: 'Scara A, parter',
      reporterId: 'u_elena', createdAt: now - 1.5 * D, status: 'progress',
      title: 'Bec ars pe scara A',
      titleEn: 'Burnt-out light on staircase A',
      description: 'E întuneric complet seara pe scara A, e periculos pe trepte. Becul de la parter e ars de câteva zile.',
      descriptionEn: 'It’s pitch dark on staircase A in the evening, dangerous on the steps. The ground-floor light has been out for days.',
      photo: null,
      supporters: ['u_ana', 'u_radu', 'u_ioana'],
      comments: [
        { id: 'c1', authorId: 'u_mihai', createdAt: now - 1 * D, body: 'Confirm, și la mine e la fel.', bodyEn: 'Confirmed, same on my side.' },
      ],
      history: [
        { status: 'new', note: 'Sesizare înregistrată.', noteEn: 'Issue registered.', byId: 'u_elena', at: now - 1.5 * D },
        { status: 'progress', note: 'Am comandat becurile, le montăm în weekend.', noteEn: 'Ordered the bulbs, installing this weekend.', byId: 'u_comitet', at: now - 20 * H },
      ],
    },
    {
      id: 102, category: 'plumbing', location: 'Scara C, subsol',
      reporterId: 'u_radu', createdAt: now - 4 * D, status: 'new',
      title: 'Scurgere la subsol pe scara C',
      titleEn: 'Leak in the basement on staircase C',
      description: 'Se aude apă curgând la subsol și e o baltă lângă contorul de apă.',
      descriptionEn: 'Water can be heard running in the basement and there’s a puddle near the water meter.',
      photo: null,
      supporters: ['u_george'],
      comments: [],
      history: [
        { status: 'new', note: 'Sesizare înregistrată.', noteEn: 'Issue registered.', byId: 'u_radu', at: now - 4 * D },
      ],
    },
    {
      id: 103, category: 'elevator', location: 'Scara B',
      reporterId: 'u_ana', createdAt: now - 10 * D, status: 'resolved',
      title: 'Liftul de pe scara B se blochează',
      titleEn: 'Elevator on staircase B keeps getting stuck',
      description: 'Liftul s-a blocat de două ori între etaje săptămâna asta.',
      descriptionEn: 'The elevator got stuck twice between floors this week.',
      photo: null,
      supporters: ['u_mihai', 'u_elena', 'u_ioana', 'u_george'],
      comments: [],
      history: [
        { status: 'new', note: 'Sesizare înregistrată.', noteEn: 'Issue registered.', byId: 'u_ana', at: now - 10 * D },
        { status: 'progress', note: 'Firma de mentenanță a fost chemată.', noteEn: 'Maintenance company called.', byId: 'u_comitet', at: now - 8 * D },
        { status: 'resolved', note: 'Lift reparat și testat. Funcționează normal.', noteEn: 'Elevator repaired and tested. Working normally.', byId: 'u_comitet', at: now - 6 * D },
      ],
    },
  ];

  const polls = [
    {
      id: 'p1', authorId: 'u_comitet', createdAt: now - 2 * D, closed: false,
      endsAt: now + 3 * D, multi: false,
      question: 'Schimbăm firma de curățenie?',
      questionEn: 'Should we change the cleaning company?',
      options: [
        { id: 'o1', label: 'Da, cea actuală nu e ok', labelEn: 'Yes, the current one isn’t good', votes: 21 },
        { id: 'o2', label: 'Nu, sunt mulțumit', labelEn: 'No, I’m satisfied', votes: 9 },
        { id: 'o3', label: 'Mai așteptăm o lună', labelEn: 'Let’s wait one more month', votes: 4 },
      ],
      voters: {},
    },
    {
      id: 'p2', authorId: 'u_ana', createdAt: now - 1 * D, closed: false,
      endsAt: now + 5 * D, multi: true,
      question: 'Ce îmbunătățiri vrei în curte? (poți alege mai multe)',
      questionEn: 'What improvements do you want in the yard? (choose several)',
      options: [
        { id: 'q1', label: 'Bănci noi', labelEn: 'New benches', votes: 12 },
        { id: 'q2', label: 'Mai multe flori', labelEn: 'More flowers', votes: 15 },
        { id: 'q3', label: 'Loc de joacă', labelEn: 'Playground', votes: 18 },
        { id: 'q4', label: 'Parcare biciclete', labelEn: 'Bike parking', votes: 7 },
      ],
      voters: {},
    },
    {
      id: 'p3', authorId: 'u_comitet', createdAt: now - 20 * D, closed: true,
      endsAt: now - 5 * D, multi: false,
      question: 'Aprobăm reparația liftului de pe scara B?',
      questionEn: 'Approve the elevator repair on staircase B?',
      options: [
        { id: 'r1', label: 'Da', labelEn: 'Yes', votes: 40 },
        { id: 'r2', label: 'Nu', labelEn: 'No', votes: 3 },
      ],
      voters: {},
    },
  ];

  const notifications = [
    { id: 'n1', type: 'announcement', createdAt: now - 2 * D, read: false, title: 'Anunț nou oficial', titleEn: 'New official announcement', body: 'Curățenie generală pe scara A — sâmbătă 28 iunie', bodyEn: 'General cleaning on staircase A — Saturday June 28', link: '/app/announcements/a1' },
    { id: 'n2', type: 'issue', createdAt: now - 20 * H, read: false, title: 'Sesizarea ta a fost actualizată', titleEn: 'Your issue was updated', body: 'Bec ars pe scara A → În lucru', bodyEn: 'Burnt-out light on staircase A → In progress', link: '/app/issues/101' },
    { id: 'n3', type: 'reply', createdAt: now - 16 * H, read: true, title: 'Răspuns nou la tema ta', titleEn: 'New reply to your topic', body: 'George Vlad a răspuns la „Idei pentru locul de joacă”', bodyEn: 'George Vlad replied to “Ideas for the playground”', link: '/app/discussions/d1' },
  ];

  return {
    users,
    members,
    community,
    announcements,
    discussions,
    issues,
    polls,
    notifications,
    notifPrefs: { announcements: true, replies: true, issues: true, polls: true, push: false },
    currentUserId: 'u_ana',
  };
}
