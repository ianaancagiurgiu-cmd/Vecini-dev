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
begin;

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

commit;
