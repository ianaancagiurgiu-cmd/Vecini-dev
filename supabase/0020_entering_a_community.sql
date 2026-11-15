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
begin;

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

commit;
