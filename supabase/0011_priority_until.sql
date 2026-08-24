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
begin;

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

commit;
