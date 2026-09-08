const LOCALES = { ro: 'ro-RO', en: 'en-GB', hu: 'hu-HU' };

// Relative time comes from the dictionary as a "{n}" template, so each
// language controls its own word order rather than being hardcoded here.
export function timeAgo(ts, t) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  const fill = (key, n) => t(key).replace('{n}', n);
  if (m < 1) return t('time_now');
  if (m < 60) return fill('time_ago_min', m);
  if (h < 24) return fill('time_ago_h', h);
  if (d === 1) return t('time_yesterday');
  return fill('time_ago_days', d);
}

/*
  How long an announcement stays at the top, said the way a person would.

  Within the week the weekday is what people actually plan around — "până joi"
  places it better than a date does. Past that the day and month carry more,
  because "până marți" nine days out is genuinely ambiguous about which Tuesday.
*/
export function untilLabel(ts, lang) {
  const loc = LOCALES[lang] || LOCALES.ro;
  const d = new Date(ts);
  const days = Math.ceil((ts - Date.now()) / 86400000);
  if (days <= 6) return d.toLocaleDateString(loc, { weekday: 'long' });
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
}

/** Is this announcement being held at the top right now? */
export const isPriority = (a) => !!a?.pinnedUntil && a.pinnedUntil > Date.now();

/*
  When an event is, written the way somebody would say it out loud.

  Calendar dates are counted by the day they fall on, not by hours elapsed: an
  event at nine tomorrow morning is "tomorrow" whether you look at it now or at
  eleven tonight, and a subtraction of milliseconds gets that wrong every time
  it crosses midnight.
*/
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const daysBetween = (ts) => Math.round((startOfDay(ts) - startOfDay(Date.now())) / 86400000);

/** "Mâine", "sâmbătă", "14 sept." — the day, without the clock. */
export function eventDay(ts, lang, t) {
  const loc = LOCALES[lang] || LOCALES.ro;
  const away = daysBetween(ts);
  if (away === 0) return t('ev_today');
  if (away === 1) return t('ev_tomorrow');
  const d = new Date(ts);
  // Inside the coming week the weekday is what people plan around; beyond it,
  // "Tuesday" stops identifying which Tuesday.
  if (away > 1 && away <= 6) return d.toLocaleDateString(loc, { weekday: 'long' });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "18:00", in the reader's own locale. */
export const eventTime = (ts, lang) =>
  new Date(ts).toLocaleTimeString(LOCALES[lang] || LOCALES.ro, { hour: '2-digit', minute: '2-digit' });

/** The whole thing: "Mâine · 18:00", or just the day when it runs all day. */
export function eventWhen(ev, lang, t) {
  const day = eventDay(ev.startsAt, lang, t);
  if (ev.allDay) return day;
  return `${day} · ${eventTime(ev.startsAt, lang)}`;
}

/*
  How long you have to fix a typo in something you already sent: fifteen
  minutes, the same as WhatsApp. Long enough to catch the mistake you notice
  the moment it is on screen, short enough that nobody can rewrite what they
  promised after three neighbours have replied to it.

  The database enforces the same number and is the one that decides — see
  supabase/0015_comment_edits.sql. This is only so the app does not offer
  something that would be refused.
*/
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const canStillEdit = (createdAt) => Date.now() - createdAt < EDIT_WINDOW_MS;

/** Has it already happened? All-day events count until the end of their day. */
export function isPast(ev) {
  const end = ev.endsAt || ev.startsAt;
  return ev.allDay ? startOfDay(end) < startOfDay(Date.now()) : end < Date.now();
}

export function formatDate(ts, lang) {
  const d = new Date(ts);
  return d.toLocaleDateString(LOCALES[lang] || LOCALES.ro, { day: 'numeric', month: 'long', year: 'numeric' });
}

export function daysUntil(ts) {
  return Math.max(0, Math.ceil((ts - Date.now()) / 86400000));
}

// category -> {key for translation, icon, tint bg/fg}
export const CATEGORIES = {
  general:     { icon: '💬', bg: '#eef0ec', fg: '#5a5e54' },
  parking:     { icon: '🚗', bg: '#e7eff7', fg: '#3a6ea8' },
  safety:      { icon: '🛡️', bg: '#f7ece2', fg: '#b4532a' },
  cleaning:    { icon: '🧹', bg: '#e6f3eb', fg: '#2f8c5f' },
  green:       { icon: '🌿', bg: '#e6f3eb', fg: '#2f8c5f' },
  events:      { icon: '🎉', bg: '#f3ecf7', fg: '#7a5cc0' },
  maintenance: { icon: '💰', bg: '#f7efe0', fg: '#b9802a' },
  plumbing:    { icon: '🔧', bg: '#e7eff7', fg: '#3a6ea8' },
  electric:    { icon: '💡', bg: '#f7efe0', fg: '#b9802a' },
  elevator:    { icon: '🛗', bg: '#eef0ec', fg: '#5a5e54' },
  common:      { icon: '🏢', bg: '#eef0ec', fg: '#5a5e54' },
  other:       { icon: '📌', bg: '#eef0ec', fg: '#5a5e54' },
};
export const catLabel = (cat, t) => t('cat_' + cat) || cat;

export const ISSUE_CATS = ['electric', 'plumbing', 'cleaning', 'safety', 'parking', 'elevator', 'common', 'other'];
export const DISC_CATS = ['general', 'parking', 'safety', 'green', 'events', 'maintenance', 'other'];

export const STATUS = {
  new:      { key: 'st_new',      fg: 'var(--status-new-fg)',  bg: 'var(--status-new-bg)' },
  progress: { key: 'st_progress', fg: 'var(--status-prog-fg)', bg: 'var(--status-prog-bg)' },
  resolved: { key: 'st_resolved', fg: 'var(--status-done-fg)', bg: 'var(--status-done-bg)' },
};
