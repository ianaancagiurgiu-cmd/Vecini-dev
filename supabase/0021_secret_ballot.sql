/*
  A vote that is secret, single, in time and about the right question.

  "The count is public and the ballot is anonymous" is what the product says
  about its polls, and the screens kept the promise by not showing names. The
  database did not: every vote is a row with the voter's id on it, and the
  select policy handed all of them to any member who asked. Four things in
  this file, all found by tests-db (SON-02, 05, 06, 07, 08):

    * a vote is readable by the person who cast it and by nobody else —
      not the neighbours, not the administrator
    * the counts everybody is entitled to come from a function, since the
      browser can no longer add up rows it is not shown
    * a poll that takes one answer takes one answer
    * the deadline is enforced where the vote is written, instead of relying
      on an administrator remembering to press "close" — which is the third
      constraint in the case study, word for word

  Safe to run more than once.
*/
begin;

-- ---------- whose vote it is ----------
drop policy if exists poll_votes_select on public.poll_votes;
create policy poll_votes_select on public.poll_votes
  for select using (user_id = auth.uid());

-- ---------- the count ----------
/*
  How many, never who. Every option is returned, including the ones nobody
  chose, so the caller does not have to tell "zero" from "missing".

  security definer, and it asks is_member itself: totals of a community are
  for that community.
*/
create or replace function public.poll_results(p_community uuid)
returns table (poll_id uuid, option_id uuid, votes int)
language sql
security definer
stable
set search_path = public
as $$
  select o.poll_id, o.id, count(v.user_id)::int
    from public.polls p
    join public.poll_options o on o.poll_id = p.id
    left join public.poll_votes v on v.poll_id = p.id and v.option_id = o.id
   where p.community_id = p_community
     and public.is_member(p_community)
   group by o.poll_id, o.id;
$$;

revoke all on function public.poll_results(uuid) from public, anon;
grant execute on function public.poll_results(uuid) to authenticated;

-- ---------- what a vote has to be ----------
/*
  A trigger rather than a longer policy, for three reasons that each rule
  brings: the option has to be looked up against the poll (the table carries
  both ids and nothing ties them), "one answer" is a fact about other rows,
  and a multi-choice ballot arrives as several rows in one statement, where a
  row-level trigger sees the ones before it and a policy does not.

  The advisory lock is for the double tap: two requests in flight that would
  each find no earlier vote. It is held to the end of the transaction, so the
  second one waits, looks again, and is refused.
*/
create or replace function public.check_poll_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.polls;
begin
  select * into p from public.polls where id = new.poll_id;
  if not found then
    raise exception 'no_such_poll' using errcode = 'foreign_key_violation';
  end if;
  if p.closed or p.ends_at <= now() then
    raise exception 'poll_closed' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.poll_options o where o.id = new.option_id and o.poll_id = new.poll_id) then
    raise exception 'option_not_in_poll' using errcode = 'foreign_key_violation';
  end if;
  if not p.multi then
    perform pg_advisory_xact_lock(hashtextextended(new.poll_id::text || ':' || new.user_id::text, 0));
    if exists (select 1 from public.poll_votes v where v.poll_id = new.poll_id and v.user_id = new.user_id) then
      raise exception 'already_voted' using errcode = 'unique_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_poll_vote on public.poll_votes;
create trigger trg_check_poll_vote
  before insert on public.poll_votes
  for each row execute procedure public.check_poll_vote();

commit;
