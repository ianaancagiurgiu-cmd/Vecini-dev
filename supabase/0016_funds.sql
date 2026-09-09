/*
  Fonduri — the collections an association runs alongside the monthly bill: a
  roof repair, a new gate, painting the stairwell.

  This is a ledger, not a payment processor. Nobody pays through the app;
  money changes hands the way it already does, and what lives here is the
  record of it — the thing the administrator otherwise keeps in a notebook,
  with the difference that each neighbour can see their own line without
  having to ask.

  Three tables and one function.

  Amounts are integers, in bani. Money in a floating-point column is money
  that eventually does not add up: 0.1 + 0.2 is famously not 0.3, and a total
  that disagrees with the sum of its parts by a leu is a total nobody trusts
  again. numeric() would also do, but bani are what the arithmetic is actually
  in — there is no half a ban.

  There is no target column. The target is the sum of what everyone owes, so
  storing it as well would mean storing the same fact twice and letting the
  two drift apart. The composer shows the multiplication as it is typed.
*/
begin;

create table if not exists public.funds (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  -- What one home owes unless it has a quota row of its own, below.
  amount_bani  bigint not null check (amount_bani > 0),
  due_on       date,
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  -- Set when the collection is finished. Closed funds stay readable: the
  -- record of who paid for the roof is worth more a year later than it is now.
  closed_at    timestamptz
);

create index if not exists funds_community_idx on public.funds (community_id, created_at desc);

/*
  The exceptions.

  Most collections are one amount for every home. Some are not: a flat nobody
  lives in, somebody the committee agreed a different figure with. A row here
  replaces the fund's own amount for one person, and the absence of a row is
  the ordinary case — which is why this is a sparse table rather than a column
  filled in twenty times per fund.

  zero is allowed, and is the point: "this home owes nothing towards this one"
  has to be sayable.
*/
create table if not exists public.fund_quotas (
  fund_id     uuid not null references public.funds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount_bani bigint not null check (amount_bani >= 0),
  primary key (fund_id, user_id)
);

