-- Vecini — giving up an account, and an optional phone number.
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

-- ---------- optional phone number ----------
alter table public.profiles add column if not exists phone text;

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
         phone = null,
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
