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
