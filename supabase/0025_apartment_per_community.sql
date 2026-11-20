/*
  0025 — the flat belongs to the membership, not to the person.

  One account can be in several associations: someone who owns a flat in one
  block and lives in another, an administrator who looks after two buildings.
  The flat used to be a single field on the profile, so whatever it said was
  shown in every one of them — "ap. 23" from the block on Teilor turning up
  next to the same name in a block where that person lives at no. 4, and
  telling the neighbours there something about another building.

  So the flat moves onto memberships, one per community. Who may read it then
  falls out of the policy that table already has (memberships_select: members
  of that same community), which is exactly the promise 0024 made — only
  neighbours see it — and now holds per community as well: a neighbour in one
  block does not learn where the same person lives in the other.

  Writing goes through set_my_apartment(), and only for your own row: the
  memberships table has had no update policy since 0020, and that stays so —
  opening an update policy for this one column would also open the role.

  Safe to run twice. The move from the profile happens only on the run that
  adds the column; a second run finds the column there and leaves every flat
  as people have since set it.
*/

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'memberships' and column_name = 'apartment'
  ) then
    alter table public.memberships add column apartment text not null default '';

    /*
      Whatever the profile said is the best guess for every community the
      person is in today — it is what each of them was being shown until now.
      They can correct it per community from here on.
    */
    update public.memberships m
       set apartment = btrim(p.apartment)
      from public.profiles p
     where p.id = m.user_id
       and coalesce(btrim(p.apartment), '') <> '';

    /*
      And then it leaves the profile. Not dropped — the old app, still open on
      somebody's phone for a few minutes after the new one is published, reads
      and writes this column and should not fail — but emptied, so there is no
      second copy of anybody's address sitting where nothing shows it and
      nothing keeps it up to date.
    */
    update public.profiles set apartment = null where apartment is not null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_apartment_len') then
    alter table public.memberships
      add constraint memberships_apartment_len check (char_length(apartment) <= 60);
  end if;
end $$;

-- ---------- setting your own ----------
create or replace function public.set_my_apartment(p_community uuid, p_apartment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v text := btrim(coalesce(p_apartment, ''));
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(v) > 60 then
    raise exception 'too_long' using errcode = 'check_violation';
  end if;

  update public.memberships
     set apartment = v
   where community_id = p_community
     and user_id = uid;

  -- Nothing matched: not a member there, or no such community. Either way
  -- there is no row of yours to write to, and saying so beats a silent no-op.
  if not found then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_my_apartment(uuid, text) from public, anon;
grant execute on function public.set_my_apartment(uuid, text) to authenticated;

/*
  apartments_of() from 0024 read the profile, which is now empty. It stays,
  answering from the memberships instead, so an app still running the old
  code shows a flat rather than none: for each person, the flat in a
  community the caller shares with them — the earliest one they joined, when
  there is more than one in common. The new app does not call it.
*/
create or replace function public.apartments_of(p_users uuid[])
returns table (id uuid, apartment text)
language sql
security definer
stable
set search_path = public
as $$
  select distinct on (m.user_id) m.user_id, m.apartment
    from public.memberships m
   where m.user_id = any(p_users)
     and (m.user_id = auth.uid() or public.is_member(m.community_id))
   order by m.user_id, m.joined_at asc;
$$;

revoke all on function public.apartments_of(uuid[]) from public, anon;
grant execute on function public.apartments_of(uuid[]) to authenticated;
