/*
  A ledger that still adds up after somebody moves out.

  fund_summary counted, as "collected", only the payments of people who were
  members at the moment of asking. When a neighbour who had paid left the
  community — or gave up their account — their money left the total with
  them, while the row recording it sat untouched in the ledger. A collection
  could go from 350 lei to 100 without anyone having been refunded. Found by
  tests-db (FON-07, STE-07), along with four smaller things about the same
  tables (FON-08, FON-10, IZO-37, IZO-38).

  Safe to run more than once.
*/
begin;

-- ---------- which community a fund belongs to, for those in it ----------
/*
  This ran as its owner and answered anybody, visitor included: given a
  fund's id, here is its community. The policies that call it only ever need
  the answer for the caller's own communities, so that is all it now gives.
  For everyone else it is null, and is_staff(null) is false, which is what
  those policies want.
*/
create or replace function public.fund_community(p_fund uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select f.community_id from public.funds f
   where f.id = p_fund and public.is_member(f.community_id);
$$;

-- ---------- a payment is recorded for somebody who lives there ----------
/*
  Nothing tied the person on a payment to the fund's community. A payment
  entered against the wrong name showed that person — who might live
  anywhere — a line from another association's ledger, since "your own line"
  is what the select policy promises. The same for a quota.

  Restrictive, and for inserts only: it narrows what the existing policies
  allow rather than replacing them, and it leaves staff free to correct or
  remove the payment of someone who has since left.
*/
create or replace function public.lives_where_fund_is(p_fund uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
      from public.funds f
      join public.memberships m on m.community_id = f.community_id
     where f.id = p_fund and m.user_id = p_user
       -- and the one asking is in that community too, so this cannot be used
       -- to find out where a stranger lives
       and public.is_member(f.community_id)
  );
$$;

drop policy if exists fund_payments_members_only on public.fund_payments;
create policy fund_payments_members_only on public.fund_payments
  as restrictive for insert
  with check (public.lives_where_fund_is(fund_id, user_id));

drop policy if exists fund_quotas_members_only on public.fund_quotas;
create policy fund_quotas_members_only on public.fund_quotas
  as restrictive for insert
  with check (public.lives_where_fund_is(fund_id, user_id));

-- ---------- an amount is an amount ----------
/*
  The totals are a sum cast back to bigint. One fund with an amount near the
  top of the type made that cast fail, and the failure took the totals of
  every fund in the community with it — one typo, and the funds screen is
  empty for everybody. A hundred million lei per home is not a collection
  anyone is running; refusing it keeps the arithmetic far from the edge.
*/
alter table public.funds drop constraint if exists funds_amount_sane;
alter table public.funds add constraint funds_amount_sane
  check (amount_bani <= 10000000000) not valid;
alter table public.fund_quotas drop constraint if exists fund_quotas_amount_sane;
alter table public.fund_quotas add constraint fund_quotas_amount_sane
  check (amount_bani <= 10000000000) not valid;
alter table public.fund_payments drop constraint if exists fund_payments_amount_sane;
alter table public.fund_payments add constraint fund_payments_amount_sane
  check (amount_bani <= 10000000000) not valid;

-- ---------- the totals ----------
/*
  Unchanged in everything but one line: collected_bani is every payment the
  fund has received, whoever made it and wherever they live now.

  What is owed is still worked out from the people who are members today —
  somebody who has left is not being asked for anything — so a collection
  whose payers have moved away can show more collected than is currently
  due. That is the truth of it, and better than money that vanishes.
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
  ),
  received as (
    select p.fund_id, sum(p.paid_bani) as all_bani from paid p group by p.fund_id
  )
  select
    d.fund_id,
    sum(d.due_bani)::bigint                                        as target_bani,
    coalesce(max(r.all_bani), 0)::bigint                           as collected_bani,
    count(*)::int                                                  as homes,
    count(*) filter (where coalesce(pd.paid_bani, 0) >= d.due_bani)::int as homes_paid,
    max(d.due_bani) filter (where d.user_id = auth.uid())::bigint  as my_due_bani,
    coalesce(max(pd.paid_bani) filter (where d.user_id = auth.uid()), 0)::bigint as my_paid_bani
  from due d
  left join paid pd on pd.fund_id = d.fund_id and pd.user_id = d.user_id
  left join received r on r.fund_id = d.fund_id
  group by d.fund_id;
$$;

revoke all on function public.fund_summary(uuid) from public, anon;
grant execute on function public.fund_summary(uuid) to authenticated;

-- ---------- the map of old photos is for the community it describes ----------
-- 0019 let any signed-in account read it: the paths of the pre-0018 photos,
-- which carry their uploader's id, and whose community they are.
drop policy if exists legacy_issue_photos_select on public.legacy_issue_photos;
create policy legacy_issue_photos_select on public.legacy_issue_photos
  for select using (public.is_member(community_id));

commit;
