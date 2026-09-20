/*
  The five photos that predate 0018, recognized where they actually are.

  0018 moved their storage.objects.name to <community_id>/<file> to match the
  new RLS convention. That was wrong: in this project's storage backend a
  plain UPDATE of the objects row's name does not relocate the underlying
  bytes, so the row said one path while the file only answered to the old
  one — signing succeeded (RLS saw a name it could parse) and the download
  that followed came back 400, because nothing lived at the new name. Found
  within the hour, from the edge logs: a 200 on /object/sign, a 400 on the
  /object/sign GET that followed it with the token.

  The name is reverted here to what actually resolves. What is added is a
  narrow, explicit map from those old names to the community that owns them,
  read by issue_photos_read alongside doc_community's normal parse — so a
  handful of pre-0018 files can still be told apart from a stranger's photo
  without teaching doc_community to trust a bare user id as a community,
  which is the thing the new convention exists to stop.

  A general lesson stays out of this file on purpose: renaming a Supabase
  Storage object's row is not the same as moving the object, and the two
  should not be assumed to travel together again without checking.
*/
begin;

-- Reverted from the <community_id>/<file> shape 0018 gave them, which the
-- storage backend never actually followed.
update storage.objects set name = '2ad71f71-92a4-483e-9f6d-e0313f455805/1786524630626.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/2ad71f71-92a4-483e-9f6d-e0313f455805-1786524630626.jpg';
update storage.objects set name = '1f845b5a-ad07-45e6-8bb7-91d75e6fea28/1786557775450.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1f845b5a-ad07-45e6-8bb7-91d75e6fea28-1786557775450.jpg';
update storage.objects set name = 'b0a09539-1974-4d23-b915-94e2f469b539/1786559449849.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/b0a09539-1974-4d23-b915-94e2f469b539-1786559449849.jpg';
update storage.objects set name = '1416c439-d309-4747-a448-8ebedc0288a1/1786681849111.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1786681849111.jpg';
update storage.objects set name = '1416c439-d309-4747-a448-8ebedc0288a1/1788891706699.jpg'
  where bucket_id = 'issue-photos' and name = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1788891706699.jpg';

update public.issues set photo_path = '2ad71f71-92a4-483e-9f6d-e0313f455805/1786524630626.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/2ad71f71-92a4-483e-9f6d-e0313f455805-1786524630626.jpg';
update public.issues set photo_path = '1f845b5a-ad07-45e6-8bb7-91d75e6fea28/1786557775450.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1f845b5a-ad07-45e6-8bb7-91d75e6fea28-1786557775450.jpg';
update public.issues set photo_path = 'b0a09539-1974-4d23-b915-94e2f469b539/1786559449849.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/b0a09539-1974-4d23-b915-94e2f469b539-1786559449849.jpg';
update public.issues set photo_path = '1416c439-d309-4747-a448-8ebedc0288a1/1786681849111.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1786681849111.jpg';
update public.issues set photo_path = '1416c439-d309-4747-a448-8ebedc0288a1/1788891706699.jpg'
  where photo_path = 'd8a7b806-603b-4fc0-a4ec-f680b35c647f/1416c439-d309-4747-a448-8ebedc0288a1-1788891706699.jpg';

create table if not exists public.legacy_issue_photos (
  name         text primary key,
  community_id uuid not null references public.communities(id) on delete cascade
);

-- Filtered by whether the community actually exists here, rather than a
-- plain values list: this file is meant to be safe to paste into any
-- environment, a fresh one included, and a fresh one has no such community
-- to satisfy the foreign key above.
insert into public.legacy_issue_photos (name, community_id)
select v.name, v.community_id from (values
  ('2ad71f71-92a4-483e-9f6d-e0313f455805/1786524630626.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('1f845b5a-ad07-45e6-8bb7-91d75e6fea28/1786557775450.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('b0a09539-1974-4d23-b915-94e2f469b539/1786559449849.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('1416c439-d309-4747-a448-8ebedc0288a1/1786681849111.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid),
  ('1416c439-d309-4747-a448-8ebedc0288a1/1788891706699.jpg', 'd8a7b806-603b-4fc0-a4ec-f680b35c647f'::uuid)
) as v(name, community_id)
where exists (select 1 from public.communities c where c.id = v.community_id)
on conflict (name) do update set community_id = excluded.community_id;

alter table public.legacy_issue_photos enable row level security;
-- Readable by anyone signed in: it names no more than a bucket path and a
-- community id, and the policy below is what actually gates the photo.
drop policy if exists legacy_issue_photos_select on public.legacy_issue_photos;
create policy legacy_issue_photos_select on public.legacy_issue_photos for select using (auth.uid() is not null);

drop policy if exists issue_photos_read on storage.objects;
create policy issue_photos_read on storage.objects for select using (
  bucket_id = 'issue-photos' and (
    public.is_member(public.doc_community(name))
    or public.is_member((select l.community_id from public.legacy_issue_photos l where l.name = storage.objects.name))
  )
);

commit;
