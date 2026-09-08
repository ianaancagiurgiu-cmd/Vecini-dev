/*
  A heart on somebody's comment.

  The app already had this shape once: issue_supporters is a row saying "this
  person, this issue", pressed once to join and once to leave. A reaction is the
  same row one level down — this person, this comment — so it is modelled the
  same way rather than as a counter on the comment. Counters drift; a set of
  rows cannot disagree with itself about who is in it, and it can answer "did I
  already?" without a second query.

  One table for both kinds of comment, with two nullable references and a check
  that exactly one is filled. The alternative, a (target_type, target_id) pair,
  cannot carry a foreign key at all: nothing would delete the hearts when the
  comment they belong to is deleted, and the orphans would go on being counted
  forever by whatever query forgot to exclude them. Two real references cascade
  on their own.

  emoji is a column, not a constraint, and it is a column even though the app
  only ever writes one heart. Adding a second kind of reaction later is then a
  change to the app rather than another migration somebody has to be talked
  through running against production.
*/
begin;

create table if not exists public.reactions (
  id               uuid primary key default gen_random_uuid(),
  issue_comment_id uuid references public.issue_comments(id) on delete cascade,
  reply_id         uuid references public.discussion_replies(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  emoji            text not null default '❤️',
  created_at       timestamptz not null default now(),

  -- Exactly one target. Neither is a row about nothing; both is a row about
  -- two different comments at once.
  constraint reactions_one_target
    check ((issue_comment_id is not null) <> (reply_id is not null)),

  -- Not a list of permitted emoji — see above. Just a bound, so the column
  -- cannot be used to store a paragraph.
  constraint reactions_emoji_short check (char_length(emoji) between 1 and 8)
);

/*
  Pressing the heart twice in a row must not make two hearts.

  The app guards against it too, but a double tap on a slow connection is two
  requests in flight with the same answer to "have I already?", and only the
  database can settle that. Partial, because a nullable column in a unique index
  would let unlimited duplicate rows through — every one of them differs from
  the others in Postgres's eyes as long as one column is null.
*/
create unique index if not exists reactions_one_per_comment
  on public.reactions (issue_comment_id, user_id, emoji)
  where issue_comment_id is not null;

create unique index if not exists reactions_one_per_reply
  on public.reactions (reply_id, user_id, emoji)
  where reply_id is not null;

/*
  Which community a heart belongs to, by way of the comment it is on.

  security definer, so the check is one lookup rather than a policy evaluated
  inside a policy: it resolves the comment to its community and then asks
  is_member, which does the same. It reveals nothing else — the only thing a
  caller can learn is whether a given comment sits in a community they are
  already in.
*/
create or replace function public.can_react(p_comment uuid, p_reply uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when p_comment is not null then exists (
      select 1
        from public.issue_comments c
        join public.issues i on i.id = c.issue_id
       where c.id = p_comment and public.is_member(i.community_id)
    )
    when p_reply is not null then exists (
      select 1
        from public.discussion_replies r
        join public.discussions d on d.id = r.discussion_id
       where r.id = p_reply and public.is_member(d.community_id)
    )
    else false
  end;
$$;

alter table public.reactions enable row level security;

-- Everyone in the community sees every heart: the count is the point, and it
-- is not a count if half of it is hidden.
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions
  for select using (public.can_react(issue_comment_id, reply_id));

-- In your own name only, and only where you can already read the comment.
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions
  for insert with check (user_id = auth.uid() and public.can_react(issue_comment_id, reply_id));

/*
  Taking yours back needs no membership check. Someone who has left the
  community can no longer read the comment, and would otherwise be unable to
  withdraw a heart that is still being counted — which is the one direction
  worth keeping open.
*/
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions
  for delete using (user_id = auth.uid());

-- Deliberately no update policy. Changing which emoji a row holds is a delete
-- and an insert, both of which are already governed above.

commit;
