-- Vecini — initial schema, storage bucket, and Row Level Security.
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- ---------- profiles (one row per signed-up user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Vecin',
  apartment text default '',
  avatar_color text not null default '#2f6b4f',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    (array['#2f6b4f','#b4532a','#3a6ea8','#b9802a','#2f8c5f','#7a5cc0','#c04f7a'])[1 + floor(random()*7)::int]
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- communities ----------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text default '',
  description text default '',
  code text not null unique,
  join_mode text not null default 'invite' check (join_mode in ('open','invite','approval')),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator','admin')),
  joined_at timestamptz not null default now(),
  unique (user_id, community_id)
);

-- Force the correct role server-side: the first member of a community
-- becomes its admin automatically; everyone after that joins as a plain
-- member (staff can promote them later). A client can never grant itself
-- admin/moderator by simply asking for it.
create or replace function public.enforce_membership_role()
returns trigger as $$
begin
  if exists (select 1 from public.memberships m where m.community_id = new.community_id) then
    new.role := 'member';
  else
    new.role := 'admin';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_enforce_membership_role on public.memberships;
create trigger trg_enforce_membership_role
  before insert on public.memberships
  for each row execute procedure public.enforce_membership_role();

-- ---------- announcements ----------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- discussions ----------
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  title text not null,
  body text not null,
  category text not null default 'general',
  status text not null default 'approved' check (status in ('pending','approved','hidden')),
  created_at timestamptz not null default now()
);

create table if not exists public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- issues ----------
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  reporter_id uuid not null references auth.users(id),
  title text not null,
  category text not null default 'other',
  location text default '',
  description text not null,
  photo_url text,
  status text not null default 'new' check (status in ('new','progress','resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.issue_supporters (
  issue_id uuid not null references public.issues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (issue_id, user_id)
);

create table if not exists public.issue_history (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  status text not null,
  note text not null,
  by_id uuid not null references auth.users(id),
  at timestamptz not null default now()
);

create table if not exists public.issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- polls ----------
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  question text not null,
  multi boolean not null default false,
  closed boolean not null default false,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null
);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link text default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  announcements boolean not null default true,
  replies boolean not null default true,
  issues boolean not null default true,
  polls boolean not null default true,
  push boolean not null default false
);

