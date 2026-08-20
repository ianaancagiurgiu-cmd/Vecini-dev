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
