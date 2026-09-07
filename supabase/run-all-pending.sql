-- Vecini — toate migrarile de dupa lansare, intr-un singur fisier.
--
-- GENERAT. Nu-l edita de mana: modifica fisierul de migrare si ruleaza
--   node scripts/build-pending-sql.mjs
--
-- Se poate rula oricand si de cate ori vrei. Daca o parte e deja aplicata,
-- rularea din nou nu strica nimic si nu pierzi date — fiecare migrare verifica
-- intai ce gaseste. Deci nu trebuie sa stii dinainte ce ai rulat si ce nu.
--
-- Ce contine:
--   0007 — stergerea contului: contul se goleste, nu dispare, ca sa nu ramana gauri in istoricul comunitatii
--   0008 — arhivarea: fiecare isi poate da la o parte anunturi si sesizari, fara sa le ascunda si altora
--   0009 — numarul de telefon se muta intr-un tabel al lui, cu comutator de vizibilitate, ca sa nu mai fie citibil de oricine e logat
--   0010 — predarea comunitatii si al doilea administrator, plus regula care opreste ramanerea fara niciunul
--   0011 — anunturile prioritare capata termen: stau sus pana la o data, apoi coboara singure
--   0012 — calendarul asociatiei: sedinte si termene cu data lor, separat de textul anunturilor
--
-- Unde se ruleaza: Supabase -> SQL Editor -> New query -> lipesti tot -> Run.
--
-- Ce vezi dupa: ruleaza tot sau nu ruleaza nimic. Totul e intr-o singura
-- tranzactie, asa ca daca se opreste la mijloc baza de date ramane exact cum
-- era inainte, nu pe jumatate migrata.
--
-- Supabase te va avertiza despre "destructive operations". Le stergem intr-adevar
-- pe acestea doua, si pe amandoua le mutam intai in altceva:
--   * profiles.phone      — numerele trec in member_phones inainte (0009)
--   * announcements.pinned — ce era fixat primeste o saptamana de prioritate (0011)
-- In rest nu se sterge nimic.
--
-- Dupa ce rulezi, verifica cu supabase/check-pending.sql: iti spune, pe linii,
-- ce a ajuns in baza de date si ce lipseste.

begin;

-- =============================================================
-- 0007_account_deletion.sql
-- stergerea contului: contul se goleste, nu dispare, ca sa nu ramana gauri in istoricul comunitatii
-- =============================================================

-- Vecini — giving up an account, by emptying it rather than removing it.
-- Safe to run more than once.
--
-- Why the account is emptied rather than removed:
--
-- Every announcement, discussion, issue, comment, status change and vote points
-- at auth.users(id), and those foreign keys carry no ON DELETE action on
-- purpose. The database will simply refuse to delete anyone who has ever posted
-- anything, and rightly so: the alternative is a community history full of holes
-- because one person left. So the row survives and the person is taken out of
-- it. What was written stays, attributed to nobody in particular.

-- ---------- marks a profile nobody is behind any more ----------
alter table public.profiles add column if not exists deleted_at timestamptz;

-- ---------- how many accounts were given up, and nothing else ----------
-- Deliberately holds no reference back to the person: a community and a moment,
-- which is all that is needed to count them and all that may safely be kept.
create table if not exists public.deleted_accounts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

create index if not exists deleted_accounts_community_idx
  on public.deleted_accounts (community_id);

alter table public.deleted_accounts enable row level security;

-- Readable by the people running the community, writable by no one: the rows
-- come from the function below, which runs as the owner and so is not subject
-- to these policies.
drop policy if exists deleted_accounts_select on public.deleted_accounts;
create policy deleted_accounts_select on public.deleted_accounts
  for select using (public.is_staff(community_id));

