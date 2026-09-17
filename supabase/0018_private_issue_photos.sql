/*
  Pozele de la sesizări, într-un bucket privat.

  issue-photos has been public since 0001: whoever holds a photo's URL can
  fetch it, no membership check consulted, for as long as the file exists —
  which is fine for a snapshot of a broken lift and is not fine for a photo
  that happens to catch an apartment number or a person in frame. documents
  (0017) already made this trade the other way; this brings issue-photos in
  line with it.

  Two things change. The bucket turns private, so a photo is reached through
  a signed URL that expires rather than a permanent address. And new uploads
  go under <community_id>/<file> instead of <user_id>/<file>, because a
  storage policy sees only the object, not the issues row it belongs to, and
  has to work out membership from the path alone — the same convention
  documents settled on, so doc_community below is reused rather than
  duplicated under a second name.

  What this migration does not do: move the photos already sitting in the
  bucket under the old <user_id>/<file> shape. Under the new policy nobody
  can read them — doc_community reads a user id as if it were a community id,
  finds no such community, and is_member says no — which is the safe way for
  an old file to fail, not a bug. There were five such files in the one
  project that had any, and they were moved by hand, once, directly against
  that project: a migration meant to be pasted into any environment, including
  a brand new one, is not the place for another project's specific rows.
*/
begin;

update storage.buckets set public = false where id = 'issue-photos';

-- photo_url held a permanent public URL; photo_path holds a path inside a
-- bucket that no longer has permanent addresses, same as documents.path.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'issues' and column_name = 'photo_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'issues' and column_name = 'photo_path'
  ) then
    alter table public.issues rename column photo_url to photo_path;
  end if;
end $$;

-- Replaces the 0001 policies, which let any signed-in user read or write any
-- file in the bucket with no membership check at all.
drop policy if exists issue_photos_read on storage.objects;
create policy issue_photos_read on storage.objects for select using (
  bucket_id = 'issue-photos' and public.is_member(public.doc_community(name))
);
drop policy if exists issue_photos_write on storage.objects;
create policy issue_photos_write on storage.objects for insert with check (
  bucket_id = 'issue-photos' and public.is_member(public.doc_community(name))
);

commit;
