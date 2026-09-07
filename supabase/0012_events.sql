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
begin;

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
