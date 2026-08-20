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
