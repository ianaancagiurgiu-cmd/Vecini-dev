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
