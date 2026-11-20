/*
  Which door is yours is for the people who live by it.

  A profile is readable by anyone signed in, because a name has to appear
  under everything its owner wrote — including in a community they have since
  left. The flat number came along on the same row and so inherited the same
  rule: anybody with an account, in any community or in none, could read which
  flat every user of the service lives in. Iana's decision (20 Nov 2026): the
  phone number and the flat are for the person's own community, nobody else.
  The phone number already was (0009). This does the same for the flat.

  Not a separate table, as 0009 did for phones: that migration had a column
  to move out of a row whose rule was wrong for it. Here the cheaper and
  stricter tool fits — column privileges. The profile stays readable as it
  was, minus one column; the flat is only ever handed out by apartments_of(),
  which answers for yourself and for people you share a community with.

  A consequence worth knowing: `select *` on profiles is now refused for
  anybody but the owner of the database, because one column is not theirs to
  read. The app names its columns. A column added to profiles later is
  unreadable until it is granted — which is the safe way round.

  Found by tests-db, TEL-07, where it sat among the questions to decide.

  Safe to run more than once.
*/
begin;

revoke select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_color, created_at, deleted_at) on public.profiles to authenticated;

/*
  The flat of each person asked about, for those the caller may know it of:
  themselves, and anybody they share a community with. Everybody else is
  simply left out of the answer, rather than answered with null, so the
  caller cannot tell "has no flat" from "is not yours to know".
*/
create or replace function public.apartments_of(p_users uuid[])
returns table (id uuid, apartment text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.apartment
    from public.profiles p
   where p.id = any(p_users)
     and (p.id = auth.uid() or public.shares_community(p.id));
$$;

revoke all on function public.apartments_of(uuid[]) from public, anon;
grant execute on function public.apartments_of(uuid[]) to authenticated;

commit;