-- ---------- helper functions for RLS ----------
create or replace function public.is_member(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships m
    where m.community_id = cid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_staff(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships m
    where m.community_id = cid and m.user_id = auth.uid() and m.role in ('admin','moderator')
  );
$$;

create or replace function public.is_admin(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships m
    where m.community_id = cid and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.memberships enable row level security;
alter table public.announcements enable row level security;
alter table public.discussions enable row level security;
alter table public.discussion_replies enable row level security;
alter table public.issues enable row level security;
alter table public.issue_supporters enable row level security;
alter table public.issue_history enable row level security;
alter table public.issue_comments enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid());

-- Communities: any signed-in person can look one up (needed for "join by
-- code") and can create a new one. Only an admin of that community can
-- change its settings.
drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities for select using (auth.uid() is not null);
drop policy if exists communities_insert on public.communities;
create policy communities_insert on public.communities for insert with check (auth.uid() is not null);
drop policy if exists communities_update_admin on public.communities;
create policy communities_update_admin on public.communities for update using (is_admin(id));

-- Memberships: members of a community can see who else is in it. Anyone
-- signed in can insert themselves (role is force-corrected by the trigger
-- above). Admins can change roles or remove members; members can remove
-- only themselves (leave).
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select using (is_member(community_id));
drop policy if exists memberships_insert_self on public.memberships;
create policy memberships_insert_self on public.memberships for insert with check (user_id = auth.uid());
drop policy if exists memberships_update_admin on public.memberships;
create policy memberships_update_admin on public.memberships for update using (is_admin(community_id));
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete using (is_admin(community_id) or user_id = auth.uid());

-- Announcements: members read; staff (admin/moderator) write.
drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select using (is_member(community_id));
drop policy if exists announcements_write on public.announcements;
create policy announcements_write on public.announcements for insert with check (is_staff(community_id) and author_id = auth.uid());
drop policy if exists announcements_update on public.announcements;
create policy announcements_update on public.announcements for update using (is_staff(community_id));

-- Discussions: members read+write; staff can update status (moderation).
drop policy if exists discussions_select on public.discussions;
create policy discussions_select on public.discussions for select using (is_member(community_id));
drop policy if exists discussions_insert on public.discussions;
create policy discussions_insert on public.discussions for insert with check (is_member(community_id) and author_id = auth.uid());
drop policy if exists discussions_update on public.discussions;
create policy discussions_update on public.discussions for update using (is_staff(community_id) or author_id = auth.uid());

drop policy if exists replies_select on public.discussion_replies;
create policy replies_select on public.discussion_replies for select using (
  exists (select 1 from public.discussions d where d.id = discussion_id and is_member(d.community_id))
);
drop policy if exists replies_insert on public.discussion_replies;
create policy replies_insert on public.discussion_replies for insert with check (
  author_id = auth.uid() and exists (select 1 from public.discussions d where d.id = discussion_id and is_member(d.community_id))
);

-- Issues: members read+write; staff update status/history.
drop policy if exists issues_select on public.issues;
create policy issues_select on public.issues for select using (is_member(community_id));
drop policy if exists issues_insert on public.issues;
create policy issues_insert on public.issues for insert with check (is_member(community_id) and reporter_id = auth.uid());
drop policy if exists issues_update on public.issues;
create policy issues_update on public.issues for update using (is_staff(community_id));

drop policy if exists issue_supporters_select on public.issue_supporters;
create policy issue_supporters_select on public.issue_supporters for select using (
  exists (select 1 from public.issues i where i.id = issue_id and is_member(i.community_id))
);
drop policy if exists issue_supporters_write on public.issue_supporters;
create policy issue_supporters_write on public.issue_supporters for insert with check (
  user_id = auth.uid() and exists (select 1 from public.issues i where i.id = issue_id and is_member(i.community_id))
);
drop policy if exists issue_supporters_delete on public.issue_supporters;
create policy issue_supporters_delete on public.issue_supporters for delete using (user_id = auth.uid());

drop policy if exists issue_history_select on public.issue_history;
create policy issue_history_select on public.issue_history for select using (
  exists (select 1 from public.issues i where i.id = issue_id and is_member(i.community_id))
);
drop policy if exists issue_history_insert on public.issue_history;
create policy issue_history_insert on public.issue_history for insert with check (
  by_id = auth.uid() and exists (select 1 from public.issues i where i.id = issue_id and is_staff(i.community_id))
);

drop policy if exists issue_comments_select on public.issue_comments;
create policy issue_comments_select on public.issue_comments for select using (
  exists (select 1 from public.issues i where i.id = issue_id and is_member(i.community_id))
);
drop policy if exists issue_comments_insert on public.issue_comments;
create policy issue_comments_insert on public.issue_comments for insert with check (
  author_id = auth.uid() and exists (select 1 from public.issues i where i.id = issue_id and is_member(i.community_id))
);

-- Polls: members read+vote; staff create/close.
drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select using (is_member(community_id));
drop policy if exists polls_insert on public.polls;
create policy polls_insert on public.polls for insert with check (is_staff(community_id) and author_id = auth.uid());
drop policy if exists polls_update on public.polls;
create policy polls_update on public.polls for update using (is_staff(community_id));

drop policy if exists poll_options_select on public.poll_options;
create policy poll_options_select on public.poll_options for select using (
  exists (select 1 from public.polls p where p.id = poll_id and is_member(p.community_id))
);
drop policy if exists poll_options_insert on public.poll_options;
create policy poll_options_insert on public.poll_options for insert with check (
  exists (select 1 from public.polls p where p.id = poll_id and is_staff(p.community_id))
);

drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes for select using (
  exists (select 1 from public.polls p where p.id = poll_id and is_member(p.community_id))
);
drop policy if exists poll_votes_insert on public.poll_votes;
create policy poll_votes_insert on public.poll_votes for insert with check (
  user_id = auth.uid() and exists (select 1 from public.polls p where p.id = poll_id and is_member(p.community_id) and p.closed = false)
);

-- Notifications & preferences: strictly private to their owner.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (user_id = auth.uid());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert with check (is_member(community_id));

drop policy if exists notification_prefs_all on public.notification_prefs;
create policy notification_prefs_all on public.notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- storage bucket for issue photos ----------
insert into storage.buckets (id, name, public)
values ('issue-photos', 'issue-photos', true)
on conflict (id) do nothing;

drop policy if exists issue_photos_read on storage.objects;
create policy issue_photos_read on storage.objects for select using (bucket_id = 'issue-photos');
drop policy if exists issue_photos_write on storage.objects;
create policy issue_photos_write on storage.objects for insert with check (bucket_id = 'issue-photos' and auth.uid() is not null);
