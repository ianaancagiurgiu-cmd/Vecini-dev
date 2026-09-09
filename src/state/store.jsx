import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { STRINGS, pluralForm, counted as countedIn } from '../i18n/strings.js';
import { enablePush, disablePush, resyncPush } from '../lib/push.js';
import { callbackType, callbackError } from '../lib/authCallback.js';

/*
  Real backend: Supabase (Postgres + Auth + Storage), protected by Row Level
  Security. This context is the only place that talks to Supabase; screens
  call the same action names as before so the UI barely had to change.
*/

const PREF_KEY = 'vecini.prefs.v1';
const ACTIVE_COMMUNITY_KEY = 'vecini.activeCommunity.v1';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/*
  The only reaction the app offers. It is a value rather than a choice on
  purpose: one tap, nothing to pick from, nothing to learn. The database column
  it goes into is free text, so a second kind can be added here later without
  another migration to talk somebody through running against production.
*/
export const HEART = '❤️';

/*
  The four columns that turn an announcement into something happening.

  Written as one piece because they only make sense together: the database
  refuses an end without a beginning, so clearing the date has to clear the rest
  in the same statement rather than leaving an orphan behind.
*/
const dateFields = ({ startsAt, endsAt, allDay, location }) => (
  startsAt
    ? {
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      all_day: !!allDay,
      location: location || '',
    }
    : { starts_at: null, ends_at: null, all_day: false, location: '' }
);

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
  funds: [],
  notifications: [],
  notifPrefs: { announcements: true, replies: true, issues: true, polls: true, events: true, funds: true, push: false },
  deletedAccounts: 0,
  // What this person has put away, per kind. Nobody else's list is affected.
  archived: { announcement: [], discussion: [], issue: [] },
  // Your own number and whether you let neighbours see it.
  myContact: { phone: '', visible: false },
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
  /*
    Anything with a number in front of it goes through these rather than
    `${n} ${t(key)}`, which cannot get Romanian right: one form for 1, another
    for 2 to 19, and a third from 20 up. `plural` gives the word alone, for the
    places that lay the number out themselves.
  */
  const counted = useCallback((key, n) => countedIn(lang, key, n), [lang]);
  const plural = useCallback((key, n) => pluralForm(lang, key, n), [lang]);
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

  /*
    What kind of link brought us here, taken from the URL rather than from the
    PASSWORD_RECOVERY event. The client can announce that event while it starts
    up, which is before this component has mounted and subscribed, so the event
    alone was never something to rely on. The URL is still there either way.
  */
  const handledCallback = useRef(false);
  useEffect(() => {
    if (handledCallback.current || !session) return;
    if (callbackType === 'recovery') { handledCallback.current = true; setRecoveryMode(true); }
    if (callbackType === 'email_change') { handledCallback.current = true; showToast(t('email_changed')); }
  }, [session, showToast, t]);

  /*
    A link the auth service turned away: expired, already used, or opened in a
    browser that never asked for it. Saying nothing drops the person on the
    landing page wondering why the button did nothing.
  */
  const announcedLinkError = useRef(false);
  useEffect(() => {
    if (announcedLinkError.current || !callbackError) return;
    announcedLinkError.current = true;
    showToast(t('auth_link_bad'));
  }, [showToast, t]);

  /*
    The address can also change under a session that is already open — the other
    confirmation link being opened elsewhere, or a token refresh catching up.
    Nothing marks the occasion otherwise: the address in Settings just quietly
    reads differently.
  */
  const lastEmail = useRef(null);
  useEffect(() => {
    const email = session?.user?.email || null;
    if (email && lastEmail.current && email !== lastEmail.current) showToast(t('email_changed'));
    lastEmail.current = email;
  }, [session?.user?.email, showToast, t]);

  // Set while a change has been asked for but not yet confirmed from the inbox.
  const pendingEmail = session?.user?.new_email || null;

  /*
    While a change is waiting on an inbox, look for it every time the app comes
    back to the foreground. Coming back is exactly what someone does after
    tapping the link: the browser opened, they confirmed there, and they
    returned to the app expecting it to know.
  */
  useEffect(() => {
    if (!pendingEmail) return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.auth.refreshSession().then(({ data: res }) => {
        if (res?.session && mounted.current) setSession(res.session);
      }).catch(() => { /* offline, or the session is simply not ready yet */ });
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [pendingEmail]);

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

      const [{ data: announcements }, { data: discussions }, { data: issues }, { data: polls }, { data: notifications }, { data: notifPrefsRow }, { data: archivedRows }, { data: phoneRows }, { data: reactionRows }, { data: fundRows }, { data: fundTotals }, { data: paymentRows }, { data: quotaRows }] = await Promise.all([
        supabase.from('announcements').select('*').eq('community_id', cid).order('created_at', { ascending: false }),
        supabase.from('discussions').select('*').eq('community_id', cid).neq('status', 'hidden').order('created_at', { ascending: false }),
        supabase.from('issues').select('*').eq('community_id', cid).order('created_at', { ascending: false }),
        supabase.from('polls').select('*').eq('community_id', cid).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('community_id', cid).eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('archived_items').select('kind,item_id').eq('user_id', userId),
        // Row-level security does the filtering: this comes back with your own
        // row, plus the neighbours who chose to be reachable. Nothing else.
        supabase.from('member_phones').select('user_id,phone,visible'),
        /*
          Hearts on comments — unfiltered, for the same reason: the policy on
          the table only ever returns rows attached to a comment in a community
          you belong to, so there is nothing left here to narrow. Naming the
          comment ids instead would mean building an `in` list out of every
          comment on every issue and every reply in every discussion, and doing
          it after those have loaded, which turns one parallel request into a
          second round trip for something this small.
        */
        supabase.from('reactions').select('issue_comment_id,reply_id,user_id,emoji'),
        /*
          The collections, and what they add up to.

          The totals come from a function rather than from the rows, because
          the rows are deliberately unreadable: a neighbour may know that
          twelve of twenty homes have paid and must not know which twelve, so
          row-level security hides the payments and makes the sum impossible
          to compute here. fund_summary does the arithmetic behind that wall.

          The payment and quota reads are unfiltered for the usual reason: the
          policy already answers with your own rows, or with all of them if
          you are the one keeping the record.
        */
        supabase.from('funds').select('*').eq('community_id', cid).order('created_at', { ascending: false }),
        supabase.rpc('fund_summary', { p_community: cid }),
        supabase.from('fund_payments').select('*').order('paid_on', { ascending: false }),
        supabase.from('fund_quotas').select('*'),
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

      /*
        Profiles are fetched for everyone who shows up on a screen, not only for
        the people who are members right now. Someone who left, or gave up their
        account, still wrote announcements, reported issues and replied to
        things, and all of that is part of the community's history. Looking up
        members alone left every one of those bylines reading "—".
      */
      const needed = new Set(memberIds);
      const note = (id) => { if (id) needed.add(id); };
      (announcements || []).forEach((a) => note(a.author_id));
      discussionsFull.forEach((d) => { note(d.author_id); d.replies.forEach((r) => note(r.author_id)); });
      issuesFull.forEach((i) => {
        note(i.reporter_id);
        i.supporters.forEach(note);
        i.history.forEach((h) => note(h.by_id));
        i.comments.forEach((c) => note(c.author_id));
      });
      pollsFull.forEach((p) => { note(p.author_id); Object.keys(p.voters).forEach(note); });

      const peopleIds = [...needed];
      const { data: profilesRows } = peopleIds.length
        ? await supabase.from('profiles').select('*').in('id', peopleIds)
        : { data: [] };
      const phones = {};
      (phoneRows || []).forEach((r) => { phones[r.user_id] = { phone: r.phone || '', visible: !!r.visible }; });

      const users = {};
      (profilesRows || []).forEach((p) => {
        users[p.id] = {
          id: p.id, name: p.full_name, apartment: p.apartment, color: p.avatar_color,
          /*
            Present only when its owner turned it on. Your own row comes back
            either way, because you may always read your own — so filtering on
            `visible` here is what keeps a number you have saved but not shared
            from appearing on the list under your own name.
          */
          phone: phones[p.id]?.visible ? (phones[p.id].phone || '') : '',
          // The name on an emptied profile is a schema default, not something
          // to show; screens read this and say so in the reader's language.
          deleted: !!p.deleted_at,
        };
      });

      const archived = { announcement: [], discussion: [], issue: [] };
      (archivedRows || []).forEach((r) => { if (archived[r.kind]) archived[r.kind].push(r.item_id); });

      // How many people have given up their account here. A count and nothing
      // else: the rows behind it carry no trace of who they were.
      const { count: deletedAccounts } = await supabase
        .from('deleted_accounts')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', cid);

      /*
        Who hearted what, as two lookups built in one pass.

        Kept as a list of user ids per comment, the same shape as an issue's
        supporters, because the two questions a screen asks are "how many" and
        "am I one of them" — both of which a list of ids answers without a
        second query. The emoji check is not dead weight: the column exists so
        a second kind of reaction can be added without another migration, and
        on the day that happens a heart count that silently included them would
        be wrong rather than merely incomplete.
      */
      const heartsBy = (column) => {
        const by = new Map();
        (reactionRows || []).forEach((r) => {
          if (r.emoji !== HEART || !r[column]) return;
          const seen = by.get(r[column]);
          if (seen) seen.push(r.user_id);
          else by.set(r[column], [r.user_id]);
        });
        return by;
      };
      const heartsOnComments = heartsBy('issue_comment_id');
      const heartsOnReplies = heartsBy('reply_id');

      /*
        One object per collection, carrying its own totals and whatever slice
        of the payments this person is allowed to see.
      */
      const totalsById = new Map((fundTotals || []).map((r) => [r.fund_id, r]));
      const funds = (fundRows || []).map((f) => {
        const sum = totalsById.get(f.id) || {};
        return {
          id: f.id,
          title: f.title,
          description: f.description || '',
          amountBani: Number(f.amount_bani),
          dueOn: f.due_on ? new Date(f.due_on + 'T12:00:00').getTime() : null,
          closedAt: f.closed_at ? new Date(f.closed_at).getTime() : null,
          createdBy: f.created_by,
          createdAt: new Date(f.created_at).getTime(),
          targetBani: Number(sum.target_bani || 0),
          collectedBani: Number(sum.collected_bani || 0),
          homes: Number(sum.homes || 0),
          homesPaid: Number(sum.homes_paid || 0),
          myDueBani: Number(sum.my_due_bani || 0),
          myPaidBani: Number(sum.my_paid_bani || 0),
          payments: (paymentRows || []).filter((p) => p.fund_id === f.id).map((p) => ({
            id: p.id,
            userId: p.user_id,
            amountBani: Number(p.amount_bani),
            paidOn: new Date(p.paid_on + 'T12:00:00').getTime(),
            note: p.note || '',
            recordedBy: p.recorded_by,
          })),
          quotas: Object.fromEntries((quotaRows || [])
            .filter((q) => q.fund_id === f.id)
            .map((q) => [q.user_id, Number(q.amount_bani)])),
        };
      });

      if (!mounted.current) return;
      setData({
        users,
        members: (members || []).map((m) => ({ userId: m.user_id, role: m.role, joinedAt: new Date(m.joined_at).getTime() })),
        community: { id: community.id, name: community.name, address: community.address, description: community.description, code: community.code, joinMode: community.join_mode, kind: community.kind || 'bloc', memberCount: (members || []).length, staircases: 1 },
        /*
          One list. An announcement carrying a date is what used to be an event,
          and the calendar reads this same array rather than a table of its own —
          which is the point: there is nothing to keep in step.
        */
        announcements: (announcements || []).map((a) => ({
          ...a,
          authorId: a.author_id,
          createdAt: new Date(a.created_at).getTime(),
          pinnedUntil: a.pinned_until ? new Date(a.pinned_until).getTime() : null,
          startsAt: a.starts_at ? new Date(a.starts_at).getTime() : null,
          endsAt: a.ends_at ? new Date(a.ends_at).getTime() : null,
          allDay: !!a.all_day,
          location: a.location || '',
        })),
        discussions: discussionsFull.map((d) => ({ ...d, authorId: d.author_id, createdAt: new Date(d.created_at).getTime(), replies: d.replies.map((r) => ({ ...r, authorId: r.author_id, createdAt: new Date(r.created_at).getTime(), editedAt: r.edited_at ? new Date(r.edited_at).getTime() : null, reactions: heartsOnReplies.get(r.id) || [] })) })),
        issues: issuesFull.map((i) => ({ ...i, reporterId: i.reporter_id, photo: i.photo_url, createdAt: new Date(i.created_at).getTime(), history: i.history.map((h) => ({ ...h, byId: h.by_id, at: new Date(h.at).getTime() })), comments: i.comments.map((c) => ({ ...c, authorId: c.author_id, createdAt: new Date(c.created_at).getTime(), editedAt: c.edited_at ? new Date(c.edited_at).getTime() : null, reactions: heartsOnComments.get(c.id) || [] })) })),
        polls: pollsFull.map((p) => ({ ...p, authorId: p.author_id, createdAt: new Date(p.created_at).getTime(), endsAt: new Date(p.ends_at).getTime() })),
        funds,
        notifications: (notifications || []).map((n) => ({ ...n, createdAt: new Date(n.created_at).getTime() })),
        notifPrefs: notifPrefsRow || { announcements: true, replies: true, issues: true, polls: true, events: true, funds: true, push: false },
        archived,
        myContact: phones[userId] || { phone: '', visible: false },
        deletedAccounts: deletedAccounts || 0,
      });
    } finally {
      if (mounted.current) setDataLoading(false);
    }
  }, [userId, activeCommunityId]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  /*
    Keep the data fresh without a manual reload. Fetching only on mount makes a
    phone app look broken: you leave it open, a neighbour posts something, and
    the list still shows what it showed an hour ago — force-quitting was the
    only way to see anything new. Three triggers, cheapest first:
      - coming back to the foreground, which is how phones are actually used
      - a slow poll while genuinely visible, to bound how stale a left-open
        screen can get
      - a push arriving, which by definition means something changed
  */
  useEffect(() => {
    if (!userId) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refreshAll();
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    const timer = setInterval(refreshIfVisible, 60000);

    let onSwMessage;
    if ('serviceWorker' in navigator) {
      onSwMessage = (event) => {
        if (event.data?.type === 'push-received') refreshAll();
      };
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      clearInterval(timer);
      if (onSwMessage) navigator.serviceWorker.removeEventListener('message', onSwMessage);
    };
  }, [userId, refreshAll]);

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

  const userById = (id) => {
    const u = data.users[id];
    if (!u) return { name: '—', apartment: '', color: '#999' };
    // An emptied profile keeps its row so the history it wrote still hangs
    // together, but the name on it belongs to nobody.
    if (u.deleted) return { ...u, name: t('member_deleted'), apartment: '' };
    return u;
  };

  // ---- auth actions ----
  /*
    Signing up with an address that already has an account does NOT come back as
    an error. Supabase's email enumeration protection answers as if it worked:
    no error, no session, and a user object whose `identities` array is empty.
    Read literally that says "account created, go confirm your email", so we
    were congratulating people and sending them off to wait for a message that
    was never going to arrive.

    The empty identities array is the documented tell. The plain error is still
    handled below, since that is what arrives if that protection is ever turned
    off in the project settings.
  */
  // Screens branch on `err.code`, so they never have to match on an English
  // sentence that the auth service is free to reword.
  const taggedError = (code) => Object.assign(new Error(code), { code });

  const signUpEmail = async (name, email, password) => {
    const { data: res, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) {
      if (error.code === 'user_already_exists' || /already regist|already exists/i.test(error.message || '')) {
        throw taggedError('email_taken');
      }
      throw error;
    }
    if (res?.user && Array.isArray(res.user.identities) && res.user.identities.length === 0) {
      throw taggedError('email_taken');
    }
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

  /*
    Changing the sign-in address. The password is re-checked first for the same
    reason as above, and it matters more here: an address change is how an
    account gets stolen outright. Whoever controls the address can reset the
    password at will, so without this check a borrowed unlocked phone would be
    enough to take the account away from its owner for good.

    Nothing changes on the spot. Supabase emails a confirmation link, and the
    address only moves once it is opened. With Supabase's "secure email change"
    setting on, which is the default, it writes to the old address as well and
    wants both confirmed.
  */
  const changeEmail = async (currentPassword, newEmail) => {
    const email = session?.user?.email;
    if (!email) throw new Error('no_email');
    const next = newEmail.trim();
    if (next.toLowerCase() === email.toLowerCase()) throw taggedError('email_same');

    const { error: checkErr } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (checkErr) throw new Error('wrong_current');

    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: window.location.origin + window.location.pathname },
    );
    if (error) {
      if (error.code === 'email_exists' || /already been registered|already exists/i.test(error.message || '')) {
        throw taggedError('email_taken');
      }
      throw error;
    }
    return next;
  };

  /*
    The number, and whether neighbours may see it, saved together.

    It lives apart from the profile because it answers a different question. A
    name is readable because it appears under everything that person wrote; a
    number is readable only if they chose to be reachable, and only by people
    who actually live near them. Keeping it on the profile meant it inherited
    the profile's rule, which is "anyone signed in, anywhere".
  */
  /*
    Your own name.

    Written to the profile, which is what every byline and the neighbour list
    read, and mirrored into the auth metadata so the two do not drift — that
    copy is only consulted when a profile row is first created, but a stale one
    there would resurface as the old name if the row ever had to be rebuilt.

    setProfile by hand afterwards: the profile has its own loader keyed on the
    user id, so refreshAll alone would leave the name on this screen stale until
    the next reload.
  */
  const setName = async (name) => {
    const v = String(name || '').trim().replace(/\s+/g, ' ');
    if (v.length < 2) throw taggedError('name_too_short');
    const { data: row, error } = await supabase.from('profiles')
      .update({ full_name: v }).eq('id', userId).select('*').single();
    if (error) throw error;
    setProfile(row);
    // Best effort, and deliberately not fatal: the app never reads this copy.
    try { await supabase.auth.updateUser({ data: { full_name: v } }); } catch { /* ignore */ }
    await refreshAll();
  };

  /*
    Which apartment or house is yours, so a neighbour looking for you can tell
    which door to knock on. Unlike the name, empty is a real answer here —
    someone may not want to say, or may not have gotten to it yet — so this
    accepts '' and writes it as the column's own default rather than refusing.
  */
  const setApartment = async (apartment) => {
    const v = String(apartment || '').trim();
    const { data: row, error } = await supabase.from('profiles')
      .update({ apartment: v }).eq('id', userId).select('*').single();
    if (error) throw error;
    setProfile(row);
    await refreshAll();
  };

  const setContact = async ({ phone, visible }) => {
    const { error } = await supabase.from('member_phones').upsert(
      { user_id: userId, phone: phone.trim() || null, visible, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
    await refreshAll();
  };

  /*
    Giving up the account. Everything of consequence happens inside one database
    function, so it either all happens or none of it does: half an erasure is
    the worst outcome available. Signing out afterwards is only tidying up — the
    session it would have used has already been destroyed.
  */
  const deleteAccount = async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    try { await disablePush(); } catch (e) { /* the row is gone already */ }
    await supabase.auth.signOut();
    setActiveCommunityId(null);
  };

  /*
    Pulls a fresh session, so a change confirmed somewhere else turns up here.

    On an iPhone this is the only way it can. A link in an email opens in the
    browser, and the app on the home screen is a separate copy with its own
    storage — nothing about tapping that link reaches it. Apple offers no way
    for a web page to hand off to an installed web app, so the home-screen copy
    has to find out by asking, which it would otherwise only do when its token
    expired, up to an hour later.
  */
  const recheckEmail = async () => {
    const { data: res, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    if (res?.session) setSession(res.session);
    return {
      email: res?.session?.user?.email || null,
      pending: res?.session?.user?.new_email || null,
    };
  };

  const signOut = async () => {
    /*
      Release this device's push subscription first, while we still have a
      session to do it with. Otherwise the person signing out keeps receiving
      pushes on a phone that now belongs to whoever signs in next — and tapping
      one would open the new person's account.
    */
    try {
      await disablePush();
    } catch (e) {
      console.error('push: could not release device on sign-out', e);
    }
    await supabase.auth.signOut();
    setActiveCommunityId(null);
  };

  /*
    Looks up a community from an invitation code, and works while signed out —
    that is the point. Row-level security hides communities from anonymous
    visitors, so this goes through community_by_code, which returns the name and
    nothing else. Lets someone confirm they typed the code right before
    committing to creating an account.
  */
  const findCommunityByCode = async (code) => {
    const clean = (code || '').trim();
    if (!clean) return null;
    const { data: rows, error } = await supabase.rpc('community_by_code', { p_code: clean });
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row?.id ? row : null;
  };

  const joinByCode = async (code) => {
    const found = await findCommunityByCode(code);
    if (!found) throw new Error('bad_code');
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

  /*
    Name of the deployed Edge Function. 'swift-api' is the auto-generated name
    Supabase gave it when it was first deployed from the dashboard, and it is
    what the live project actually has. Override with VITE_PUSH_FUNCTION if it
    is ever redeployed under a clearer name.
  */
  const PUSH_FUNCTION = import.meta.env.VITE_PUSH_FUNCTION || 'swift-api';

  const sendPush = async (userIds, type, title, body, link) => {
    if (!userIds.length) {
      console.info(`push: nobody to notify (type=${type})`);
      return;
    }
    // Log the size of the recipient set too: the function's own reply cannot
    // distinguish "nobody was notified" from "nobody was eligible", and that
    // difference points at completely different causes.
    console.info(`push: notifying ${userIds.length} user(s), type=${type}`);
    try {
      // invoke() reports HTTP failures via `error` rather than throwing, so a
      // missing or broken function was previously invisible — which is exactly
      // how a wrong function name went unnoticed. Always inspect the result.
      const { data, error } = await supabase.functions.invoke(PUSH_FUNCTION, {
        body: { communityId: cid, userIds, type, title, body, link: link || '', lang },
      });
      if (error) console.error(`push: function '${PUSH_FUNCTION}' failed`, error);
      else console.info('push:', data);
    } catch (e) {
      // Still never fatal: the in-app notification is already saved, so a push
      // problem must not fail the action that triggered it.
      console.error('push: unexpected error', e);
    }
  };

  /*
    Notifying is always secondary to the thing that triggered it. If it fails,
    the announcement/issue/poll has already been saved, so surfacing an error
    would tell the user their action failed when it did not. Log and carry on.
  */
  const notifyMembers = async (excludeUserId, type, title, body, link) => {
    const { data: rows, error } = await supabase.rpc('notify_members', {
      cid, exclude_user: excludeUserId || null, ntype: type, ntitle: title, nbody: body, nlink: link || '',
    });
    if (error) {
      console.error('notify_members failed', error);
      return;
    }
    await sendPush(idsFrom(rows), type, title, body, link);
  };
  const insertNotifyUser = async (targetUserId, type, title, body, link) => {
    if (!targetUserId || targetUserId === userId) return [];
    const { data: rows, error } = await supabase.rpc('notify_user', {
      cid, target_user: targetUserId, ntype: type, ntitle: title, nbody: body, nlink: link || '',
    });
    if (error) {
      console.error('notify_user failed', error);
      return [];
    }
    return idsFrom(rows);
  };
  const notifyUser = async (targetUserId, type, title, body, link) => {
    const ids = await insertNotifyUser(targetUserId, type, title, body, link);
    await sendPush(ids, type, title, body, link);
  };
  /*
    Fan-out to a specific set of people, de-duplicated and never to yourself.
    One call per person rather than a dedicated SQL function: the membership,
    comment and supporter lists are all readable here already, so this needs no
    further database migration, and these sets are small by nature.
  */
  const notifyUsers = async (targetIds, type, title, body, link) => {
    const unique = [...new Set((targetIds || []).filter((id) => id && id !== userId))];
    if (!unique.length) return;
    const notified = [];
    for (const id of unique) {
      notified.push(...(await insertNotifyUser(id, type, title, body, link)));
    }
    await sendPush(notified, type, title, body, link);
  };

  const staffIds = () =>
    data.members.filter((m) => m.role === 'admin' || m.role === 'moderator').map((m) => m.userId);

  /*
    Change one comment where it sits, without reloading the community around it.

    'reply' means a reply in a discussion, anything else an issue comment — the
    two live in different arrays but are the same thing to everyone reading
    them, so hearts and edits both come through here rather than each walking
    the tree their own way.
  */
  const patchMessage = (where, id, patch) => setData((d) => {
    const swap = (rows) => rows.map((r) => (r.id === id ? { ...r, ...patch(r) } : r));
    return where === 'reply'
      ? { ...d, discussions: d.discussions.map((x) => ({ ...x, replies: swap(x.replies) })) }
      : { ...d, issues: d.issues.map((x) => ({ ...x, comments: swap(x.comments) })) };
  });

  const actions = useMemo(() => ({
    /*
      Putting something away, and taking it back out. This only ever touches the
      person doing it: an announcement one neighbour has finished with is still
      on everyone else's list, which is the difference between tidying up and
      moderating.

      The local list is updated before the write lands, because a tap that takes
      a round trip to show anything feels broken, and this is meant to be used
      several times in a row.
    */
    setArchived: async (kind, id, archived) => {
      setData((d) => {
        const current = d.archived[kind] || [];
        return {
          ...d,
          archived: {
            ...d.archived,
            [kind]: archived ? [...new Set([...current, id])] : current.filter((x) => x !== id),
          },
        };
      });
      const { error } = archived
        ? await supabase.from('archived_items').upsert(
            { user_id: userId, kind, item_id: id },
            { onConflict: 'user_id,kind,item_id' },
          )
        : await supabase.from('archived_items').delete()
            .eq('user_id', userId).eq('kind', kind).eq('item_id', id);
      // Put the truth back on screen if the write did not take.
      if (error) { await refreshAll(); throw error; }
    },

    /*
      Announcements, with or without a date on them.

      There used to be a second table for the dated ones, and a second form, and
      a second decision for whoever was writing. All that separated them was the
      date, so now that is all that separates them: `startsAt` null is a notice,
      `startsAt` set is a notice about something happening.

      An all-day date is stored at midday rather than midnight. The column holds
      absolute time, and midnight falls onto the previous day for anyone whose
      device sits an hour behind; midday survives a twelve-hour shift either way.
      The composer does that conversion, so what arrives here is already correct.
    */
    addAnnouncement: async ({ title, body, startsAt, endsAt, allDay, location }) => {
      const { data: row, error } = await supabase.from('announcements').insert({
        community_id: cid, author_id: userId, title, body: body || '',
        ...dateFields({ startsAt, endsAt, allDay, location }),
      }).select('*').single();
      if (error) { showToast(t('ann_error')); throw error; }
      // Two switches in Settings, so two kinds of notification. Which one this
      // is follows from the thing itself rather than from where it was written.
      const dated = !!startsAt;
      await notifyMembers(
        userId,
        dated ? 'event' : 'announcement',
        STRINGS[lang][dated ? 'ev_new_notif' : 'ann_new'],
        title,
        '/app/announcements/' + row.id,
      );
      await refreshAll();
      showToast(t('ann_members_notified'));
      return row.id;
    },
    updateAnnouncement: async (id, { title, body, startsAt, endsAt, allDay, location }) => {
      const { error } = await supabase.from('announcements').update({
        title, body: body || '',
        ...dateFields({ startsAt, endsAt, allDay, location }),
      }).eq('id', id);
      if (error) { showToast(t('ann_error')); throw error; }
      await refreshAll();
      showToast(t('ann_saved'));
    },
    /*
      Taking one down.

      Announcements had no deletion until the calendar moved in here, because a
      notice that turned out wrong was answered with another notice. A meeting is
      not like that: meetings get called off, and one left standing on the
      calendar is worse than no calendar at all.
    */
    removeAnnouncement: async (id) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) { showToast(t('ann_error')); throw error; }
      await refreshAll();
      showToast(t('ann_removed'));
    },
    /*
      Priority is a deadline, not a flag. Passing null lets an announcement go
      immediately; passing a date holds it up until then, after which it drops
      on its own with nobody having to remember it.
    */
    setPriority: async (id, until) => {
      const { error } = await supabase.from('announcements')
        .update({ pinned_until: until ? new Date(until).toISOString() : null })
        .eq('id', id);
      if (error) { showToast(t('ann_priority_error')); throw error; }
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
      // Not fatal: the issue itself is saved, and a missing history line must
      // not present itself to the reporter as a failed report. Logged rather
      // than swallowed — silence here hid a policy bug for a long time.
      const { error: histError } = await supabase
        .from('issue_history')
        .insert({ issue_id: row.id, status: 'new', note: STRINGS[lang].iss_submitted, by_id: userId });
      if (histError) console.error('issue_history insert failed', histError);
      // The whole neighbourhood hears about a new report — these are rare
      // enough not to be noisy, and knowing about the burst pipe is the point.
      await notifyMembers(userId, 'issue', STRINGS[lang].notif_iss_new, title, '/app/issues/' + row.id);
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
    /*
      A heart on a comment, or on a reply in a discussion.

      `where` is 'comment' or 'reply' — the two are one table with two nullable
      references, so this is the only place the app has to know which of them
      it is holding.

      The screen changes before the write goes out, unlike toggleSupport next
      door, which reloads the entire community after every press. On a support
      button, pressed once per issue, nobody notices; a heart is tapped in
      passing and often twice, and a round trip before the colour changes reads
      as a button that does not work. If the write fails the reload puts the
      truth back — which is the same recovery archiving uses.

      No notification goes out. A heart is meant to be cheap to give, and a
      phone buzzing for each one makes it expensive for the person receiving
      them; they will see it next time they open the issue.
    */
    toggleReaction: async (where, id) => {
      const column = where === 'reply' ? 'reply_id' : 'issue_comment_id';
      const list = where === 'reply'
        ? data.discussions.flatMap((d) => d.replies)
        : data.issues.flatMap((i) => i.comments);
      const mine = (list.find((x) => x.id === id)?.reactions || []).includes(userId);

      patchMessage(where, id, (r) => ({
        reactions: mine ? (r.reactions || []).filter((u) => u !== userId) : [...(r.reactions || []), userId],
      }));

      const { error } = mine
        ? await supabase.from('reactions').delete()
            .eq(column, id).eq('user_id', userId).eq('emoji', HEART)
        : await supabase.from('reactions').insert({ [column]: id, user_id: userId, emoji: HEART });
      if (error) { await refreshAll(); throw error; }
    },
    /*
      Correcting your own message, within a quarter of an hour of sending it.

      Everything that makes this safe is in the database, in one function:
      whose message it is, how long ago it was, and the fact that only the text
      and the "edited" mark can change. There is no update policy on the comment
      tables at all, so this is not the app being careful — it is the only door
      that exists. See supabase/0015_comment_edits.sql.

      The screen is corrected from what the database hands back rather than from
      what we sent, so the mark beside the time is the real one.
    */
    editMessage: async (where, id, body) => {
      const text = String(body || '').trim();
      if (!text) return;
      const { data: editedAt, error } = await supabase.rpc('edit_comment', {
        p_kind: where === 'reply' ? 'reply' : 'comment', p_id: id, p_body: text,
      });
      if (error) { showToast(t('msg_edit_error')); throw error; }
      patchMessage(where, id, () => ({
        body: text,
        editedAt: editedAt ? new Date(editedAt).getTime() : Date.now(),
      }));
    },
    addIssueComment: async (issueId, body) => {
      await supabase.from('issue_comments').insert({ issue_id: issueId, author_id: userId, body });
      const is = data.issues.find((x) => x.id === issueId);
      if (is) {
        /*
          Notify the people actually following this issue rather than everyone:
          the reporter, anyone who already commented, anyone who pressed
          "support" (that button is how you say "keep me posted"), and staff.
          `data.issues` is still the pre-insert snapshot, so the new comment's
          author is not in this list — and notifyUsers drops you anyway.
        */
        await notifyUsers(
          [is.reporterId, ...is.comments.map((c) => c.authorId), ...(is.supporters || []), ...staffIds()],
          'issue',
          STRINGS[lang].notif_iss_comment,
          is.title,
          '/app/issues/' + issueId,
        );
      }
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

    /*
      Routed through the database rather than written straight to the table, so
      the rules sit in one place: only an admin may do it, only to somebody
      else, and never in a way that leaves the community with nobody in charge.
      Changing your own role is not on offer here — stepping down is
      handOverCommunity, and that one insists on a successor.
    */
    changeRole: async (targetUserId, newRole) => {
      const { error } = await supabase.rpc('set_member_role', {
        p_community: cid, p_user: targetUserId, p_role: newRole,
      });
      if (error) { showToast(t('admin_role_error')); throw error; }
      await refreshAll();
      showToast(t('admin_role_changed'));
    },

    /*
      Promote and step down in one call, which is one transaction: the
      community is never for an instant without an admin, and a failure halfway
      cannot leave it that way either.
    */
    handOverCommunity: async (targetUserId) => {
      const { error } = await supabase.rpc('transfer_admin', {
        p_community: cid, p_user: targetUserId,
      });
      if (error) { showToast(t('admin_role_error')); throw error; }
      await refreshAll();
      showToast(t('admin_handed_over'));
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
      if ('kind' in patch) dbPatch.kind = patch.kind;
      if ('address' in patch) dbPatch.address = patch.address;
      await supabase.from('communities').update(dbPatch).eq('id', cid);
      await refreshAll();
      showToast(t('admin_saved'));
    },
    regenCode: async () => {
      await supabase.from('communities').update({ code: genCode(data.community?.name) }).eq('id', cid);
      await refreshAll();
    },

    /*
      ---------------------------------------------------------------------
      Fonduri — the collections, and the record of who has paid into them.

      A ledger, not a payment processor. Nobody pays through the app; this is
      the notebook the administrator keeps, with the difference that each
      neighbour can see their own line without having to ask for it.

      Everything that writes here is staff-only, enforced by the database
      rather than by these functions: only the person who took the money can
      say it arrived, and a ledger anybody can write to is not worth keeping.
    */
    addFund: async ({ title, description, amountBani, dueOn }) => {
      const { data: row, error } = await supabase.from('funds').insert({
        community_id: cid,
        title,
        description: description || '',
        amount_bani: amountBani,
        due_on: dueOn || null,
        created_by: userId,
      }).select('*').single();
      if (error) { showToast(t('fund_error')); throw error; }
      // Everyone hears about a new collection: being asked for money is not
      // something to find out about by chance three weeks later.
      await notifyMembers(userId, 'fund', STRINGS[lang].notif_fund_new, title, '/app/funds/' + row.id);
      await refreshAll();
      showToast(t('fund_created'));
      return row.id;
    },
    setFundClosed: async (fundId, closed) => {
      const { error } = await supabase.from('funds')
        .update({ closed_at: closed ? new Date().toISOString() : null }).eq('id', fundId);
      if (error) { showToast(t('fund_error')); throw error; }
      await refreshAll();
      showToast(t(closed ? 'fund_closed_done' : 'fund_reopened'));
    },
    removeFund: async (fundId) => {
      const { error } = await supabase.from('funds').delete().eq('id', fundId);
      if (error) { showToast(t('fund_error')); throw error; }
      await refreshAll();
      showToast(t('fund_removed'));
    },
    /*
      One row per payment, never a running total overwritten: "cât a plătit,
      cât mai are" only has an answer if two instalments are two rows.

      The receipt matters as much as the row. Somebody who handed over cash in
      a stairwell has nothing to show for it until the app says the
      administration wrote it down, and that notification is the whole reason
      to trust the ledger at all.
    */
    recordPayment: async (fundId, forUserId, amountBani, paidOn, note) => {
      const { error } = await supabase.from('fund_payments').insert({
        fund_id: fundId,
        user_id: forUserId,
        amount_bani: amountBani,
        paid_on: paidOn || undefined,
        note: note || '',
        recorded_by: userId,
      });
      if (error) { showToast(t('fund_error')); throw error; }
      const fund = data.funds.find((f) => f.id === fundId);
      await notifyUser(
        forUserId, 'fund',
        STRINGS[lang].notif_fund_paid,
        `${fund ? fund.title + ' · ' : ''}${(amountBani / 100).toLocaleString('ro-RO')} lei`,
        '/app/funds/' + fundId,
      );
      await refreshAll();
      showToast(t('fund_payment_saved'));
    },
    removePayment: async (paymentId) => {
      const { error } = await supabase.from('fund_payments').delete().eq('id', paymentId);
      if (error) { showToast(t('fund_error')); throw error; }
      await refreshAll();
      showToast(t('fund_payment_removed'));
    },
    /*
      An exception to the amount everyone else owes. null removes the exception
      rather than storing a zero, because zero means something here — "this
      home owes nothing towards this one" — and the two must not be the same
      row.
    */
    setQuota: async (fundId, forUserId, amountBani) => {
      const { error } = amountBani === null
        ? await supabase.from('fund_quotas').delete().eq('fund_id', fundId).eq('user_id', forUserId)
        : await supabase.from('fund_quotas').upsert(
          { fund_id: fundId, user_id: forUserId, amount_bani: amountBani },
          { onConflict: 'fund_id,user_id' },
        );
      if (error) { showToast(t('fund_error')); throw error; }
      await refreshAll();
      showToast(t('fund_quota_saved'));
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
    data, lang, t, L, setLang, counted, plural,
    currentUser, role, isStaff,
    authed, session, hasCommunity: !!activeCommunityId,
    authLoading: session === undefined, dataLoading, membershipResolved,
    userById, actions, toast, showToast,
    signUpEmail, signInEmail, signInGoogle, sendPasswordReset, signOut,
    setNewPassword, changePassword, changeEmail, pendingEmail, recoveryMode,
    setName, setApartment, setContact, deleteAccount, profile, recheckEmail,
    // Google-only accounts have no password to change; offer "set one" instead.
    hasPasswordLogin: !!session?.user?.identities?.some((i) => i.provider === 'email'),
    joinByCode, createCommunity, findCommunityByCode,
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