-- ---------- the deletion itself ----------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  heir uuid;
  scrambled text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- Count it once per community, while the memberships are still there.
  insert into public.deleted_accounts (community_id)
  select m.community_id from public.memberships m where m.user_id = uid;

  /*
    A community whose only admin walks out cannot be administered by anyone
    again: there is no one left who can promote a replacement. So before the
    memberships go, hand the keys to the longest-standing member who is left.
    Nobody is stopped from leaving in order to keep a community staffed.
  */
  for cid in
    select m.community_id from public.memberships m
     where m.user_id = uid and m.role = 'admin'
  loop
    if not exists (
      select 1 from public.memberships m
       where m.community_id = cid and m.role = 'admin' and m.user_id <> uid
    ) then
      select m.user_id into heir
        from public.memberships m
       where m.community_id = cid and m.user_id <> uid
       order by m.joined_at asc
       limit 1;

      if heir is not null then
        update public.memberships
           set role = 'admin'
         where community_id = cid and user_id = heir;
      end if;
    end if;
  end loop;

  -- The profile row stays, emptied of the person. Its name is left as the
  -- schema's own default rather than a phrase in one language; the app decides
  -- what to show from deleted_at.
  update public.profiles
     set full_name = 'Vecin',
         apartment = null,
         avatar_color = '#9a9586',
         deleted_at = now()
   where id = uid;

  -- Everything that only describes this person, rather than the community's
  -- shared history, goes.
  delete from public.memberships where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.notification_prefs where user_id = uid;

  if to_regclass('public.push_subscriptions') is not null then
    delete from public.push_subscriptions where user_id = uid;
  end if;

  -- What someone chose to put out of their own sight is theirs alone, and goes
  -- with them. Guarded because this function predates that table.
  if to_regclass('public.archived_items') is not null then
    delete from public.archived_items where user_id = uid;
  end if;

  if to_regclass('public.member_phones') is not null then
    delete from public.member_phones where user_id = uid;
  end if;

  /*
    The address, the phone number and whatever the sign-up form kept live in the
    auth schema, so clearing the profile alone would leave the person's real
    details sitting one table over.

    The address is replaced rather than emptied because the column is unique and
    the login machinery expects one; what replaces it identifies nobody. Columns
    that came and went across GoTrue versions are each checked for first, since
    a migration that fails halfway through is worse than one that clears a
    little less.
  */
  scrambled := 'sters-' || replace(gen_random_uuid()::text, '-', '') || '@invalid.invalid';

  update auth.users
     set email = scrambled,
         raw_user_meta_data = '{}'::jsonb,
         encrypted_password = null
   where id = uid;

  if exists (select 1 from information_schema.columns
              where table_schema = 'auth' and table_name = 'users' and column_name = 'phone') then
    execute 'update auth.users set phone = null, phone_change = null where id = $1' using uid;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'auth' and table_name = 'users' and column_name = 'email_change') then
    execute 'update auth.users set email_change = null where id = $1' using uid;
  end if;

  -- Blocks any further sign-in, including through a link that is still in an
  -- inbox somewhere.
  if exists (select 1 from information_schema.columns
              where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until') then
    execute 'update auth.users set banned_until = ''infinity''::timestamptz where id = $1' using uid;
  end if;

  -- identity_data carries the address and the name the provider gave us, for
  -- Google sign-ins as much as for email ones.
  if to_regclass('auth.identities') is not null then
    delete from auth.identities where user_id = uid;
  end if;

  if to_regclass('auth.sessions') is not null then
    delete from auth.sessions where user_id = uid;
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;


-- =============================================================
-- 0008_archive.sql
-- arhivarea: fiecare isi poate da la o parte anunturi si sesizari, fara sa le ascunda si altora
-- =============================================================

-- Vecini — archiving, one person at a time.
-- Safe to run more than once.
--
-- Archiving here is a private act of tidying, not moderation. A neighbour who
-- has read an announcement and is done with it can put it away, and it leaves
-- their list and nobody else's. Making it shared would hand every member the
-- power to hide an official announcement from the whole community, which is a
-- moderation decision wearing a tidying-up costume.
--
-- item_id deliberately carries no foreign key: it points at one of three
-- different tables, depending on kind. If the thing it refers to is ever
-- deleted, the row is left behind matching nothing, which costs a few bytes and
-- shows up nowhere. A generated identifier is never reused, so it cannot come
-- to refer to something else.

create table if not exists public.archived_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('announcement', 'discussion', 'issue')),
  item_id uuid not null,
  archived_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);

alter table public.archived_items enable row level security;

-- Yours and only yours, to read and to change. The `with check` half is what
-- stops anyone filing something away in someone else's name.
drop policy if exists archived_items_own on public.archived_items;
create policy archived_items_own on public.archived_items
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- =============================================================
-- 0009_neighbour_phones.sql
-- numarul de telefon se muta intr-un tabel al lui, cu comutator de vizibilitate, ca sa nu mai fie citibil de oricine e logat
-- =============================================================

-- Vecini — phone numbers, kept apart from the rest of the profile.
-- Safe to run more than once.
--
-- The number was added to public.profiles, whose select policy is `using
-- (true)`: readable by anyone signed in, anywhere, in any community. That is
-- fine for a name and a flat number, which is what the policy was written for,
-- and wrong for a phone number. Loosening what a profile means was the mistake;
-- the fix is to stop keeping the number there.
--
-- It lives in its own table because it answers to a different question. A name
-- is readable because it appears under everything that person wrote. A phone
-- number is readable only if they chose to be reachable, and only by the people
-- they actually live near.

