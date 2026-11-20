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
--   0013 — anuntul si evenimentul devin acelasi lucru: un anunt poate avea o data, iar calendarul e felul in care te uiti la cele cu data
--   0014 — inimioara: poti aprecia un comentariu de la o sesizare sau un raspuns dintr-o discutie, o singura data, si o poti retrage
--   0015 — corectarea propriului mesaj in primele 15 minute, cu marcajul "editat" langa ora
--   0016 — fondurile asociatiei: colecte punctuale, cine a platit cat si cat mai are, cu totalul vizibil tuturor si numele doar la administratie
--   0017 — documentele asociatiei: procese-verbale, hotarari, contracte, facturi — intr-un bucket privat, cu link care expira, si cu posibilitatea de a lega un document de o colecta
--   0018 — pozele de la sesizari trec si ele intr-un bucket privat, cu link care expira, la fel ca documentele
--   0019 — corectie: pozele vechi de dinainte de 0018 sunt readuse la calea lor reala, ca sa se mai vada
--   0020 — intrarea in comunitate: doar cu codul de invitatie, codurile nu mai sunt vizibile altora, modul „cu aprobare” chiar functioneaza, profilurile nu mai pot fi citite fara cont
--   0021 — votul devine secret si fata de vecini si fata de administratie; un singur vot in sondajele cu o varianta; dupa termen nu se mai voteaza
--   0022 — moderarea schimba statusul, nu textul; data mesajelor o pune serverul; notificarile se trimit doar prin functii; limite de lungime pentru texte
--   0023 — totalul strans la un fond nu mai scade cand pleaca cineva care a platit; platile doar pe numele membrilor; sume absurde refuzate
--   0024 — apartamentul din profil il vad doar vecinii din aceeasi comunitate, ca si telefonul
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


-- =============================================================
-- 0013_announcement_dates.sql
-- anuntul si evenimentul devin acelasi lucru: un anunt poate avea o data, iar calendarul e felul in care te uiti la cele cu data
-- =============================================================

/*
  One thing to write, not two.

  The calendar arrived as its own table, and that turned out to be a decision
  the administrator had to make on every notice: is "Adunarea generală pe 10"
  an announcement or an event? They will answer it inconsistently — anybody
  would — and then neither the list of announcements nor the calendar is
  complete, and neither can be trusted.

  There is no real difference between the two to argue about. Both are written
  by staff, read by everyone, and go one way. The only thing an event has that
  an announcement does not is a date. So that is what it becomes: a column.
  An announcement with a date is what used to be an event, and the calendar
  stops being a place things are kept and becomes a way of looking at them.

  DESTRUCTIVE: this drops public.events. Every row is copied into
  announcements first, in the same transaction, keeping its own id — so links
  already sitting in somebody's notifications still point at the right thing.

  Safe to run more than once.
*/

-- ---------- when, and where ----------
-- All four are optional and stand or fall together: starts_at is what makes an
-- announcement an event, and the rest only say more about that date.
alter table public.announcements
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz,
  add column if not exists all_day   boolean not null default false,
  add column if not exists location  text not null default '';

comment on column public.announcements.starts_at is
  'When this happens. Null means it is not an event, only a notice. All-day is stored at midday local so a timezone shift cannot move the date.';

-- An end without a beginning is not a shape the app can draw, and an end
-- before its beginning is a typo rather than a state to render.
alter table public.announcements drop constraint if exists announcements_dates_make_sense;
alter table public.announcements add constraint announcements_dates_make_sense
  check (ends_at is null or (starts_at is not null and ends_at >= starts_at));

-- ---------- carry the events over ----------
/*
  Wrapped so the file still parses on a database where the table has already
  gone — a second run, or a fresh install that never had one.

  The id comes across unchanged. A notification sent last week links to
  /app/calendar/<that id>, and the app redirects that to the announcement of
  the same id, so nothing that was already delivered breaks.

  description becomes body: announcements.body is not null, and an event was
  allowed to have none, hence the coalesce.
*/
do $carry$
begin
  if to_regclass('public.events') is not null then
    execute $q$
      insert into public.announcements
        (id, community_id, author_id, title, body, created_at,
         starts_at, ends_at, all_day, location)
      select e.id, e.community_id, e.author_id, e.title, coalesce(e.description, ''),
             e.created_at, e.starts_at, e.ends_at, e.all_day, coalesce(e.location, '')
        from public.events e
      on conflict (id) do nothing
    $q$;

    -- Links already handed out. Anything still in flight is caught by the
    -- redirect in the app; this fixes what is stored.
    execute $q$
      update public.notifications
         set link = replace(link, '/app/calendar/', '/app/announcements/')
       where link like '/app/calendar/%'
    $q$;
  end if;
end
$carry$;

-- The calendar view asks one question — what is dated, in date order — and it
-- asks it of a table that only grows.
create index if not exists announcements_starts_idx
  on public.announcements (community_id, starts_at)
  where starts_at is not null;

/*
  Cancelling.

  Announcements never had a delete policy, because until now nothing could be
  taken back: a notice that turned out wrong was answered with another notice.
  A meeting is different. Meetings get called off, and a cancelled meeting left
  standing on the calendar is worse than no calendar. Events could be deleted;
  folding them in here would have quietly taken that away.
*/
drop policy if exists announcements_delete on public.announcements;
create policy announcements_delete on public.announcements
  for delete using (is_staff(community_id));

drop table if exists public.events;


-- =============================================================
-- 0014_reactions.sql
-- inimioara: poti aprecia un comentariu de la o sesizare sau un raspuns dintr-o discutie, o singura data, si o poti retrage
-- =============================================================

/*
  A heart on somebody's comment.

  The app already had this shape once: issue_supporters is a row saying "this
  person, this issue", pressed once to join and once to leave. A reaction is the
  same row one level down — this person, this comment — so it is modelled the
  same way rather than as a counter on the comment. Counters drift; a set of
  rows cannot disagree with itself about who is in it, and it can answer "did I
  already?" without a second query.

  One table for both kinds of comment, with two nullable references and a check
  that exactly one is filled. The alternative, a (target_type, target_id) pair,
  cannot carry a foreign key at all: nothing would delete the hearts when the
  comment they belong to is deleted, and the orphans would go on being counted
  forever by whatever query forgot to exclude them. Two real references cascade
  on their own.

  emoji is a column, not a constraint, and it is a column even though the app
  only ever writes one heart. Adding a second kind of reaction later is then a
  change to the app rather than another migration somebody has to be talked
  through running against production.
*/

