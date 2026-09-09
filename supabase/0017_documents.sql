/*
  Documentele asociației: procese-verbale, hotărâri, contracte, facturi.

  The question this answers is the one somebody asks in every association
  every month — "unde e procesul-verbal de la ultima adunare?" — to which the
  answer is currently "at the administrator's, in a folder".

  A document may be attached to a collection, and that is the point of doing
  the two together: "we raised 5.000 lei" is a figure, while "we raised 5.000
  lei and here is the 4.870 lei invoice from the firm that did the roof" is
  evidence. Funds without documents ask for trust. With them, they earn it.

  ---------------------------------------------------------------------------
  A private bucket, unlike the one already here.

  issue-photos is public: anyone holding the URL can fetch the file, and no
  policy is consulted. For a photograph of a broken lift that is tolerable.
  For a contract, an invoice, or minutes with people's names in them it is
  not — a public URL is permanent, guessable enough, and forwardable to anyone
  for ever. So documents get a bucket of their own with public = false, and
  the app reaches files through short-lived signed URLs.

  Which raises the question a private bucket always raises: storage policies
  see the object, not our tables, so they have to work out membership from the
  path. Hence the convention that the first folder of every path is the
  community's id — <community_id>/<uuid>.<ext> — and doc_community below,
  which reads it back without letting a malformed path raise.
*/
begin;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

/*
  The community a stored object belongs to, from the first folder of its path.

  A plain cast would do until the day something lands in the bucket under a
  path that is not a uuid, at which point every policy that touches the bucket
  raises instead of answering false. The regex keeps that from being a
  possibility rather than a thing to remember.
*/
create or replace function public.doc_community(p_name text)
returns uuid language plpgsql immutable as $$
declare
  seg text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if seg ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then return seg::uuid;
  end if;
  return null;
end;
$$;

-- is_member(null) is false, so a path we cannot read is a path nobody reads.
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select using (
  bucket_id = 'documents' and public.is_member(public.doc_community(name))
);
drop policy if exists documents_write on storage.objects;
create policy documents_write on storage.objects for insert with check (
  bucket_id = 'documents' and public.is_staff(public.doc_community(name))
);
drop policy if exists documents_remove on storage.objects;
create policy documents_remove on storage.objects for delete using (
  bucket_id = 'documents' and public.is_staff(public.doc_community(name))
);

/*
  The row beside the file.

  The file alone is a name in a bucket. What makes it findable is this: what
  it is called in Romanian, which kind of paper it is, and which collection it
  belongs to if any.

  kind is free text with no check constraint, on purpose — the app offers a
  fixed list of five, and a sixth should be a change to the app rather than
  another migration somebody has to be talked through running against
  production.
*/
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title        text not null,
  kind         text not null default 'other',
  -- The path inside the bucket. Kept rather than a URL: a signed URL expires,
  -- and a public one is exactly what this bucket is not.
  path         text not null,
  mime         text not null default '',
  size_bytes   bigint not null default 0,
  /*
    Which collection it belongs to, if it belongs to one. set null rather than
    cascade: an invoice outlives the collection it was raised for, and is
    usually the thing you want most once the collection is gone.
  */
  fund_id      uuid references public.funds(id) on delete set null,
  uploaded_by  uuid not null references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists documents_community_idx on public.documents (community_id, created_at desc);
create index if not exists documents_fund_idx on public.documents (fund_id);

alter table public.documents enable row level security;

/*
  Every member reads them; only staff put them there.

  Reading is deliberately not narrowed further. An association owes its
  members sight of its own records, and a document nobody may read is a
  document that might as well be in the folder it came from.
*/
drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (is_member(community_id));

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert with check (is_staff(community_id) and uploaded_by = auth.uid());

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents
  for update using (is_staff(community_id));

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete using (is_staff(community_id));

commit;