create table if not exists public.member_phones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  -- Off unless someone says otherwise. Anyone who typed a number before this
  -- existed never agreed to hand it round, so they are carried over hidden.
  visible boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Carry over anything already saved, without publishing it. Wrapped in dynamic
-- SQL because a plain statement naming profiles.phone would fail to parse on a
-- database that never had that column — a fresh install, or this file run twice.
do $carry$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'phone'
  ) then
    execute $q$
      insert into public.member_phones (user_id, phone, visible)
      select id, phone, false
        from public.profiles
       where phone is not null and btrim(phone) <> ''
      on conflict (user_id) do nothing
    $q$;
  end if;
end
$carry$;

alter table public.profiles drop column if exists phone;

-- ---------- do these two people live in the same place? ----------
create or replace function public.shares_community(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.memberships mine
      join public.memberships theirs on theirs.community_id = mine.community_id
     where mine.user_id = auth.uid()
       and theirs.user_id = other
  );
$$;

alter table public.member_phones enable row level security;

-- Your own row, always, to read and to change.
drop policy if exists member_phones_self on public.member_phones;
create policy member_phones_self on public.member_phones
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Someone else's, only if they asked to be reachable and you are a neighbour.
-- Both halves matter: without the first this publishes numbers nobody offered,
-- without the second it publishes them to the whole service.
drop policy if exists member_phones_neighbours on public.member_phones;
create policy member_phones_neighbours on public.member_phones
  for select
  using (visible and public.shares_community(user_id));


-- =============================================================
-- 0010_admin_handover.sql
-- predarea comunitatii si al doilea administrator, plus regula care opreste ramanerea fara niciunul
-- =============================================================

-- Vecini — handing over the community, and more than one admin.
-- Safe to run more than once.
--
-- Until now the only way the admin role ever moved was by the admin giving up
-- their account, which hands the community to the longest-standing member left.
-- That is a safety net, not a plan: a community depended on one person who had
-- no way to share the job or step out of it.
--
-- Two things are added, and one is guarded:
--
--   * an admin can make another member an admin, and both stay admins
--   * an admin can hand the role over and step down to member, in one step
--   * nothing, by any route, may leave a community with members but no admin

-- ---------- a community must never be left with nobody in charge ----------
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid := coalesce(new.community_id, old.community_id);
  admins_left int;
  members_left int;
begin
  -- Only an admin ceasing to be one can cause the problem.
  if old.role <> 'admin' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.role = 'admin' then return new; end if;

  select count(*) filter (where m.role = 'admin'), count(*)
    into admins_left, members_left
    from public.memberships m
   where m.community_id = cid
     and m.id <> old.id;

  /*
    The last admin of an empty-but-for-them community may still leave: there is
    nobody left to be locked out. What is refused is walking away from a
    community that still has members in it.
  */
  if members_left > 0 and admins_left = 0 then
    raise exception 'last_admin' using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_keep_one_admin on public.memberships;
create trigger trg_keep_one_admin
  before update or delete on public.memberships
  for each row execute procedure public.keep_one_admin();

-- ---------- changing somebody else's role ----------
-- Routed through a function rather than a plain update so the rules live in one
-- place and cannot be reached around. Changing your own role is not on offer
-- here; stepping down is what transfer_admin is for, and it takes a successor.
create or replace function public.set_member_role(p_community uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_community) then
    raise exception 'not_admin' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('member', 'moderator', 'admin') then
    raise exception 'bad_role' using errcode = 'check_violation';
  end if;
  if p_user = auth.uid() then
    raise exception 'not_yourself' using errcode = 'check_violation';
  end if;

  update public.memberships
     set role = p_role
   where community_id = p_community and user_id = p_user;

  if not found then
    raise exception 'not_a_member' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ---------- handing the community over ----------
-- The promotion happens before the step-down, and both are in one function, so
-- the community is never for an instant without an admin and a failure halfway
-- through cannot leave it that way either.
create or replace function public.transfer_admin(p_community uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_community) then
    raise exception 'not_admin' using errcode = 'insufficient_privilege';
  end if;
  if p_user = auth.uid() then
    raise exception 'not_yourself' using errcode = 'check_violation';
  end if;

  update public.memberships
     set role = 'admin'
   where community_id = p_community and user_id = p_user;

  if not found then
    raise exception 'not_a_member' using errcode = 'no_data_found';
  end if;

  update public.memberships
     set role = 'member'
   where community_id = p_community and user_id = auth.uid();