create table if not exists public.reactions (
  id               uuid primary key default gen_random_uuid(),
  issue_comment_id uuid references public.issue_comments(id) on delete cascade,
  reply_id         uuid references public.discussion_replies(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  emoji            text not null default '❤️',
  created_at       timestamptz not null default now(),

  -- Exactly one target. Neither is a row about nothing; both is a row about
  -- two different comments at once.
  constraint reactions_one_target
    check ((issue_comment_id is not null) <> (reply_id is not null)),

  -- Not a list of permitted emoji — see above. Just a bound, so the column
  -- cannot be used to store a paragraph.
  constraint reactions_emoji_short check (char_length(emoji) between 1 and 8)
);

/*
  Pressing the heart twice in a row must not make two hearts.

  The app guards against it too, but a double tap on a slow connection is two
  requests in flight with the same answer to "have I already?", and only the
  database can settle that. Partial, because a nullable column in a unique index
  would let unlimited duplicate rows through — every one of them differs from
  the others in Postgres's eyes as long as one column is null.
*/
create unique index if not exists reactions_one_per_comment
  on public.reactions (issue_comment_id, user_id, emoji)
  where issue_comment_id is not null;

create unique index if not exists reactions_one_per_reply
  on public.reactions (reply_id, user_id, emoji)
  where reply_id is not null;

/*
  Which community a heart belongs to, by way of the comment it is on.

  security definer, so the check is one lookup rather than a policy evaluated
  inside a policy: it resolves the comment to its community and then asks
  is_member, which does the same. It reveals nothing else — the only thing a
  caller can learn is whether a given comment sits in a community they are
  already in.
*/
create or replace function public.can_react(p_comment uuid, p_reply uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when p_comment is not null then exists (
      select 1
        from public.issue_comments c
        join public.issues i on i.id = c.issue_id
       where c.id = p_comment and public.is_member(i.community_id)
    )
    when p_reply is not null then exists (
      select 1
        from public.discussion_replies r
        join public.discussions d on d.id = r.discussion_id
       where r.id = p_reply and public.is_member(d.community_id)
    )
    else false
  end;
$$;

alter table public.reactions enable row level security;

-- Everyone in the community sees every heart: the count is the point, and it
-- is not a count if half of it is hidden.
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions
  for select using (public.can_react(issue_comment_id, reply_id));

-- In your own name only, and only where you can already read the comment.
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions
  for insert with check (user_id = auth.uid() and public.can_react(issue_comment_id, reply_id));

/*
  Taking yours back needs no membership check. Someone who has left the
  community can no longer read the comment, and would otherwise be unable to
  withdraw a heart that is still being counted — which is the one direction
  worth keeping open.
*/
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions
  for delete using (user_id = auth.uid());

-- Deliberately no update policy. Changing which emoji a row holds is a delete
-- and an insert, both of which are already governed above.


-- =============================================================
-- 0015_comment_edits.sql
-- corectarea propriului mesaj in primele 15 minute, cu marcajul "editat" langa ora
-- =============================================================

/*
  Fixing a typo in something you already sent.

  Not an update policy, a function. An `update` policy on the comment tables
  would let the client send any column it liked and then argue about which ones
  the policy happened to constrain: the fifteen-minute window lives in
  created_at, so a client permitted to write created_at can extend its own
  deadline, and one permitted to write edited_at can edit without the mark
  appearing. Both are the sort of hole you find later by accident.

  So the tables stay closed to updates entirely, and this is the only door.
  Body and edited_at are the only columns it touches, which makes them the only
  columns anybody can change — by construction rather than by having remembered
  to forbid the rest.

  Fifteen minutes, matching WhatsApp: long enough to catch the typo you see the
  moment you send it, short enough that a neighbour cannot rewrite what they
  promised after three people have replied to it. And the edit always leaves a
  mark, which is the part that matters in a thread where money and decisions get
  discussed.
*/

alter table public.issue_comments      add column if not exists edited_at timestamptz;
alter table public.discussion_replies  add column if not exists edited_at timestamptz;

comment on column public.issue_comments.edited_at is
  'When the author last corrected it. Null means untouched since it was sent.';
comment on column public.discussion_replies.edited_at is
  'When the author last corrected it. Null means untouched since it was sent.';

/*
  p_kind is 'comment' for an issue comment and 'reply' for one in a discussion.
  One function rather than two because the caller is one button, and the two
  branches are the same statement against a different table.

  security definer because the tables have no update policy at all — that is
  the point. The checks the policy would have made are here instead, in the
  where clause, where the client cannot reach around them: yours, and inside
  the window. No rows updated means one of those was false, and the caller is
  told so rather than being handed a silent success.
*/
create or replace function public.edit_comment(p_kind text, p_id uuid, p_body text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_edited timestamptz;
begin
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'a comment cannot be edited into nothing';
  end if;

  if p_kind = 'comment' then
    update public.issue_comments
       set body = p_body, edited_at = now()
     where id = p_id
       and author_id = auth.uid()
       and created_at > now() - interval '15 minutes'
    returning edited_at into v_edited;
  elsif p_kind = 'reply' then
    update public.discussion_replies
       set body = p_body, edited_at = now()
     where id = p_id
       and author_id = auth.uid()
       and created_at > now() - interval '15 minutes'
    returning edited_at into v_edited;
  else
    raise exception 'unknown kind: %', p_kind;
  end if;

  if v_edited is null then
    raise exception 'not yours to edit, or the fifteen minutes are up';
  end if;
  return v_edited;
end;
$$;

revoke all on function public.edit_comment(text, uuid, text) from public;
grant execute on function public.edit_comment(text, uuid, text) to authenticated;


-- =============================================================
-- 0016_funds.sql
-- fondurile asociatiei: colecte punctuale, cine a platit cat si cat mai are, cu totalul vizibil tuturor si numele doar la administratie
-- =============================================================

/*
  Fonduri — the collections an association runs alongside the monthly bill: a
  roof repair, a new gate, painting the stairwell.

  This is a ledger, not a payment processor. Nobody pays through the app;
  money changes hands the way it already does, and what lives here is the
  record of it — the thing the administrator otherwise keeps in a notebook,
  with the difference that each neighbour can see their own line without
  having to ask.

  Three tables and one function.

  Amounts are integers, in bani. Money in a floating-point column is money
  that eventually does not add up: 0.1 + 0.2 is famously not 0.3, and a total
  that disagrees with the sum of its parts by a leu is a total nobody trusts
  again. numeric() would also do, but bani are what the arithmetic is actually
  in — there is no half a ban.

  There is no target column. The target is the sum of what everyone owes, so
  storing it as well would mean storing the same fact twice and letting the
  two drift apart. The composer shows the multiplication as it is typed.
*/

create table if not exists public.funds (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  -- What one home owes unless it has a quota row of its own, below.
  amount_bani  bigint not null check (amount_bani > 0),
  due_on       date,
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  -- Set when the collection is finished. Closed funds stay readable: the
  -- record of who paid for the roof is worth more a year later than it is now.
  closed_at    timestamptz
);

create index if not exists funds_community_idx on public.funds (community_id, created_at desc);

/*
  The exceptions.

  Most collections are one amount for every home. Some are not: a flat nobody
  lives in, somebody the committee agreed a different figure with. A row here
  replaces the fund's own amount for one person, and the absence of a row is
  the ordinary case — which is why this is a sparse table rather than a column
  filled in twenty times per fund.

  zero is allowed, and is the point: "this home owes nothing towards this one"
  has to be sayable.
*/
create table if not exists public.fund_quotas (
  fund_id     uuid not null references public.funds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount_bani bigint not null check (amount_bani >= 0),
  primary key (fund_id, user_id)
);

/*
  What was actually handed over.

  Several rows per person on purpose: "cine a plătit, cât, cât mai are" only
  has an answer if a payment in instalments is several payments rather than one
  number overwritten twice.

  recorded_by is kept separately from user_id because they are never the same
  person — only staff write here, and whose money it was is not who wrote it
  down.
*/
create table if not exists public.fund_payments (
  id          uuid primary key default gen_random_uuid(),
  fund_id     uuid not null references public.funds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount_bani bigint not null check (amount_bani > 0),
  paid_on     date not null default current_date,
  note        text not null default '',
  recorded_by uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists fund_payments_fund_idx on public.fund_payments (fund_id, user_id);

-- ---------- who may see what ----------

alter table public.funds        enable row level security;
alter table public.fund_quotas  enable row level security;
alter table public.fund_payments enable row level security;

drop policy if exists funds_select on public.funds;
create policy funds_select on public.funds for select using (is_member(community_id));
drop policy if exists funds_insert on public.funds;
create policy funds_insert on public.funds for insert with check (is_staff(community_id) and created_by = auth.uid());
drop policy if exists funds_update on public.funds;
create policy funds_update on public.funds for update using (is_staff(community_id));
drop policy if exists funds_delete on public.funds;
create policy funds_delete on public.funds for delete using (is_staff(community_id));

/*
  Which community a fund belongs to, for the tables that only know its id.
  security definer so this is one lookup rather than a policy inside a policy.
*/
create or replace function public.fund_community(p_fund uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select community_id from public.funds where id = p_fund;
$$;

/*
  Your own line, and nothing else.

  This is the decision that shapes the whole feature: a neighbour sees what
  they owe and what they have paid, plus the totals through the function below
  — never the row that says who else is behind. Publishing a list of debtors to
  the whole building is a thing associations have been penalised for here, and
  it is not needed for the collection to work.

  Staff see everything, because they are the ones keeping the record.
*/
drop policy if exists fund_quotas_select on public.fund_quotas;
create policy fund_quotas_select on public.fund_quotas for select using (
  user_id = auth.uid() or is_staff(public.fund_community(fund_id))
);
drop policy if exists fund_quotas_write on public.fund_quotas;
create policy fund_quotas_write on public.fund_quotas for all using (
  is_staff(public.fund_community(fund_id))
) with check (
  is_staff(public.fund_community(fund_id))
);

drop policy if exists fund_payments_select on public.fund_payments;
create policy fund_payments_select on public.fund_payments for select using (
  user_id = auth.uid() or is_staff(public.fund_community(fund_id))
);
/*
  Only the person who took the money can say it arrived. A resident marking
  themselves paid is not a record, it is a claim — and a ledger anybody can
  write to is not worth keeping.
*/
drop policy if exists fund_payments_write on public.fund_payments;
create policy fund_payments_write on public.fund_payments for all using (
  is_staff(public.fund_community(fund_id))
) with check (
  is_staff(public.fund_community(fund_id)) and recorded_by = auth.uid()
);

/*
  The totals, for people who cannot see the rows they are made of.

  A member is allowed to know that 3.200 of 5.000 lei is in and that twelve of
  twenty homes have paid; they are not allowed to know which twelve. Row-level
  security is the right answer to the second half and makes the first half
  impossible to compute in the browser, so it is computed here instead.

  security definer, and it checks membership itself before answering — the one
  thing it must not do is hand the totals of a community to somebody who is not
  in it.

  paid_in_full counts homes whose payments cover their own quota, not homes
  that have paid something: "12 din 20 au plătit" means twelve are done. A home
  owing nothing counts as done, which is why the comparison is >= and not > 0.
*/
create or replace function public.fund_summary(p_community uuid)
returns table (
  fund_id      uuid,
  target_bani  bigint,
  collected_bani bigint,
  homes        int,
  homes_paid   int,
  my_due_bani  bigint,
  my_paid_bani bigint
) language sql security definer stable set search_path = public as $$
  with allowed as (
    select p_community as cid where public.is_member(p_community)
  ),
  f as (
    select fu.id, fu.amount_bani from public.funds fu, allowed a where fu.community_id = a.cid
  ),
  -- Everyone the collection applies to, with what they owe.
  due as (
    select f.id as fund_id, m.user_id,
           coalesce(q.amount_bani, f.amount_bani) as due_bani
      from f
      join public.memberships m on m.community_id = p_community
      left join public.fund_quotas q on q.fund_id = f.id and q.user_id = m.user_id
  ),
  paid as (
    select p.fund_id, p.user_id, sum(p.amount_bani) as paid_bani
      from public.fund_payments p
      join f on f.id = p.fund_id
     group by p.fund_id, p.user_id
  )
  select
    d.fund_id,
    sum(d.due_bani)::bigint                                        as target_bani,
    coalesce(sum(pd.paid_bani), 0)::bigint                         as collected_bani,
    count(*)::int                                                  as homes,
    count(*) filter (where coalesce(pd.paid_bani, 0) >= d.due_bani)::int as homes_paid,
    max(d.due_bani) filter (where d.user_id = auth.uid())::bigint  as my_due_bani,
    coalesce(max(pd.paid_bani) filter (where d.user_id = auth.uid()), 0)::bigint as my_paid_bani
  from due d
  left join paid pd on pd.fund_id = d.fund_id and pd.user_id = d.user_id
  group by d.fund_id;
$$;

revoke all on function public.fund_summary(uuid) from public;
grant execute on function public.fund_summary(uuid) to authenticated;

/*
  Somewhere to turn the notifications off, and the branch that makes the
  switch real. pref_allows ends in "else true", so a type missing from it
  reaches everybody with no way to decline — which is exactly how the calendar
  slipped through once already.
*/
alter table public.notification_prefs
  add column if not exists funds boolean not null default true;

create or replace function public.pref_allows(prefs public.notification_prefs, ntype text)
returns boolean language sql immutable as $$
  select case ntype
    when 'announcement' then coalesce(prefs.announcements, true)
    when 'reply'        then coalesce(prefs.replies, true)
    when 'issue'        then coalesce(prefs.issues, true)
    when 'poll'         then coalesce(prefs.polls, true)
    when 'event'        then coalesce(prefs.events, true)
    when 'fund'         then coalesce(prefs.funds, true)
    else true
  end;
$$;


-- =============================================================
-- 0017_documents.sql
-- documentele asociatiei: procese-verbale, hotarari, contracte, facturi — intr-un bucket privat, cu link care expira, si cu posibilitatea de a lega un document de o colecta
-- =============================================================

/*
  Documentele asociației: procese-verbale, hotărâri, contracte, facturi.

  The question this answers is the one somebody asks in every association
  every month — "unde e procesul-verbal de la ultima adunare?" — to which the
  answer is currently "at the administrator's, in a folder".

  A document may be attached to a collection, and that is the point of doing
  the two together: "we raised 5.000 lei" is a figure, while "we raised 5.000
  lei and here is the 4.870 lei invoice from the firm that did the roof" is
  evidence. Funds without documents ask for trust. With them, they earn it.

  ---------------------------------------------------------------------------
  A private bucket, unlike the one already here.

  issue-photos is public: anyone holding the URL can fetch the file, and no
  policy is consulted. For a photograph of a broken lift that is tolerable.
  For a contract, an invoice, or minutes with people's names in them it is
  not — a public URL is permanent, guessable enough, and forwardable to anyone
  for ever. So documents get a bucket of their own with public = false, and
  the app reaches files through short-lived signed URLs.

  Which raises the question a private bucket always raises: storage policies
  see the object, not our tables, so they have to work out membership from the
  path. Hence the convention that the first folder of every path is the
  community's id — <community_id>/<uuid>.<ext> — and doc_community below,
  which reads it back without letting a malformed path raise.
*/

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

/*
  The community a stored object belongs to, from the first folder of its path.

  A plain cast would do until the day something lands in the bucket under a
  path that is not a uuid, at which point every policy that touches the bucket
  raises instead of answering false. The regex keeps that from being a
  possibility rather than a thing to remember.
*/
create or replace function public.doc_community(p_name text)
returns uuid language plpgsql immutable as $$
declare
  seg text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if seg ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then return seg::uuid;
  end if;
  return null;
end;
$$;

-- is_member(null) is false, so a path we cannot read is a path nobody reads.
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select using (
  bucket_id = 'documents' and public.is_member(public.doc_community(name))
);
drop policy if exists documents_write on storage.objects;
create policy documents_write on storage.objects for insert with check (
  bucket_id = 'documents' and public.is_staff(public.doc_community(name))
);
drop policy if exists documents_remove on storage.objects;
create policy documents_remove on storage.objects for delete using (
  bucket_id = 'documents' and public.is_staff(public.doc_community(name))
);

/*
  The row beside the file.

  The file alone is a name in a bucket. What makes it findable is this: what
  it is called in Romanian, which kind of paper it is, and which collection it
  belongs to if any.

  kind is free text with no check constraint, on purpose — the app offers a
  fixed list of five, and a sixth should be a change to the app rather than
  another migration somebody has to be talked through running against
  production.
*/
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  kind         text not null default 'other',
  -- The path inside the bucket. Kept rather than a URL: a signed URL expires,
  -- and a public one is exactly what this bucket is not.
  path         text not null,
  mime         text not null default '',
  size_bytes   bigint not null default 0,
  /*
    Which collection it belongs to, if it belongs to one. set null rather than
    cascade: an invoice outlives the collection it was raised for, and is
    usually the thing you want most once the collection is gone.
  */
  fund_id      uuid references public.funds(id) on delete set null,
  uploaded_by  uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists documents_community_idx on public.documents (community_id, created_at desc);
create index if not exists documents_fund_idx on public.documents (fund_id);

alter table public.documents enable row level security;

/*
  Every member reads them; only staff put them there.

  Reading is deliberately not narrowed further. An association owes its
  members sight of its own records, and a document nobody may read is a
  document that might as well be in the folder it came from.
*/
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (is_member(community_id));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert with check (is_staff(community_id) and uploaded_by = auth.uid());

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents
  for update using (is_staff(community_id));

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete using (is_staff(community_id));


-- =============================================================
-- 0018_private_issue_photos.sql
-- pozele de la sesizari trec si ele intr-un bucket privat, cu link care expira, la fel ca documentele
-- =============================================================

/*
  Pozele de la sesizări, într-un bucket privat.

  issue-photos has been public since 0001: whoever holds a photo's URL can
  fetch it, no membership check consulted, for as long as the file exists —
  which is fine for a snapshot of a broken lift and is not fine for a photo
  that happens to catch an apartment number or a person in frame. documents
  (0017) already made this trade the other way; this brings issue-photos in
  line with it.

  Two things change. The bucket turns private, so a photo is reached through
  a signed URL that expires rather than a permanent address. And new uploads
  go under <community_id>/<file> instead of <user_id>/<file>, because a
  storage policy sees only the object, not the issues row it belongs to, and
  has to work out membership from the path alone — the same convention
  documents settled on, so doc_community below is reused rather than
  duplicated under a second name.

  What this migration does not do: move the photos already sitting in the
  bucket under the old <user_id>/<file> shape. Under the new policy nobody
  can read them — doc_community reads a user id as if it were a community id,
  finds no such community, and is_member says no — which is the safe way for
  an old file to fail, not a bug. There were five such files in the one
  project that had any, and they were moved by hand, once, directly against
  that project: a migration meant to be pasted into any environment, including
  a brand new one, is not the place for another project's specific rows.
*/

update storage.buckets set public = false where id = 'issue-photos';

-- photo_url held a permanent public URL; photo_path holds a path inside a
-- bucket that no longer has permanent addresses, same as documents.path.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'issues' and column_name = 'photo_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'issues' and column_name = 'photo_path'
  ) then
    alter table public.issues rename column photo_url to photo_path;
  end if;
end $$;

-- Replaces the 0001 policies, which let any signed-in user read or write any
-- file in the bucket with no membership check at all.
drop policy if exists issue_photos_read on storage.objects;
create policy issue_photos_read on storage.objects for select using (
  bucket_id = 'issue-photos' and public.is_member(public.doc_community(name))
);
drop policy if exists issue_photos_write on storage.objects;
create policy issue_photos_write on storage.objects for insert with check (
  bucket_id = 'issue-photos' and public.is_member(public.doc_community(name))
);


-- =============================================================
-- 0019_legacy_issue_photo_paths.sql
-- corectie: pozele vechi de dinainte de 0018 sunt readuse la calea lor reala, ca sa se mai vada
-- =============================================================

/*
  The five photos that predate 0018, recognized where they actually are.

  0018 moved their storage.objects.name to <community_id>/<file> to match the
  new RLS convention. That was wrong: in this project's storage backend a
  plain UPDATE of the objects row's name does not relocate the underlying
  bytes, so the row said one path while the file only answered to the old
  one — signing succeeded (RLS saw a name it could parse) and the download
  that followed came back 400, because nothing lived at the new name. Found
  within the hour, from the edge logs: a 200 on /object/sign, a 400 on the
  /object/sign GET that followed it with the token.

  The name is reverted here to what actually resolves. What is added is a
  narrow, explicit map from those old names to the community that owns them,
  read by issue_photos_read alongside doc_community's normal parse — so a
  handful of pre-0018 files can still be told apart from a stranger's photo
  without teaching doc_community to trust a bare user id as a community,
  which is the thing the new convention exists to stop.

  A general lesson stays out of this file on purpose: renaming a Supabase
  Storage object's row is not the same as moving the object, and the two
  should not be assumed to travel together again without checking.
*/

-- Reverted from the <community_id>/<file> shape 0018 gave them, which the
-- storage backend never actually followed.
update storage.objects set name = '2ad71f71-92a4-483e-9f6d-e0313f455805/1786524630626.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/2ad71f71-92a4-483e-9f6d-e0313f455805-1786524630626.jpg';
update storage.objects set name = '1f845b5a-ad07-45e6-8bb7-91d75e6fea28/1786557775450.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1f845b5a-ad07-45e6-8bb7-91d75e6fea28-1786557775450.jpg';
update storage.objects set name = 'b0a09539-1974-4d23-b915-94e2f469b539/1786559449849.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/b0a09539-1974-4d23-b915-94e2f469b539-1786559449849.jpg';
update storage.objects set name = '1416c439-d309-4747-a448-8ebedc0288a1/1786681849111.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1786681849111.jpg';
update storage.objects set name = '1416c439-d309-4747-a448-8ebedc0288a1/1788891706699.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1788891706699.jpg';

update public.issues set photo_path = '2ad71f71-92a4-483e-9f6d-e0313f455805/1786524630626.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/2ad71f71-92a4-483e-9f6d-e0313f455805-1786524630626.jpg';
update public.issues set photo_path = '1f845b5a-ad07-45e6-8bb7-91d75e6fea28/1786557775450.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1f845b5a-ad07-45e6-8bb7-91d75e6fea28-1786557775450.jpg';
update public.issues set photo_path = 'b0a09539-1974-4d23-b915-94e2f469b539/1786559449849.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/b0a09539-1974-4d23-b915-94e2f469b539-1786559449849.jpg';
update public.issues set photo_path = '1416c439-d309-4747-a448-8ebedc0288a1/1786681849111.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1786681849111.jpg';
update public.issues set photo_path = '1416c439-d309-4747-a448-8ebedc0288a1/1788891706699.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1788891706699.jpg';

create table if not exists public.legacy_issue_photos (
  name         text primary key,
  community_id uuid not null references public.communities(id) on delete cascade
);

-- Filtered by whether the community actually exists here, rather than a
-- plain values list: this file is meant to be safe to paste into any
-- environment, a fresh one included, and a fresh one has no such community
-- to satisfy the foreign key above.
insert into public.legacy_issue_photos (name, community_id)
select v.name, v.community_id from (values
  ('2ad71f71-92a4-483e-9f6d-e0313f455805/1786524630626.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('1f845b5a-ad07-45e6-8bb7-91d75e6fea28/1786557775450.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('b0a09539-1974-4d23-b915-94e2f469b539/1786559449849.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('1416c439-d309-4747-a448-8ebedc0288a1/1786681849111.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('1416c439-d309-4747-a448-8ebedc0288a1/1788891706699.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid)
) as v(name, community_id)
where exists (select 1 from public.communities c where c.id = v.community_id)
on conflict (name) do update set community_id = excluded.community_id;

alter table public.legacy_issue_photos enable row level security;
-- Readable by anyone signed in: it names no more than a bucket path and a
-- community id, and the policy below is what actually gates the photo.
drop policy if exists legacy_issue_photos_select on public.legacy_issue_photos;
create policy legacy_issue_photos_select on public.legacy_issue_photos for select using (auth.uid() is not null);

drop policy if exists issue_photos_read on storage.objects;
create policy issue_photos_read on storage.objects for select using (
  bucket_id = 'issue-photos' and (
    public.is_member(public.doc_community(name))
    or public.is_member((select l.community_id from public.legacy_issue_photos l where l.name = storage.objects.name))
  )
);


-- =============================================================
-- 0020_entering_a_community.sql
-- intrarea in comunitate: doar cu codul de invitatie, codurile nu mai sunt vizibile altora, modul „cu aprobare” chiar functioneaza, profilurile nu mai pot fi citite fara cont
-- =============================================================

/*
  The front door.

  Everything inside a community has been guarded by "are you a member?" since
  the first migration, and that question is answered correctly. What was never
  guarded is how somebody becomes one. Three things were true at once:

    * any signed-in account could read every community, invitation code and
      all (communities_select: auth.uid() is not null)
    * any signed-in account could write itself a membership row in any
      community, by id, with no code asked for (memberships_insert_self:
      user_id = auth.uid())
    * the first membership row in a community is made its administrator

  So the invitation code — the only key there is — was readable by everyone
  and required of no one. Found by tests-db, scenarios INT-01, INT-02, INT-03
  and INT-08, not by anybody having used it.

  The shape of the fix is the one 0015 already argued for comments: not a
  cleverer policy, a function, and no other door. Becoming a member now
  happens in exactly three places, each of which checks what it should:

    create_community   — makes the community and its founder's membership in
                         one statement, so there is no gap to stand in
    join_community     — takes a code, not an id
    decide_join_request — an administrator letting somebody in

  and the tables themselves accept no membership or community written
  directly by a client.

  Safe to run more than once.
*/

-- ---------- one code, however it is typed ----------
/*
  community_by_code has always ignored case, and the unique constraint never
  did. "TEILOR-15" and "teilor-15" could both exist, and somebody typing the
  first could be shown the second.
*/
create unique index if not exists communities_code_lower_idx
  on public.communities (lower(code));

-- ---------- who may read a community ----------
-- Its members. Somebody holding a code still learns its name, through
-- community_by_code, and nothing more.
drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities
  for select using (public.is_member(id));

-- Created through create_community only: a community inserted on its own is
-- one with no administrator, waiting for whoever writes the first membership.
drop policy if exists communities_insert on public.communities;

-- ---------- who may write a membership ----------
/*
  Nobody, directly.

  Inserting is join_community, create_community and decide_join_request.
  Updating is set_member_role and transfer_admin, which have existed since
  0010 "so the rules live in one place and cannot be reached around" — and
  could be reached around, because the update policy stayed. An administrator
  could rewrite user_id on a row and enrol somebody who never asked.

  Leaving, and an administrator removing someone, are still plain deletes.
*/
drop policy if exists memberships_insert_self on public.memberships;
drop policy if exists memberships_update_admin on public.memberships;

-- ---------- waiting to be let in ----------
/*
  "Cu aprobare" has been on the settings screen since the beginning and has
  never done anything: the mode was saved and nothing read it. This is the
  thing it was promising. A request is a row here rather than a membership
  with a status column, because every policy in the schema asks is_member()
  and none of them should have to learn that some members are not members yet.
*/
create table if not exists public.join_requests (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.join_requests enable row level security;

-- Yours, or — if you are the one deciding — your community's.
drop policy if exists join_requests_select on public.join_requests;
create policy join_requests_select on public.join_requests
  for select using (user_id = auth.uid() or public.is_admin(community_id));

-- Changing your mind is yours to do. Refusing is decide_join_request.
drop policy if exists join_requests_withdraw on public.join_requests;
create policy join_requests_withdraw on public.join_requests
  for delete using (user_id = auth.uid());

-- ---------- founding ----------
create or replace function public.create_community(p_name text, p_address text, p_code text)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.communities;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_name, '') !~ '\S' or coalesce(p_code, '') !~ '\S' then
    raise exception 'name_and_code_required' using errcode = 'check_violation';
  end if;

  -- A code already taken raises unique_violation; the app answers that by
  -- trying another, which is why it is not caught here.
  insert into public.communities (name, address, code)
  values (btrim(p_name), coalesce(p_address, ''), btrim(p_code))
  returning * into c;

  -- First in, so the trigger from 0001 makes this the administrator.
  insert into public.memberships (user_id, community_id) values (auth.uid(), c.id);

  return c;
end;
$$;

-- ---------- joining ----------
/*
  status is 'member' when the caller is inside by the time this returns —
  whether they just walked in or were already there — and 'pending' when the
  community asks for approval and the request is now waiting.

  A community with nobody in it lets the next person straight in whatever its
  mode: there is no one left to approve them.
*/
create or replace function public.join_community(p_code text)
returns table (community_id uuid, name text, status text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c public.communities;
  uid uuid := auth.uid();
  clean text := btrim(coalesce(p_code, ''));
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  select co.* into c from public.communities co where clean <> '' and lower(co.code) = lower(clean);
  if not found then
    raise exception 'bad_code' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.memberships m where m.community_id = c.id and m.user_id = uid) then
    return query select c.id, c.name, 'member'::text;
    return;
  end if;

  if c.join_mode = 'approval'
     and exists (select 1 from public.memberships m where m.community_id = c.id) then
    insert into public.join_requests (community_id, user_id) values (c.id, uid)
    on conflict do nothing;
    return query select c.id, c.name, 'pending'::text;
    return;
  end if;

  insert into public.memberships (user_id, community_id) values (uid, c.id);
  delete from public.join_requests jr where jr.community_id = c.id and jr.user_id = uid;
  return query select c.id, c.name, 'member'::text;
end;
$$;

-- ---------- letting somebody in, or not ----------
create or replace function public.decide_join_request(p_community uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(p_community) then
    raise exception 'not_admin' using errcode = 'insufficient_privilege';
  end if;

  delete from public.join_requests jr where jr.community_id = p_community and jr.user_id = p_user;
  if not found then
    raise exception 'no_request' using errcode = 'no_data_found';
  end if;

  if p_approve then
    insert into public.memberships (user_id, community_id) values (p_user, p_community)
    on conflict (user_id, community_id) do nothing;
  end if;
end;
$$;

-- ---------- what am I waiting on? ----------
-- Somebody waiting cannot read the community they asked to join, so its name
-- comes from here — the same and only thing the code itself already told them.
create or replace function public.my_join_requests()
returns table (community_id uuid, name text, created_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select jr.community_id, c.name, jr.created_at
    from public.join_requests jr
    join public.communities c on c.id = jr.community_id
   where jr.user_id = auth.uid();
$$;

/*
  An account that has been given up is not waiting for anything.

  delete_my_account empties the profile and stamps deleted_at; a request left
  behind could still be approved, and would enrol an account nobody is behind.
  A trigger rather than one more line in that function, so that 0007 stays
  the one place the function is written.
*/
create or replace function public.forget_join_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.join_requests where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_forget_join_requests on public.profiles;
create trigger trg_forget_join_requests
  after update of deleted_at on public.profiles
  for each row when (new.deleted_at is not null and old.deleted_at is null)
  execute procedure public.forget_join_requests();

-- ---------- profiles are for people with an account ----------
/*
  0009 describes a profile as "readable by anyone signed in". The policy said
  `using (true)`, and anon has select on the table, so it was readable by
  anyone holding the public key printed in the page source: every name and
  flat number on the service, no account needed.
*/
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);

-- ---------- and the functions are for them too ----------
/*
  Every function since 0002 ends "revoke all … from public; grant execute …
  to authenticated", which reads as though visitors cannot call it. On
  Supabase they can: anon holds its own grant on every function in this
  schema, made by default privileges, and a revoke from PUBLIC does not touch
  it. None of them did anything for a caller with no id — each checks — so
  this closes a door that led to a wall. It is closed anyway, because the
  comments said it was.

  Left alone: community_by_code, which is for visitors on purpose, and the
  helpers policies call (is_member and its kind), which have to answer "no"
  to a visitor rather than raise.
*/
do $revoke$
declare
  fn text;
begin
  foreach fn in array array[
    'public.notify_members(uuid, uuid, text, text, text, text)',
    'public.notify_user(uuid, uuid, text, text, text, text)',
    'public.claim_push_subscription(text, text, text)',
    'public.release_push_subscription(text)',
    'public.delete_my_account()',
    'public.set_member_role(uuid, uuid, text)',
    'public.transfer_admin(uuid, uuid)',
    'public.edit_comment(text, uuid, text)',
    'public.fund_summary(uuid)',
    'public.create_community(text, text, text)',
    'public.join_community(text)',
    'public.decide_join_request(uuid, uuid, boolean)',
    'public.my_join_requests()'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public, anon', fn);
      execute format('grant execute on function %s to authenticated', fn);
    end if;
  end loop;
end
$revoke$;


-- =============================================================
-- 0021_secret_ballot.sql
-- votul devine secret si fata de vecini si fata de administratie; un singur vot in sondajele cu o varianta; dupa termen nu se mai voteaza
-- =============================================================

/*
  A vote that is secret, single, in time and about the right question.

  "The count is public and the ballot is anonymous" is what the product says
  about its polls, and the screens kept the promise by not showing names. The
  database did not: every vote is a row with the voter's id on it, and the
  select policy handed all of them to any member who asked. Four things in
  this file, all found by tests-db (SON-02, 05, 06, 07, 08):

    * a vote is readable by the person who cast it and by nobody else —
      not the neighbours, not the administrator
    * the counts everybody is entitled to come from a function, since the
      browser can no longer add up rows it is not shown
    * a poll that takes one answer takes one answer
    * the deadline is enforced where the vote is written, instead of relying
      on an administrator remembering to press "close" — which is the third
      constraint in the case study, word for word

  Safe to run more than once.
*/

-- ---------- whose vote it is ----------
drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes
  for select using (user_id = auth.uid());

-- ---------- the count ----------
/*
  How many, never who. Every option is returned, including the ones nobody
  chose, so the caller does not have to tell "zero" from "missing".

  security definer, and it asks is_member itself: totals of a community are
  for that community.
*/
create or replace function public.poll_results(p_community uuid)
returns table (poll_id uuid, option_id uuid, votes int)
language sql
security definer
stable
set search_path = public
as $$
  select o.poll_id, o.id, count(v.user_id)::int
    from public.polls p
    join public.poll_options o on o.poll_id = p.id
    left join public.poll_votes v on v.poll_id = p.id and v.option_id = o.id
   where p.community_id = p_community
     and public.is_member(p_community)
   group by o.poll_id, o.id;
$$;

revoke all on function public.poll_results(uuid) from public, anon;
grant execute on function public.poll_results(uuid) to authenticated;

-- ---------- what a vote has to be ----------
/*
  A trigger rather than a longer policy, for three reasons that each rule
  brings: the option has to be looked up against the poll (the table carries
  both ids and nothing ties them), "one answer" is a fact about other rows,
  and a multi-choice ballot arrives as several rows in one statement, where a
  row-level trigger sees the ones before it and a policy does not.

  The advisory lock is for the double tap: two requests in flight that would
  each find no earlier vote. It is held to the end of the transaction, so the
  second one waits, looks again, and is refused.
*/
create or replace function public.check_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.polls;
begin
  select * into p from public.polls where id = new.poll_id;
  if not found then
    raise exception 'no_such_poll' using errcode = 'foreign_key_violation';
  end if;
  if p.closed or p.ends_at <= now() then
    raise exception 'poll_closed' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.poll_options o where o.id = new.option_id and o.poll_id = new.poll_id) then
    raise exception 'option_not_in_poll' using errcode = 'foreign_key_violation';
  end if;
  if not p.multi then
    perform pg_advisory_xact_lock(hashtextextended(new.poll_id::text || ':' || new.user_id::text, 0));
    if exists (select 1 from public.poll_votes v where v.poll_id = new.poll_id and v.user_id = new.user_id) then
      raise exception 'already_voted' using errcode = 'unique_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_poll_vote on public.poll_votes;
create trigger trg_check_poll_vote
  before insert on public.poll_votes
  for each row execute procedure public.check_poll_vote();


-- =============================================================
-- 0022_what_may_change.sql
-- moderarea schimba statusul, nu textul; data mesajelor o pune serverul; notificarile se trimit doar prin functii; limite de lungime pentru texte
-- =============================================================

/*
  What may be changed, by whom, and when it was written.

  A batch of small rules that were each stated somewhere and enforced nowhere.
  They share a cause: a policy says who may touch a row, and says nothing
  about which part of it. "Staff can update status (moderation)" was written
  as "staff can update", so a moderator could rewrite a neighbour's post; "the
  author may update" let the author undo the moderator. And every table
  trusted the client for the one column the fifteen-minute rule in 0015 hangs
  from.

  All found by tests-db: IZO-28, NOT-03, ROL-05, ROL-06, DAT-02, DAT-03,
  DAT-05, SES-02, MSG-05 to MSG-08, REA-04.

  Safe to run more than once.
*/

-- ===========================================================================
-- Notifications are written by the functions, and only by them.
-- ===========================================================================
/*
  notifications_insert asked that the sender belong to the community named on
  the row, and never asked who the row was for. Anyone could put a line, with
  any text and any link, in the list of anyone on the service — and doing it
  directly skipped the preferences notify_members and notify_user honour.
  The app has only ever used the two functions, so the policy just goes.
*/
drop policy if exists notifications_insert on public.notifications;

-- ===========================================================================
-- Moderation changes the status. It does not change the words.
-- ===========================================================================
/*
  Column privileges rather than a trigger: "only these columns" is exactly
  what a column grant says, it cannot be forgotten by the next policy, and
  the refusal comes from the same place as every other one.

  A discussion: staff may hide it, restore it, or move it to another
  category. Nobody may edit its text, change its author or move it to another
  community — there has never been a screen for any of those, only the gap.
  The author loses the update right altogether, which is what stops a hidden
  discussion being un-hidden by the person it was hidden from.
*/
revoke update on public.discussions from anon, authenticated;
grant update (status, category) on public.discussions to authenticated;

drop policy if exists discussions_update on public.discussions;
create policy discussions_update on public.discussions
  for update using (public.is_staff(community_id)) with check (public.is_staff(community_id));

-- An issue: its status, and nothing else.
revoke update on public.issues from anon, authenticated;
grant update (status) on public.issues to authenticated;

/*
  And where something starts is not the writer's choice either. A report
  opened as "resolved" by the person reporting it, or a discussion that
  arrives pre-hidden, are both states nobody decided.
*/
drop policy if exists issues_insert on public.issues;
create policy issues_insert on public.issues for insert with check (
  public.is_member(community_id) and reporter_id = auth.uid() and status = 'new'
);
drop policy if exists discussions_insert on public.discussions;
create policy discussions_insert on public.discussions for insert with check (
  public.is_member(community_id) and author_id = auth.uid()
  and (status = 'approved' or public.is_staff(community_id))
);

/*
  0003 let the reporter write "the opening entry" of their own issue's
  history, and described it that way. What it permitted was any number of
  entries with the status 'new', at any time, saying anything. The opening
  entry is the one written when there are none.

  "Are there none" is asked through a function because a policy on
  issue_history that itself selects from issue_history is a policy inside
  itself, and PostgreSQL refuses to evaluate it. It answers one bit about an
  issue the caller could already read.
*/
create or replace function public.issue_has_history(p_issue uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.issue_history h where h.issue_id = p_issue);
$$;

drop policy if exists issue_history_insert on public.issue_history;
create policy issue_history_insert on public.issue_history for insert with check (
  by_id = auth.uid()
  and (
    exists (
      select 1 from public.issues i
      where i.id = issue_id and public.is_staff(i.community_id)
    )
    or (
      status = 'new'
      and exists (
        select 1 from public.issues i
        where i.id = issue_id and i.reporter_id = auth.uid()
      )
      and not public.issue_has_history(issue_id)
    )
  )
);

-- ===========================================================================
-- When something was written is not up to the person writing it.
-- ===========================================================================
/*
  0015 closed the comment tables to updates precisely because "a client
  permitted to write created_at can extend its own deadline". It could write
  created_at all along — on the insert. A comment dated ten years ahead is
  inside its fifteen minutes for ten years; one dated 2020 sits above the
  messages it is answering.

  Only for requests arriving through the API. Migrations and the SQL editor
  run as the owner and may still say when something happened, which 0013
  relied on when it carried the events across with their own dates.
*/
create or replace function public.stamp_created_at()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
  end if;
  return new;
end;
$$;

-- The same, for the tables that also carry the mark of a later correction:
-- nothing is born already edited.
create or replace function public.stamp_created_unedited()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
    new.edited_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.stamp_history_at()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.at := now();
  end if;
  return new;
end;
$$;

do $stamps$
declare
  t text;
begin
  foreach t in array array[
    'announcements', 'discussions', 'issues', 'polls', 'poll_votes', 'reactions',
    'funds', 'fund_payments', 'documents'
  ] loop
    execute format('drop trigger if exists trg_stamp_created_at on public.%I', t);
    execute format('create trigger trg_stamp_created_at before insert on public.%I for each row execute procedure public.stamp_created_at()', t);
  end loop;
  foreach t in array array['issue_comments', 'discussion_replies'] loop
    execute format('drop trigger if exists trg_stamp_created_at on public.%I', t);
    execute format('create trigger trg_stamp_created_at before insert on public.%I for each row execute procedure public.stamp_created_unedited()', t);
  end loop;
end
$stamps$;

drop trigger if exists trg_stamp_history_at on public.issue_history;
create trigger trg_stamp_history_at before insert on public.issue_history
  for each row execute procedure public.stamp_history_at();

-- ===========================================================================
-- Correcting a message: still yours, still fifteen minutes, still a member.
-- ===========================================================================
/*
  Two things added to 0015's function. It never asked whether the author was
  still in the community, so somebody removed a minute after posting kept the
  other fourteen. And "cannot be edited into nothing" was tested with
  btrim(), which strips spaces and nothing else: a message of blank lines
  passed.
*/
create or replace function public.edit_comment(p_kind text, p_id uuid, p_body text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_edited timestamptz;
begin
  if coalesce(p_body, '') !~ '\S' then
    raise exception 'a comment cannot be edited into nothing';
  end if;

  if p_kind = 'comment' then
    update public.issue_comments c
       set body = p_body, edited_at = now()
     where c.id = p_id
       and c.author_id = auth.uid()
       and c.created_at > now() - interval '15 minutes'
       and exists (select 1 from public.issues i where i.id = c.issue_id and public.is_member(i.community_id))
    returning c.edited_at into v_edited;
  elsif p_kind = 'reply' then
    update public.discussion_replies r
       set body = p_body, edited_at = now()
     where r.id = p_id
       and r.author_id = auth.uid()
       and r.created_at > now() - interval '15 minutes'
       and exists (select 1 from public.discussions d where d.id = r.discussion_id and public.is_member(d.community_id))
    returning r.edited_at into v_edited;
  else
    raise exception 'unknown kind: %', p_kind;
  end if;

  if v_edited is null then
    raise exception 'not yours to edit, or the fifteen minutes are up';
  end if;
  return v_edited;
end;
$$;

revoke all on function public.edit_comment(text, uuid, text) from public, anon;
grant execute on function public.edit_comment(text, uuid, text) to authenticated;

-- ===========================================================================
-- Taking your heart back after you have left.
-- ===========================================================================
/*
  0014 kept this open on purpose — "the one direction worth keeping open" —
  with a delete policy that asks only whose heart it is. It did not work.
  A delete has to find the row first, finding is governed by the select
  policy, and the select policy asks for membership. The heart stayed,
  counted, with nobody able to remove it. Your own are now always visible to
  you, which is all the delete needed.
*/
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions
  for select using (user_id = auth.uid() or public.can_react(issue_comment_id, reply_id));

-- ===========================================================================
-- Text has to be something, and cannot be anything.
-- ===========================================================================
/*
  Every column here was `not null`, which the empty string satisfies, and
  none had a length. The app loads a community's comments when it opens; one
  two-megabyte comment is everyone's slow start.

  The limits are far above anything the screens are for — the longest
  announcement in production is under a hundred characters — so nobody
  meets them by writing. `not valid` so that rows already there are left
  alone whatever they hold: the rule is for what arrives from now on, and a
  migration that refuses to run because of one old row is worse than the row.
*/
do $limits$
declare
  r record;
begin
  for r in
    select * from (values
      ('announcements',      'announcements_title_text',   $c$ title ~ '\S' and char_length(title) <= 300 $c$),
      ('announcements',      'announcements_body_len',     $c$ char_length(body) <= 20000 and char_length(location) <= 300 $c$),
      ('discussions',        'discussions_title_text',     $c$ title ~ '\S' and char_length(title) <= 300 $c$),
      ('discussions',        'discussions_body_text',      $c$ body ~ '\S' and char_length(body) <= 20000 $c$),
      ('discussion_replies', 'discussion_replies_body_text', $c$ body ~ '\S' and char_length(body) <= 5000 $c$),
      ('issues',             'issues_title_text',          $c$ title ~ '\S' and char_length(title) <= 300 $c$),
      ('issues',             'issues_description_text',    $c$ description ~ '\S' and char_length(description) <= 20000 and char_length(coalesce(location, '')) <= 300 $c$),
      ('issue_comments',     'issue_comments_body_text',   $c$ body ~ '\S' and char_length(body) <= 5000 $c$),
      ('issue_history',      'issue_history_note_len',     $c$ char_length(note) <= 2000 and char_length(status) <= 40 $c$),
      ('polls',              'polls_question_text',        $c$ question ~ '\S' and char_length(question) <= 500 $c$),
      ('poll_options',       'poll_options_label_text',    $c$ label ~ '\S' and char_length(label) <= 200 $c$),
      ('notifications',      'notifications_text_len',     $c$ char_length(title) <= 300 and char_length(body) <= 2000 and char_length(link) <= 500 and char_length(type) <= 40 $c$),
      ('funds',              'funds_text',                 $c$ title ~ '\S' and char_length(title) <= 300 and char_length(description) <= 20000 $c$),
      ('fund_payments',      'fund_payments_note_len',     $c$ char_length(note) <= 1000 $c$),
      ('documents',          'documents_text',             $c$ title ~ '\S' and char_length(title) <= 300 and char_length(path) <= 500 and char_length(kind) <= 40 $c$),
      ('communities',        'communities_text',           $c$ name ~ '\S' and char_length(name) <= 200 and char_length(code) between 1 and 40 and char_length(coalesce(address, '')) <= 300 and char_length(coalesce(description, '')) <= 5000 $c$),
      ('profiles',           'profiles_text_len',          $c$ char_length(full_name) <= 120 and char_length(coalesce(apartment, '')) <= 60 $c$),
      ('member_phones',      'member_phones_len',          $c$ char_length(coalesce(phone, '')) <= 40 $c$)
    ) as v(tbl, name, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.name);
    execute format('alter table public.%I add constraint %I check (%s) not valid', r.tbl, r.name, r.expr);
  end loop;
end
$limits$;


-- =============================================================
-- 0023_fund_totals.sql
-- totalul strans la un fond nu mai scade cand pleaca cineva care a platit; platile doar pe numele membrilor; sume absurde refuzate
-- =============================================================

/*
  A ledger that still adds up after somebody moves out.

  fund_summary counted, as "collected", only the payments of people who were
  members at the moment of asking. When a neighbour who had paid left the
  community — or gave up their account — their money left the total with
  them, while the row recording it sat untouched in the ledger. A collection
  could go from 350 lei to 100 without anyone having been refunded. Found by
  tests-db (FON-07, STE-07), along with four smaller things about the same
  tables (FON-08, FON-10, IZO-37, IZO-38).

  Safe to run more than once.
*/

-- ---------- which community a fund belongs to, for those in it ----------
/*
  This ran as its owner and answered anybody, visitor included: given a
  fund's id, here is its community. The policies that call it only ever need
  the answer for the caller's own communities, so that is all it now gives.
  For everyone else it is null, and is_staff(null) is false, which is what
  those policies want.
*/
create or replace function public.fund_community(p_fund uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select f.community_id from public.funds f
   where f.id = p_fund and public.is_member(f.community_id);
$$;

-- ---------- a payment is recorded for somebody who lives there ----------
/*
  Nothing tied the person on a payment to the fund's community. A payment
  entered against the wrong name showed that person — who might live
  anywhere — a line from another association's ledger, since "your own line"
  is what the select policy promises. The same for a quota.

  Restrictive, and for inserts only: it narrows what the existing policies
  allow rather than replacing them, and it leaves staff free to correct or
  remove the payment of someone who has since left.
*/
create or replace function public.lives_where_fund_is(p_fund uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
      from public.funds f
      join public.memberships m on m.community_id = f.community_id
     where f.id = p_fund and m.user_id = p_user
       -- and the one asking is in that community too, so this cannot be used
       -- to find out where a stranger lives
       and public.is_member(f.community_id)
  );
$$;

drop policy if exists fund_payments_members_only on public.fund_payments;
create policy fund_payments_members_only on public.fund_payments
  as restrictive for insert
  with check (public.lives_where_fund_is(fund_id, user_id));

drop policy if exists fund_quotas_members_only on public.fund_quotas;
create policy fund_quotas_members_only on public.fund_quotas
  as restrictive for insert
  with check (public.lives_where_fund_is(fund_id, user_id));

-- ---------- an amount is an amount ----------
/*
  The totals are a sum cast back to bigint. One fund with an amount near the
  top of the type made that cast fail, and the failure took the totals of
  every fund in the community with it — one typo, and the funds screen is
  empty for everybody. A hundred million lei per home is not a collection
  anyone is running; refusing it keeps the arithmetic far from the edge.
*/
alter table public.funds drop constraint if exists funds_amount_sane;
alter table public.funds add constraint funds_amount_sane
  check (amount_bani <= 10000000000) not valid;
alter table public.fund_quotas drop constraint if exists fund_quotas_amount_sane;
alter table public.fund_quotas add constraint fund_quotas_amount_sane
  check (amount_bani <= 10000000000) not valid;
alter table public.fund_payments drop constraint if exists fund_payments_amount_sane;
alter table public.fund_payments add constraint fund_payments_amount_sane
  check (amount_bani <= 10000000000) not valid;

-- ---------- the totals ----------
/*
  Unchanged in everything but one line: collected_bani is every payment the
  fund has received, whoever made it and wherever they live now.

  What is owed is still worked out from the people who are members today —
  somebody who has left is not being asked for anything — so a collection
  whose payers have moved away can show more collected than is currently
  due. That is the truth of it, and better than money that vanishes.
*/
create or replace function public.fund_summary(p_community uuid)
returns table (
  fund_id      uuid,
  target_bani  bigint,
  collected_bani bigint,
  homes        int,
  homes_paid   int,
  my_due_bani  bigint,
  my_paid_bani bigint
) language sql security definer stable set search_path = public as $$
  with allowed as (
    select p_community as cid where public.is_member(p_community)
  ),
  f as (
    select fu.id, fu.amount_bani from public.funds fu, allowed a where fu.community_id = a.cid
  ),
  due as (
    select f.id as fund_id, m.user_id,
           coalesce(q.amount_bani, f.amount_bani) as due_bani
      from f
      join public.memberships m on m.community_id = p_community
      left join public.fund_quotas q on q.fund_id = f.id and q.user_id = m.user_id
  ),
  paid as (
    select p.fund_id, p.user_id, sum(p.amount_bani) as paid_bani
      from public.fund_payments p
      join f on f.id = p.fund_id
     group by p.fund_id, p.user_id
  ),
  received as (
    select p.fund_id, sum(p.paid_bani) as all_bani from paid p group by p.fund_id
  )
  select
    d.fund_id,
    sum(d.due_bani)::bigint                                        as target_bani,
    coalesce(max(r.all_bani), 0)::bigint                           as collected_bani,
    count(*)::int                                                  as homes,
    count(*) filter (where coalesce(pd.paid_bani, 0) >= d.due_bani)::int as homes_paid,
    max(d.due_bani) filter (where d.user_id = auth.uid())::bigint  as my_due_bani,
    coalesce(max(pd.paid_bani) filter (where d.user_id = auth.uid()), 0)::bigint as my_paid_bani
  from due d
  left join paid pd on pd.fund_id = d.fund_id and pd.user_id = d.user_id
  left join received r on r.fund_id = d.fund_id
  group by d.fund_id;
$$;

revoke all on function public.fund_summary(uuid) from public, anon;
grant execute on function public.fund_summary(uuid) to authenticated;

-- ---------- the map of old photos is for the community it describes ----------
-- 0019 let any signed-in account read it: the paths of the pre-0018 photos,
-- which carry their uploader's id, and whose community they are.
drop policy if exists legacy_issue_photos_select on public.legacy_issue_photos;
create policy legacy_issue_photos_select on public.legacy_issue_photos
  for select using (public.is_member(community_id));


-- =============================================================
-- 0024_apartment_for_neighbours.sql
-- apartamentul din profil il vad doar vecinii din aceeasi comunitate, ca si telefonul
-- =============================================================

/*
  Which door is yours is for the people who live by it.

  A profile is readable by anyone signed in, because a name has to appear
  under everything its owner wrote — including in a community they have since
  left. The flat number came along on the same row and so inherited the same
  rule: anybody with an account, in any community or in none, could read which
  flat every user of the service lives in. Iana's decision (20 Nov 2026): the
  phone number and the flat are for the person's own community, nobody else.
  The phone number already was (0009). This does the same for the flat.

  Not a separate table, as 0009 did for phones: that migration had a column
  to move out of a row whose rule was wrong for it. Here the cheaper and
  stricter tool fits — column privileges. The profile stays readable as it
  was, minus one column; the flat is only ever handed out by apartments_of(),
  which answers for yourself and for people you share a community with.

  A consequence worth knowing: `select *` on profiles is now refused for
  anybody but the owner of the database, because one column is not theirs to
  read. The app names its columns. A column added to profiles later is
  unreadable until it is granted — which is the safe way round.

  Found by tests-db, TEL-07, where it sat among the questions to decide.

  Safe to run more than once.
*/

revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_color, created_at, deleted_at) on public.profiles to authenticated;

/*
  The flat of each person asked about, for those the caller may know it of:
  themselves, and anybody they share a community with. Everybody else is
  simply left out of the answer, rather than answered with null, so the
  caller cannot tell "has no flat" from "is not yours to know".
*/
create or replace function public.apartments_of(p_users uuid[])
returns table (id uuid, apartment text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.apartment
    from public.profiles p
   where p.id = any(p_users)
     and (p.id = auth.uid() or public.shares_community(p.id));
$$;

revoke all on function public.apartments_of(uuid[]) from public, anon;
grant execute on function public.apartments_of(uuid[]) to authenticated;

commit;
