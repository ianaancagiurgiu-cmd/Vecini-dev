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
