-- Vecini — migrarile ramase, intr-un singur fisier.
-- Se poate rula de mai multe ori fara probleme: daca ai rulat deja o parte,
-- rularea din nou nu strica nimic si nu pierzi date.
--
--   0009 — numarul de telefon se muta intr-un tabel propriu, cu comutator
--          de vizibilitate, ca sa nu mai fie citibil de oricine e logat
--   0010 — predarea comunitatii si al doilea administrator
--   0007 — rulata din nou doar ca stergerea contului sa curete si numarul
--
-- Unde se ruleaza: Supabase -> SQL Editor -> New query -> lipesti tot -> Run.
--
-- Avertismentul Supabase despre "destructive operations" apare din cauza
-- cuvintelor drop/delete/alter din text. Singurul lucru care sterge date
-- este `alter table public.profiles drop column if exists phone`, iar
-- numerele sunt copiate in tabelul nou inainte, la cateva linii mai sus.


-- ============================================================
-- 0009_neighbour_phones.sql
-- ============================================================

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


-- ============================================================
-- 0010_admin_handover.sql
-- ============================================================

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


-- ============================================================
-- 0007_account_deletion.sql (din nou, ca sa curete si numarul)
-- ============================================================

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
