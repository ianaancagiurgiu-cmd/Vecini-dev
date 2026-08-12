-- Vecini — push notifications + honouring notification preferences.
-- Safe to run more than once.

-- ---------- browser push subscriptions ----------
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- A user may only ever see or touch their own device subscriptions.
drop policy if exists push_subs_select on public.push_subscriptions;
create policy push_subs_select on public.push_subscriptions
  for select using (user_id = auth.uid());
drop policy if exists push_subs_insert on public.push_subscriptions;
create policy push_subs_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
drop policy if exists push_subs_update on public.push_subscriptions;
create policy push_subs_update on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_subs_delete on public.push_subscriptions;
create policy push_subs_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

-- ---------- preference-aware notification fan-out ----------
-- The client cannot do this itself: RLS (correctly) forbids reading anyone
-- else's notification_prefs, so the filtering has to happen server-side.
-- Returns the users actually notified, so the caller knows who to push to.

create or replace function public.pref_allows(prefs public.notification_prefs, ntype text)
returns boolean language sql immutable as $$
  select case ntype
    when 'announcement' then coalesce(prefs.announcements, true)
    when 'reply'        then coalesce(prefs.replies, true)
    when 'issue'        then coalesce(prefs.issues, true)
    when 'poll'         then coalesce(prefs.polls, true)
    else true
  end;
$$;

create or replace function public.notify_members(
  cid uuid,
  exclude_user uuid,
  ntype text,
  ntitle text,
  nbody text,
  nlink text default ''
)
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- security definer bypasses RLS, so re-check the caller belongs here.
  if not public.is_member(cid) then
    raise exception 'not a member of this community';
  end if;

  return query
  with recipients as (
    select m.user_id
    from public.memberships m
    left join public.notification_prefs p on p.user_id = m.user_id
    where m.community_id = cid
      and (exclude_user is null or m.user_id <> exclude_user)
      -- No prefs row yet means "not opted out of anything".
      and (p.user_id is null or public.pref_allows(p, ntype))
  )
  insert into public.notifications (community_id, user_id, type, title, body, link)
  select cid, r.user_id, ntype, ntitle, nbody, coalesce(nlink, '')
  from recipients r
  returning user_id;
end;
$$;

create or replace function public.notify_user(
  cid uuid,
  target_user uuid,
  ntype text,
  ntitle text,
  nbody text,
  nlink text default ''
)
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_member(cid) then
    raise exception 'not a member of this community';
  end if;
  if target_user is null or target_user = auth.uid() then
    return;
  end if;

  return query
  with recipient as (
    select m.user_id
    from public.memberships m
    left join public.notification_prefs p on p.user_id = m.user_id
    where m.community_id = cid
      and m.user_id = target_user
      and (p.user_id is null or public.pref_allows(p, ntype))
  )
  insert into public.notifications (community_id, user_id, type, title, body, link)
  select cid, r.user_id, ntype, ntitle, nbody, coalesce(nlink, '')
  from recipient r
  returning user_id;
end;
$$;

revoke all on function public.notify_members(uuid, uuid, text, text, text, text) from public;
revoke all on function public.notify_user(uuid, uuid, text, text, text, text) from public;
grant execute on function public.notify_members(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.notify_user(uuid, uuid, text, text, text, text) to authenticated;
