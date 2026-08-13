-- Vecini — record what kind of place a community is.
-- Safe to run more than once.
--
-- The app's wording assumed an apartment block ("tot ce ține de bloc",
-- "scări"), which is wrong for a street of houses. Rather than pick neutral
-- wording everywhere and lose the warmth of the original line, each community
-- says what it is and the app speaks accordingly.
--
--   bloc   — apartment block / owners' association (the original assumption)
--   houses — houses, a street, a residential area
--   mixed  — both, e.g. a compound with blocks and houses
--
-- Defaults to 'bloc' so existing communities keep the wording they have today.

alter table public.communities
  add column if not exists kind text not null default 'bloc';

do $$
begin
  alter table public.communities
    add constraint communities_kind_check check (kind in ('bloc', 'houses', 'mixed'));
exception
  when duplicate_object then null;  -- already added by an earlier run
end $$;