end;
$$;

revoke all on function public.set_member_role(uuid, uuid, text) from public;
revoke all on function public.transfer_admin(uuid, uuid) from public;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.transfer_admin(uuid, uuid) to authenticated;


-- =============================================================
-- 0011_priority_until.sql
-- anunturile prioritare capata termen: stau sus pana la o data, apoi coboara singure
-- =============================================================

/*
  Priority announcements that let go on their own.

  A pinned announcement had no end. "Apa caldă se oprește joi" sat at the top of
  the list three weeks after that Thursday, because staying up depended on
  somebody remembering to take it down and nobody does. The point of holding an
  announcement up is to hold it up *while it matters*, and there was no "while".

  So the boolean becomes a date, and being at the top is derived from it rather
  than stored beside it. One column, one truth: an announcement is prioritised
  exactly when pinned_until is still in the future. Nothing to clear, nothing to
  drift out of step.

  DESTRUCTIVE: this drops announcements.pinned. Its meaning is carried over
  first, in the same transaction — anything currently pinned gets a week, which
  staff can then change or clear.
*/

alter table public.announcements
  add column if not exists pinned_until timestamptz;

comment on column public.announcements.pinned_until is
  'Held at the top of the list until this moment. Null, or in the past, means ordinary.';

-- Carry the flag across before it goes. Wrapped so this migration still parses
-- on a database where the column was already dropped by an earlier run.
do $carry$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'announcements' and column_name = 'pinned'
  ) then
    execute $q$
      update public.announcements
         set pinned_until = now() + interval '7 days'
       where pinned and pinned_until is null
    $q$;
  end if;
end
$carry$;

alter table public.announcements drop column if exists pinned;

-- Reading the list sorts by this on every load, in a table that only grows.
create index if not exists announcements_priority_idx
  on public.announcements (community_id, pinned_until desc nulls last, created_at desc);


-- =============================================================
-- 0012_events.sql
-- calendarul asociatiei: sedinte si termene cu data lor, separat de textul anunturilor
-- =============================================================

/*
  The association's calendar.

  Until now the date of a general meeting lived inside the sentence of an
  announcement, which means nothing could sort by it, nothing could say "this is
  tomorrow", and an announcement about a meeting held last month looked exactly
  like one about a meeting next week.

  Staff-only to write, like announcements and polls. A calendar that anybody can
  add to stops being the association's schedule and becomes a noticeboard, and
  then nobody trusts that what is on it is actually happening.

  On all_day: the timestamp is still absolute, so it is stored at midday local
  rather than midnight. A date-only event pinned to midnight lands on the
  previous day for anyone whose device is even an hour behind; from midday it
  survives a twelve-hour shift in either direction and still reads as the right
  day. Everyone in one building shares a timezone, but a neighbour reading this
  from abroad should not see the meeting move.
*/

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id    uuid not null references auth.users(id),
  title        text not null,
  description  text not null default '',
  location     text not null default '',
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  created_at   timestamptz not null default now(),

  -- An event that finishes before it starts is a typo, not a state to render.
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at)
);

comment on column public.events.all_day is
  'No clock time. The timestamp is stored at midday local so a timezone shift cannot move the date.';

alter table public.events enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (is_member(community_id));

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert with check (is_staff(community_id) and author_id = auth.uid());

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update using (is_staff(community_id));

-- Cancelling a meeting has to be possible, and leaving a stale one on the
-- calendar is worse than removing it.
drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete using (is_staff(community_id));

-- Every screen asks the same question: what is coming up in this community.
create index if not exists events_community_starts_idx
  on public.events (community_id, starts_at);

/*
  Somewhere to turn these off.

  pref_allows ends in "else true", so a new notification type would reach
  everyone with no way to decline it. Adding the column without the branch would
  leave a switch on the settings screen that changed nothing, which is worse
  than not offering one.
*/
alter table public.notification_prefs
  add column if not exists events boolean not null default true;

create or replace function public.pref_allows(prefs public.notification_prefs, ntype text)
returns boolean language sql immutable as $$
  select case ntype
    when 'announcement' then coalesce(prefs.announcements, true)
    when 'reply'        then coalesce(prefs.replies, true)
    when 'issue'        then coalesce(prefs.issues, true)
    when 'poll'         then coalesce(prefs.polls, true)
    when 'event'        then coalesce(prefs.events, true)
    else true
  end;
$$;

commit;