/*
  What was actually handed over.

  Several rows per person on purpose: "cine a plătit, cât, cât mai are" only
  has an answer if a payment in instalments is several payments rather than one
  number overwritten twice.

  recorded_by is kept separately from user_id because they are never the same
  person — only staff write here, and whose money it was is not who wrote it
  down.
*/
create table if not exists public.fund_payments (
  id          uuid primary key default gen_random_uuid(),
  fund_id     uuid not null references public.funds(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount_bani bigint not null check (amount_bani > 0),
  paid_on     date not null default current_date,
  note        text not null default '',
  recorded_by uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists fund_payments_fund_idx on public.fund_payments (fund_id, user_id);

-- ---------- who may see what ----------

alter table public.funds        enable row level security;
alter table public.fund_quotas  enable row level security;
alter table public.fund_payments enable row level security;

drop policy if exists funds_select on public.funds;
create policy funds_select on public.funds for select using (is_member(community_id));
drop policy if exists funds_insert on public.funds;
create policy funds_insert on public.funds for insert with check (is_staff(community_id) and created_by = auth.uid());
drop policy if exists funds_update on public.funds;
create policy funds_update on public.funds for update using (is_staff(community_id));
drop policy if exists funds_delete on public.funds;
create policy funds_delete on public.funds for delete using (is_staff(community_id));

/*
  Which community a fund belongs to, for the tables that only know its id.
  security definer so this is one lookup rather than a policy inside a policy.
*/
create or replace function public.fund_community(p_fund uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select community_id from public.funds where id = p_fund;
$$;

/*
  Your own line, and nothing else.

  This is the decision that shapes the whole feature: a neighbour sees what
  they owe and what they have paid, plus the totals through the function below
  — never the row that says who else is behind. Publishing a list of debtors to
  the whole building is a thing associations have been penalised for here, and
  it is not needed for the collection to work.

  Staff see everything, because they are the ones keeping the record.
*/
drop policy if exists fund_quotas_select on public.fund_quotas;
create policy fund_quotas_select on public.fund_quotas for select using (
  user_id = auth.uid() or is_staff(public.fund_community(fund_id))
);
drop policy if exists fund_quotas_write on public.fund_quotas;
create policy fund_quotas_write on public.fund_quotas for all using (
  is_staff(public.fund_community(fund_id))
) with check (
  is_staff(public.fund_community(fund_id))
);

drop policy if exists fund_payments_select on public.fund_payments;
create policy fund_payments_select on public.fund_payments for select using (
  user_id = auth.uid() or is_staff(public.fund_community(fund_id))
);
/*
  Only the person who took the money can say it arrived. A resident marking
  themselves paid is not a record, it is a claim — and a ledger anybody can
  write to is not worth keeping.
*/
drop policy if exists fund_payments_write on public.fund_payments;
create policy fund_payments_write on public.fund_payments for all using (
  is_staff(public.fund_community(fund_id))
) with check (
  is_staff(public.fund_community(fund_id)) and recorded_by = auth.uid()
);

/*
  The totals, for people who cannot see the rows they are made of.

  A member is allowed to know that 3.200 of 5.000 lei is in and that twelve of
  twenty homes have paid; they are not allowed to know which twelve. Row-level
  security is the right answer to the second half and makes the first half
  impossible to compute in the browser, so it is computed here instead.

  security definer, and it checks membership itself before answering — the one
  thing it must not do is hand the totals of a community to somebody who is not
  in it.

  paid_in_full counts homes whose payments cover their own quota, not homes
  that have paid something: "12 din 20 au plătit" means twelve are done. A home
  owing nothing counts as done, which is why the comparison is >= and not > 0.
*/
create or replace function public.fund_summary(p_community uuid)
returns table (
  fund_id      uuid,
  target_bani  bigint,
  collected_bani bigint,
  homes        int,
  homes_paid   int,
  my_due_bani  bigint,
  my_paid_bani bigint
) language sql security definer stable set search_path = public as $$
  with allowed as (
    select p_community as cid where public.is_member(p_community)
  ),
  f as (
    select fu.id, fu.amount_bani from public.funds fu, allowed a where fu.community_id = a.cid
  ),
  -- Everyone the collection applies to, with what they owe.
  due as (
    select f.id as fund_id, m.user_id,
           coalesce(q.amount_bani, f.amount_bani) as due_bani
      from f
      join public.memberships m on m.community_id = p_community
      left join public.fund_quotas q on q.fund_id = f.id and q.user_id = m.user_id
  ),
  paid as (
    select p.fund_id, p.user_id, sum(p.amount_bani) as paid_bani
      from public.fund_payments p
      join f on f.id = p.fund_id
     group by p.fund_id, p.user_id
  )
  select
    d.fund_id,
    sum(d.due_bani)::bigint                                        as target_bani,
    coalesce(sum(pd.paid_bani), 0)::bigint                         as collected_bani,
    count(*)::int                                                  as homes,
    count(*) filter (where coalesce(pd.paid_bani, 0) >= d.due_bani)::int as homes_paid,
    max(d.due_bani) filter (where d.user_id = auth.uid())::bigint  as my_due_bani,
    coalesce(max(pd.paid_bani) filter (where d.user_id = auth.uid()), 0)::bigint as my_paid_bani
  from due d
  left join paid pd on pd.fund_id = d.fund_id and pd.user_id = d.user_id
  group by d.fund_id;
$$;

revoke all on function public.fund_summary(uuid) from public;
grant execute on function public.fund_summary(uuid) to authenticated;

/*
  Somewhere to turn the notifications off, and the branch that makes the
  switch real. pref_allows ends in "else true", so a type missing from it
  reaches everybody with no way to decline — which is exactly how the calendar
  slipped through once already.
*/
alter table public.notification_prefs
  add column if not exists funds boolean not null default true;

create or replace function public.pref_allows(prefs public.notification_prefs, ntype text)
returns boolean language sql immutable as $$
  select case ntype
    when 'announcement' then coalesce(prefs.announcements, true)
    when 'reply'        then coalesce(prefs.replies, true)
    when 'issue'        then coalesce(prefs.issues, true)
    when 'poll'         then coalesce(prefs.polls, true)
    when 'event'        then coalesce(prefs.events, true)
    when 'fund'         then coalesce(prefs.funds, true)
    else true
  end;
$$;

commit;
