-- Vecini — toate migrarile ramase, intr-un singur fisier.
-- Se poate rula de mai multe ori fara probleme: daca ai rulat deja o parte,
-- rularea din nou nu strica nimic si nu pierzi date.
--
--   0003 — raportorul isi poate scrie istoricul propriei sesizari (eroarea 403)
--   0004 — abonamentul de notificari trece de la un cont la altul pe acelasi telefon
--   0005 — un vizitator nelogat poate verifica un cod de invitatie


-- ============================================================
-- 0003_issue_history_fix.sql
-- ============================================================

-- Vecini — let the reporter record the opening entry of their own issue.
-- Safe to run more than once.
--
-- The original policy required staff for every issue_history insert, but the
-- app writes the initial 'new' row as the reporter — who is usually an ordinary
-- member. That insert was failing with a row-level-security error on every
-- report, and the app ignored the error, so issues were quietly created with
-- no history at all.
--
-- Status changes still require staff; a reporter may only add the opening
-- 'new' entry, and only for an issue they themselves reported.

drop policy if exists issue_history_insert on public.issue_history;
create policy issue_history_insert on public.issue_history for insert with check (
  by_id = auth.uid()
  and (
    -- Staff may record any entry, at any status.
    exists (
      select 1 from public.issues i
      where i.id = issue_id and public.is_staff(i.community_id)
    )
    -- The reporter may record only the opening entry of their own issue.
    -- `status` and `issue_id` are unqualified on purpose: outside the
    -- subquery they refer to the row being inserted, not to public.issues.
    or (
      status = 'new'
      and exists (
        select 1 from public.issues i
        where i.id = issue_id and i.reporter_id = auth.uid()
      )
    )
  )
);

-- ============================================================
-- 0004_push_subscription_handover.sql
-- ============================================================

-- Vecini — let a device's push subscription change hands between accounts.
-- Safe to run more than once.
--
-- A push subscription belongs to a *browser*, not to an account. When a second
-- person signs in on the same phone, the app has to point the existing
-- subscription at the new account — but the row is owned by the first person,
-- and the update policy only permits touching your own rows. The upsert failed
-- with a row-level-security error, so on that device the second user could
-- never enable push at all. It showed only as "could not turn on
-- notifications", with no way forward.
--
-- Holding the endpoint is itself the proof of ownership: it is a long, random,
-- unguessable URL that only the browser it belongs to is given. So a caller
-- presenting one may claim it, which replaces the previous owner outright —
-- correct, since the device is now theirs, and it also stops the previous user
-- from receiving pushes on a phone that is no longer signed in as them.

create or replace function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_endpoint is null or p_p256dh is null or p_auth is null then
    raise exception 'endpoint, p256dh and auth are all required';
  end if;

  delete from public.push_subscriptions where endpoint = p_endpoint;

  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth);
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text) from public;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;

-- Releasing a device (sign-out, or turning push off) must work even when the
-- row is currently owned by somebody else on that same browser.
create or replace function public.release_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function public.release_push_subscription(text) from public;
grant execute on function public.release_push_subscription(text) to authenticated;

-- ============================================================
-- 0005_invite_by_code.sql
-- ============================================================

-- Vecini — let a visitor check an invitation code before creating an account.
-- Safe to run more than once.
--
-- Pressing "I have an invitation code" on the landing page sent people to a
-- screen that required an account — which someone holding an invitation code
-- does not have yet. They were bounced to the login screen and the code was
-- lost, so a neighbour given a code hit a dead end.
--
-- Fixing that means the code has to be checkable while signed out, but
-- row-level security (correctly) hides communities from anonymous visitors.
-- This function is the narrow exception: given a code, it returns the
-- community's id and name and nothing else — no address, no members, no posts.
-- Someone holding a code learns only the name of what they are joining, which
-- they need in order to confirm they typed it right.
--
-- Joining still requires an account and still goes through the normal
-- membership insert, so this grants no new ability to get inside a community.

create or replace function public.community_by_code(p_code text)
returns table (id uuid, name text)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select c.id, c.name
  from public.communities c
  where lower(c.code) = lower(btrim(coalesce(p_code, '')))
    and btrim(coalesce(p_code, '')) <> ''
  limit 1;
$$;

revoke all on function public.community_by_code(text) from public;
-- anon on purpose: the whole point is answering before sign-up.
grant execute on function public.community_by_code(text) to anon, authenticated;
