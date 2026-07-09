import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { buildSeed } from '../data/seed.js';
import { STRINGS } from '../i18n/strings.js';

/*
  Single source of truth for the whole app.
  Data lives in localStorage today; the action surface below is intentionally
  small and pure so it can be swapped to Supabase with no UI changes.
*/

const DATA_KEY = 'vecini.data.v1';
const PREF_KEY = 'vecini.prefs.v1';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

function loadData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return buildSeed();
}
function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { lang: 'ro', roleOverride: null, authed: false };
}

const uid = (p = 'x') => p + '_' + Math.random().toString(36).slice(2, 9);

export function AppProvider({ children }) {
  const [data, setData] = useState(loadData);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [toast, setToast] = useState(null);

  useEffect(() => { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }, [prefs]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  // ---- language ----
  const lang = prefs.lang;
  const t = useCallback((key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.ro[key] || key, [lang]);
  const setLang = (l) => setPrefs((p) => ({ ...p, lang: l }));
  // pick localized field: field + 'En' when in english and present
  const L = useCallback((obj, field) => {
    if (!obj) return '';
    if (lang === 'en' && obj[field + 'En']) return obj[field + 'En'];
    return obj[field];
  }, [lang]);

  // ---- identity & role ----
  const currentUser = data.users[data.currentUserId];
  const membership = data.members.find((m) => m.userId === data.currentUserId);
  const baseRole = membership ? membership.role : 'member';
  const role = prefs.roleOverride || baseRole;
  const setRoleOverride = (r) => setPrefs((p) => ({ ...p, roleOverride: r }));
  const isStaff = role === 'admin' || role === 'moderator';

  const setAuthed = (v) => setPrefs((p) => ({ ...p, authed: v }));

  // ---- helpers ----
  const userById = (id) => data.users[id] || { name: '—', apartment: '', color: '#999' };

  // ---- mutations ----
  const update = (fn) => setData((d) => fn(structuredClone(d)));

  const actions = useMemo(() => ({
    resetDemo: () => { setData(buildSeed()); showToast(t('done')); },

    // announcements
    addAnnouncement: ({ title, body }) => {
      const id = uid('a');
      update((d) => {
        d.announcements.unshift({ id, official: true, pinned: false, authorId: d.currentUserId, createdAt: Date.now(), title, body });
        d.notifications.unshift({ id: uid('n'), type: 'announcement', createdAt: Date.now(), read: false, title: STRINGS[lang].ann_new, body: title, link: '/app/announcements/' + id });
        return d;
      });
      showToast(t('ann_members_notified'));
      return id;
    },
    togglePin: (id) => update((d) => { const a = d.announcements.find((x) => x.id === id); if (a) a.pinned = !a.pinned; return d; }),

    // discussions
    addDiscussion: ({ title, category, body }) => {
      const id = uid('d');
      update((d) => { d.discussions.unshift({ id, category, authorId: d.currentUserId, createdAt: Date.now(), status: 'approved', title, body, replies: [] }); return d; });
      showToast(t('disc_published'));
      return id;
    },
    addReply: (discId, body) => {
      update((d) => { const disc = d.discussions.find((x) => x.id === discId); if (disc) disc.replies.push({ id: uid('r'), authorId: d.currentUserId, createdAt: Date.now(), body }); return d; });
      showToast(t('disc_reply_added'));
    },

    // issues
    addIssue: ({ title, category, location, description, photo }) => {
      const id = Math.floor(1000 + Math.random() * 9000);
      update((d) => {
        d.issues.unshift({ id, category, location, description, photo: photo || null, reporterId: d.currentUserId, createdAt: Date.now(), status: 'new', supporters: [], comments: [], history: [{ status: 'new', note: STRINGS[lang].iss_submitted, byId: d.currentUserId, at: Date.now() }] });
        return d;
      });
      showToast(t('iss_submitted'));
      return id;
    },
    toggleSupport: (issueId) => update((d) => {
      const is = d.issues.find((x) => x.id === issueId); if (!is) return d;
      const i = is.supporters.indexOf(d.currentUserId);
      if (i >= 0) is.supporters.splice(i, 1); else is.supporters.push(d.currentUserId);
      return d;
    }),
    addIssueComment: (issueId, body) => update((d) => { const is = d.issues.find((x) => x.id === issueId); if (is) is.comments.push({ id: uid('c'), authorId: d.currentUserId, createdAt: Date.now(), body }); return d; }),
    updateIssueStatus: (issueId, status, note) => {
      update((d) => {
        const is = d.issues.find((x) => x.id === issueId); if (!is) return d;
        is.status = status;
        is.history.push({ status, note, byId: d.currentUserId, at: Date.now() });
        d.notifications.unshift({ id: uid('n'), type: 'issue', createdAt: Date.now(), read: false, title: STRINGS[lang].iss_status_updated, body: is.title, link: '/app/issues/' + issueId });
        return d;
      });
      showToast(t('iss_status_updated'));
    },

    // polls
    addPoll: ({ question, options, multi, endsAt }) => {
      const id = uid('p');
      update((d) => { d.polls.unshift({ id, authorId: d.currentUserId, createdAt: Date.now(), closed: false, endsAt, multi, question, options: options.map((label, i) => ({ id: uid('o'), label, votes: 0 })), voters: {} }); return d; });
      showToast(t('poll_created'));
      return id;
    },
    votePoll: (pollId, optionIds) => {
      update((d) => {
        const p = d.polls.find((x) => x.id === pollId); if (!p) return d;
        if (p.voters[d.currentUserId]) return d;
        p.voters[d.currentUserId] = optionIds;
        optionIds.forEach((oid) => { const o = p.options.find((x) => x.id === oid); if (o) o.votes += 1; });
        return d;
      });
      showToast(t('poll_vote_saved'));
    },
    closePoll: (pollId) => update((d) => { const p = d.polls.find((x) => x.id === pollId); if (p) p.closed = true; return d; }),

    // moderation
    moderate: (discId, action, newCat) => {
      update((d) => {
        const disc = d.discussions.find((x) => x.id === discId); if (!disc) return d;
        if (action === 'approve') disc.status = 'approved';
        if (action === 'hide') disc.status = 'hidden';
        if (action === 'move' && newCat) { disc.category = newCat; disc.status = 'approved'; }
        return d;
      });
      showToast(t(action === 'approve' ? 'admin_post_approved' : action === 'hide' ? 'admin_post_hidden' : 'admin_post_moved'));
    },

    // members
    changeRole: (userId, newRole) => { update((d) => { const m = d.members.find((x) => x.userId === userId); if (m) m.role = newRole; return d; }); showToast(t('admin_role_changed')); },
    removeMember: (userId) => { update((d) => { d.members = d.members.filter((x) => x.userId !== userId); return d; }); showToast(t('admin_member_removed')); },

    // settings
    saveCommunity: (patch) => { update((d) => { Object.assign(d.community, patch); return d; }); showToast(t('admin_saved')); },
    regenCode: () => { update((d) => { d.community.code = 'CASTANI-' + Math.floor(10 + Math.random() * 89); return d; }); },

    // notifications
    markAllRead: () => update((d) => { d.notifications.forEach((n) => (n.read = true)); return d; }),
    markRead: (id) => update((d) => { const n = d.notifications.find((x) => x.id === id); if (n) n.read = true; return d; }),
    setNotifPref: (key, val) => update((d) => { d.notifPrefs[key] = val; return d; }),
  }), [lang, showToast, t]);

  const value = {
    data, prefs, lang, t, L, setLang,
    currentUser, role, baseRole, setRoleOverride, isStaff,
    authed: prefs.authed, setAuthed,
    userById, actions, toast, showToast,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
