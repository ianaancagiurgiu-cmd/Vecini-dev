/*
  A stand-in for the parts of Supabase the migrations lean on.

  Just enough for every migration to run unchanged and for row-level security
  to be exercised the way production exercises it: three roles, auth.uid()
  read from the request's claim, and a storage schema whose objects table has
  RLS switched on.

  The grants matter as much as the tables. Supabase hands `anon` and
  `authenticated` every privilege on everything in public and relies on RLS
  alone to say no — so a table whose policy is `using (true)` really is
  readable by a visitor with no account. A shim that granted less would hide
  exactly the mistakes this suite exists to find.

  It is a stub, not a substitute: it proves what the policies decide, never
  that the storage service or GoTrue behave as assumed.
*/
create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;

-- The columns delete_my_account reaches for, so that function is tested as it
-- runs in production rather than with its guarded branches skipped.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  encrypted_password text,
  phone text,
  phone_change text,
  email_change text,
  banned_until timestamptz,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null default '{}'::jsonb
);
create table if not exists auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  version text default gen_random_uuid()::text,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
