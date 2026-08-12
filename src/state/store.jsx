import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { STRINGS } from '../i18n/strings.js';
import { enablePush, disablePush, resyncPush } from '../lib/push.js';

/*
  Real backend: Supabase (Postgres + Auth + Storage), protected by Row Level
  Security. This context is the only place that talks to Supabase; screens
  call the same action names as before so the UI barely had to change.
*/

const PREF_KEY = 'vecini.prefs.v1';
const ACTIVE_COMMUNITY_KEY = 'vecini.activeCommunity.v1';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { lang: 'ro' };
}

const emptyData = () => ({
  users: {},
  members: [],
  community: null,
  announcements: [],
  discussions: [],
  issues: [],
  polls: [],
  notifications: [],
  notifPrefs: { announcements: true, replies: true, issues: true, polls: true, push: false },
});

const genCode = (name) => {
  const base = (name || 'VECINI').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'VECINI';
  return `${base}-${Math.floor(10 + Math.random() * 89)}`;
};

export function AppProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [session, setSession] = useState(undefined); // undefined = not checked yet
  const [profile, setProfile] = useState(null);
  const [activeCommunityId, setActiveCommunityId] = useState(() => localStorage.getItem(ACTIVE_COMMUNITY_KEY) || null);
  const [membershipResolved, setMembershipResolved] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [data, setData] = useState(emptyData);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const mounted = useRef(true);

  useEffect(() => { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => {
    if (activeCommunityId) localStorage.setItem(ACTIVE_COMMUNITY_KEY, activeCommunityId);
    else localStorage.removeItem(ACTIVE_COMMUNITY_KEY);
  }, [activeCommunityId]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  // ---- language ----
  const lang = prefs.lang;
  const t = useCallback((key) => (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.ro[key] || key, [lang]);
  const setLang = (l) => setPrefs((p) => ({ ...p, lang: l }));
  const L = useCallback((obj, field) => {
    if (!obj) return '';
    if (lang === 'en' && obj[field + 'En']) return obj[field + 'En'];
    return obj[field];
  }, [lang]);

  // ---- auth bootstrap ----
  useEffect(() => {
    mounted.current = true;
    supabase.auth.getSession().then(({ data: { session } }) => { if (mounted.current) setSession(session); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Arriving from a "reset password" email link signs the person in with a
      // short-lived recovery session. We flag that so the app can send them
      // straight to "choose a new password" instead of into the dashboard.
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
    });
    return () => { mounted.current = false; sub.subscription.unsubscribe(); };
  }, []);

  const userId = session?.user?.id || null;
  const authed = !!session;

  // fetch / create this user's profile row
  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    (async () => {
      let { data: row } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!row) {
        const fullName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Vecin';
        const { data: created } = await supabase.from('profiles').insert({ id: userId, full_name: fullName }).select('*').single();
        row = created;
      }
      if (mounted.current) setProfile(row);
    })();
  }, [userId]);

  // if we don't have (or lost access to) an active community, fall back to the user's first membership
  useEffect(() => {
    if (!userId) { setMembershipResolved(false); return; }
    (async () => {
      if (activeCommunityId) {
        const { data: still } = await supabase.from('memberships').select('id').eq('user_id', userId).eq('community_id', activeCommunityId).maybeSingle();
        if (still) { setMembershipResolved(true); return; }
      }
      const { data: first } = await supabase.from('memberships').select('community_id').eq('user_id', userId).order('joined_at', { ascending: true }).limit(1).maybeSingle();
      setActiveCommunityId(first ? first.community_id : null);
      setMembershipResolved(true);
    })();
  }, [userId, activeCommunityId === null]);

  // ---- data loading ----
  const refreshAll = useCallback(async () => {
    if (!userId || !activeCommunityId) { setData(emptyData()); return; }
    setDataLoading(true);
    try {
      const cid = activeCommunityId;
      const [{ data: community }, { data: members }] = await Promise.all([
        supabase.from('communities').select('*').eq('id', cid).maybeSingle(),
        supabase.from('memberships').select('*').eq('community_id', cid).order('joined_at', { ascending: true }),
      ]);
      if (!community) { setData(emptyData()); setDataLoading(false); return; }

      const memberIds = (members || []).map((m) => m.user_id);
      const { data: profilesRows } = memberIds.length
        ? await supabase.from('profiles').select('*').in('id', memberIds)
        : { data: [] };
      const users = {};
      (profilesRows || []).forEach((p) => { users[p.id] = { id: p.id, name: p.full_name, apartment: p.apartment, color: p.avatar_color }; });

      const [{ data: announcements }, { data: discussions }, { data: issues }, { data: polls }, { data: notifications }, { data: notifPrefsRow }] = await Promise.all([
        supabase.from('announcements').select('*').eq('community_id', cid).order('created_at', { ascending: false }),
        supabase.from('discussions').select('*').eq('community_id', cid).neq('status', 'hidden').order('created_at', { ascending: false }),
        supabase.from('issues').select('*').eq('community_id', cid).order('created_at', { ascending: false }),
        supabase.from('polls').select('*').eq('community_id', cid).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('community_id', cid).eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      const discIds = (discussions || []).map((d) => d.id);
      const { data: replies } = discIds.length
        ? await supabase.from('discussion_replies').select('*').in('discussion_id', discIds).order('created_at', { ascending: true })
        : { data: [] };
      const discussionsFull = (discussions || []).map((d) => ({ ...d, replies: (replies || []).filter((r) => r.discussion_id === d.id) }));

      const issueIds = (issues || []).map((i) => i.id);
      const [{ data: supporters }, { data: history }, { data: comments }] = issueIds.length
        ? await Promise.all([
            supabase.from('issue_supporters').select('*').in('issue_id', issueIds),
            supabase.from('issue_history').select('*').in('issue_id', issueIds).order('at', { ascending: true }),
            supabase.from('issue_comments').select('*').in('issue_id', issueIds).order('created_at', { ascending: true }),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];
      const issuesFull = (issues || []).map((i) => ({
        ...i,
        supporters: (supporters || []).filter((s) => s.issue_id === i.id).map((s) => s.user_id),
        history: (history || []).filter((h) => h.issue_id === i.id),
        comments: (comments || []).filter((c) => c.issue_id === i.id),
      }));

      const pollIds = (polls || []).map((p) => p.id);
      const [{ data: options }, { data: votes }] = pollIds.length
        ? await Promise.all([
            supabase.from('poll_options').select('*').in('poll_id', pollIds),
            supabase.from('poll_votes').select('*').in('poll_id', pollIds),
          ])
        : [{ data: [] }, { data: [] }];
      const pollsFull = (polls || []).map((p) => {
        const opts = (options || []).filter((o) => o.poll_id === p.id).map((o) => ({
          ...o,
          votes: (votes || []).filter((v) => v.poll_id === p.id && v.option_id === o.id).length,
        }));
        const voters = {};
        (votes || []).filter((v) => v.poll_id === p.id).forEach((v) => {
          voters[v.user_id] = [...(voters[v.user_id] || []), v.option_id];
        });
        return { ...p, options: opts, voters };
      });

      if (!mounted.current) return;
      setData({
        users,
        members: (members || []).map((m) => ({ userId: m.user_id, role: m.role, joinedAt: new Date(m.joined_at).getTime() })),
        community: { id: community.id, name: community.name, address: community.address, description: community.description, code: community.code, joinMode: community.join_mode, memberCount: (members || []).length, staircases: 1 },
        announcements: (announcements || []).map((a) => ({ ...a, authorId: a.author_id, createdAt: new Date(a.created_at).getTime() })),
        discussions: discussionsFull.map((d) => ({ ...d, authorId: d.author_id, createdAt: new Date(d.created_at).getTime(), replies: d.replies.map((r) => ({ ...r, authorId: r.author_id, createdAt: new Date(r.created_at).getTime() })) })),
        issues: issuesFull.map((i) => ({ ...i, reporterId: i.reporter_id, photo: i.photo_url, createdAt: new Date(i.created_at).getTime(), history: i.history.map((h) => ({ ...h, byId: h.by_id, at: new Date(h.at).getTime() })), comments: i.comments.map((c) => ({ ...c, authorId: c.author_id, createdAt: new Date(c.created_at).getTime() })) })),
        polls: pollsFull.map((p) => ({ ...p, authorId: p.author_id, createdAt: new Date(p.created_at).getTime(), endsAt: new Date(p.ends_at).getTime() })),
        notifications: (notifications || []).map((n) => ({ ...n, createdAt: new Date(n.created_at).getTime() })),
        notifPrefs: notifPrefsRow || { announcements: true, replies: true, issues: true, polls: true, push: false },
      });
    } finally {
      if (mounted.current) setDataLoading(false);
    }
  }, [userId, activeCommunityId]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  /*
    Keep the stored push subscription in step with the browser's. Browsers can
    drop or rotate a subscription at any time, which would otherwise leave the
    user silently unreachable with the toggle still showing "on".
  */
  useEffect(() => {
    if (!userId || !data.notifPrefs.push) return;
    resyncPush(userId);
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === 'push-resubscribe') resyncPush(userId);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [userId, data.notifPrefs.push]);

  // ---- identity & role (real, enforced server-side by RLS — no override) ----
  const currentUser = profile ? { id: profile.id, name: profile.full_name, apartment: profile.apartment, color: profile.avatar_color } : { id: userId, name: '…', apartment: '', color: '#999' };
  const membership = data.members.find((m) => m.userId === userId);
  const role = membership ? membership.role : 'member';
  const isStaff = role === 'admin' || role === 'moderator';

  const userById = (id) => data.users[id] || { name: '—', apartment: '', color: '#999' };

  // ---- auth actions ----
  const signUpEmail = async (name, email, password) => {
    const { data: res, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) throw error;
    return { needsConfirmation: !res.session };
  };
  const signInEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signInGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
    if (error) throw error;
  };
  const sendPasswordReset = async (email) => {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  };

  // Used by the "choose a new password" screen after following a reset link.
  // The recovery session itself is the proof of identity here.
  const setNewPassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecoveryMode(false);
  };

  // Used from Settings while signed in. We deliberately re-check the current
  // password first — otherwise anyone with a borrowed unlocked phone could
  // silently take over the account.
  const changePassword = async (currentPassword, newPassword) => {
    const email = session?.user?.email;
    if (!email) throw new Error('no_email');
    const { error: checkErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (checkErr) throw new Error('wrong_current');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };
  const signOut = async () => { await supabase.auth.signOut(); setActiveCommunityId(null); };

  const joinByCode = async (code) => {
    const clean = code.trim();
    const { data: found, error } = await supabase.from('communities').select('id, name').ilike('code', clean).maybeSingle();
    if (error || !found) throw new Error('bad_code');
    const { error: joinErr } = await supabase.from('memberships').insert({ user_id: userId, community_id: found.id });
    if (joinErr && joinErr.code !== '23505') throw joinErr; // 23505 = already a member, fine
    setActiveCommunityId(found.id);
    return found;
  };
  const createCommunity = async (name, address) => {
    let code = genCode(name);
    let community;
    for (let attempt = 0; attempt < 4 && !community; attempt++) {
      const { data: created, error } = await supabase.from('communities').insert({ name, address, code }).select('*').maybeSingle();
      if (created) community = created;
      else if (error?.code === '23505') code = genCode(name);
      else if (error) throw error;
    }
    if (!community) throw new Error('could_not_create');
    await supabase.from('memberships').insert({ user_id: userId, community_id: community.id });
    setActiveCommunityId(community.id);
    return community;
  };

  // ---- content actions ----
  const cid = activeCommunityId;
  /*
    Notification fan-out happens in Postgres (notify_members / notify_user).
    It has to: RLS correctly forbids the client from reading anyone else's
    notification_prefs, so only the server can tell who opted out of what.
    The RPCs return the users they actually notified — precisely the set worth
    sending a browser push to.
  */
  const idsFrom = (rows) =>
    (rows || []).map((r) => (typeof r === 'string' ? r : r?.user_id ?? r?.notify_members ?? r?.notify_user)).filter(Boolean);

  const sendPush = async (userIds, type, title, body, link) => {
    if (!userIds.length) return;
    try {
      await supabase.functions.invoke('send-push', {
        body: { communityId: cid, userIds, type, title, body, link: link || '', lang },
      });
    } catch (e) {
      // The in-app notification is already saved; a push failure must never
      // fail the action that triggered it.
    }
  };

  const notifyMembers = async (excludeUserId, type, title, body, link) => {
    const { data: rows, error } = await supabase.rpc('notify_members', {
      cid, exclude_user: excludeUserId || null, ntype: type, ntitle: title, nbody: body, nlink: link || '',
    });
    if (error) throw error;
    await sendPush(idsFrom(rows), type, title, body, link);
  };
  const insertNotifyUser = async (targetUserId, type, title, body, link) => {
    if (!targetUserId || targetUserId === userId) return [];
    const { data: rows, error } = await supabase.rpc('notify_user', {
      cid, target_user: targetUserId, ntype: type, ntitle: title, nbody: body, nlink: link || '',
    });
    if (error) throw error;
    return idsFrom(rows);
  };
  const notifyUser = async (targetUserId, type, title, body, link) => {
    const ids = await insertNotifyUser(targetUserId, type, title, body, link);
    await sendPush(ids, type, title, body, link);
  };
  /*
    Staff-only fan-out (a new issue should reach whoever can act on it).
    Done as one call per person rather than a dedicated SQL function because
    members and their roles are already readable here, and this avoids asking
    for another database migration. Staff lists are a handful of people.
  */
  const notifyStaff = async (type, title, body, link) => {
    const staff = data.members.filter(
      (m) => (m.role === 'admin' || m.role === 'moderator') && m.userId !== userId,
    );
    if (!staff.length) return;
    const notified = [];
    for (const m of staff) {
      notified.push(...(await insertNotifyUser(m.userId, type, title, body, link)));
    }
    await sendPush(notified, type, title, body, link);
  };

  const actions = useMemo(() => ({
    addAnnouncement: async ({ title, body }) => {
      const { data: row, error } = await supabase.from('announcements').insert({ community_id: cid, author_id: userId, title, body }).select('*').single();
      if (error) throw error;
      await notifyMembers(userId, 'announcement', STRINGS[lang].ann_new, title, '/app/announcements/' + row.id);
      await refreshAll();
      showToast(t('ann_members_notified'));
      return row.id;
    },
    togglePin: async (id) => {
      const a = data.announcements.find((x) => x.id === id);
      await supabase.from('announcements').update({ pinned: !a?.pinned }).eq('id', id);
      await refreshAll();
    },

    addDiscussion: async ({ title, category, body }) => {
      const { data: row, error } = await supabase.from('discussions').insert({ community_id: cid, author_id: userId, title, category, body, status: 'approved' }).select('*').single();
      if (error) throw error;
      await refreshAll();
      showToast(t('disc_published'));
      return row.id;
    },
    addReply: async (discId, body) => {
      const { error } = await supabase.from('discussion_replies').insert({ discussion_id: discId, author_id: userId, body });
      if (error) throw error;
      const disc = data.discussions.find((d) => d.id === discId);
      if (disc) await notifyUser(disc.authorId, 'reply', STRINGS[lang].disc_new, title_or(disc.title), '/app/discussions/' + discId);
      await refreshAll();
      showToast(t('disc_reply_added'));
    },

    addIssue: async ({ title, category, location, description, photo }) => {
      let photoUrl = null;
      if (photo) photoUrl = await uploadIssuePhoto(photo, userId);
      const { data: row, error } = await supabase.from('issues').insert({ community_id: cid, reporter_id: userId, title, category, location, description, photo_url: photoUrl, status: 'new' }).select('*').single();
      if (error) throw error;
      await supabase.from('issue_history').insert({ issue_id: row.id, status: 'new', note: STRINGS[lang].iss_submitted, by_id: userId });
      // Whoever can act on it needs to know, or the report just sits there.
      await notifyStaff('issue', STRINGS[lang].notif_iss_new, title, '/app/issues/' + row.id);
      await refreshAll();
      showToast(t('iss_submitted'));
      return row.id;
    },
    toggleSupport: async (issueId) => {
      const is = data.issues.find((x) => x.id === issueId);
      const supported = is?.supporters.includes(userId);
      if (supported) await supabase.from('issue_supporters').delete().eq('issue_id', issueId).eq('user_id', userId);
      else await supabase.from('issue_supporters').insert({ issue_id: issueId, user_id: userId });
      await refreshAll();
    },
    addIssueComment: async (issueId, body) => {
      await supabase.from('issue_comments').insert({ issue_id: issueId, author_id: userId, body });
      const is = data.issues.find((x) => x.id === issueId);
      if (is) await notifyUser(is.reporterId, 'issue', STRINGS[lang].notif_iss_comment, is.title, '/app/issues/' + issueId);
      await refreshAll();
    },
    updateIssueStatus: async (issueId, status, note) => {
      await supabase.from('issues').update({ status }).eq('id', issueId);
      await supabase.from('issue_history').insert({ issue_id: issueId, status, note, by_id: userId });
      const is = data.issues.find((x) => x.id === issueId);
      if (is) await notifyUser(is.reporterId, 'issue', STRINGS[lang].iss_status_updated, is.title, '/app/issues/' + issueId);
      await refreshAll();
      showToast(t('iss_status_updated'));
    },

    addPoll: async ({ question, options, multi, endsAt }) => {
      const { data: poll, error } = await supabase.from('polls').insert({ community_id: cid, author_id: userId, question, multi, ends_at: new Date(endsAt).toISOString() }).select('*').single();
      if (error) throw error;
      await supabase.from('poll_options').insert(options.map((label) => ({ poll_id: poll.id, label })));
      await notifyMembers(userId, 'poll', STRINGS[lang].poll_new, question, '/app/polls/' + poll.id);
      await refreshAll();
      showToast(t('poll_created'));
      return poll.id;
    },
    votePoll: async (pollId, optionIds) => {
      const { error } = await supabase.from('poll_votes').insert(optionIds.map((oid) => ({ poll_id: pollId, option_id: oid, user_id: userId })));
      if (error) { showToast(t('poll_already')); return; }
      await refreshAll();
      showToast(t('poll_vote_saved'));
    },
    closePoll: async (pollId) => { await supabase.from('polls').update({ closed: true }).eq('id', pollId); await refreshAll(); },

    moderate: async (discId, action, newCat) => {
      const patch = action === 'approve' ? { status: 'approved' } : action === 'hide' ? { status: 'hidden' } : { status: 'approved', category: newCat };
      await supabase.from('discussions').update(patch).eq('id', discId);
      await refreshAll();
      showToast(t(action === 'approve' ? 'admin_post_approved' : action === 'hide' ? 'admin_post_hidden' : 'admin_post_moved'));
    },

    changeRole: async (targetUserId, newRole) => {
      await supabase.from('memberships').update({ role: newRole }).eq('community_id', cid).eq('user_id', targetUserId);
      await refreshAll();
      showToast(t('admin_role_changed'));
    },
    removeMember: async (targetUserId) => {
      await supabase.from('memberships').delete().eq('community_id', cid).eq('user_id', targetUserId);
      await refreshAll();
      showToast(t('admin_member_removed'));
    },

    saveCommunity: async (patch) => {
      const dbPatch = {};
      if ('name' in patch) dbPatch.name = patch.name;
      if ('description' in patch) dbPatch.description = patch.description;
      if ('joinMode' in patch) dbPatch.join_mode = patch.joinMode;
      if ('address' in patch) dbPatch.address = patch.address;
      await supabase.from('communities').update(dbPatch).eq('id', cid);
      await refreshAll();
      showToast(t('admin_saved'));
    },
    regenCode: async () => {
      await supabase.from('communities').update({ code: genCode(data.community?.name) }).eq('id', cid);
      await refreshAll();
    },

    markAllRead: async () => { await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('community_id', cid).eq('read', false); await refreshAll(); },
    markRead: async (id) => { await supabase.from('notifications').update({ read: true }).eq('id', id); await refreshAll(); },
    setNotifPref: async (key, val) => {
      await supabase.from('notification_prefs').upsert({ user_id: userId, ...data.notifPrefs, [key]: val });
      await refreshAll();
    },
    /*
      Push is not just a stored flag: turning it on needs the browser permission
      prompt and a subscription. Returns null on success, otherwise a reason key
      ('ios-install', 'denied', 'unsupported', 'no-key', 'dismissed', 'error')
      so the screen can explain what to do.
    */
    setPushEnabled: async (val) => {
      try {
        if (val) {
          const reason = await enablePush(userId);
          if (reason) return reason;
        } else {
          await disablePush();
        }
      } catch (e) {
        return 'error';
      }
      await supabase.from('notification_prefs').upsert({ user_id: userId, ...data.notifPrefs, push: val });
      await refreshAll();
      return null;
    },
  }), [cid, userId, lang, data, refreshAll, showToast, t]);

  const value = {
    data, lang, t, L, setLang,
    currentUser, role, isStaff,
    authed, session, hasCommunity: !!activeCommunityId,
    authLoading: session === undefined, dataLoading, membershipResolved,
    userById, actions, toast, showToast,
    signUpEmail, signInEmail, signInGoogle, sendPasswordReset, signOut,
    setNewPassword, changePassword, recoveryMode,
    // Google-only accounts have no password to change; offer "set one" instead.
    hasPasswordLogin: !!session?.user?.identities?.some((i) => i.provider === 'email'),
    joinByCode, createCommunity,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

function title_or(t) { return t || ''; }

async function uploadIssuePhoto(dataUrl, userId) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('issue-photos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  const { data } = supabase.storage.from('issue-photos').getPublicUrl(path);
  return data.publicUrl;
}
