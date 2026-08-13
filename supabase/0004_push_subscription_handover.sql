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
