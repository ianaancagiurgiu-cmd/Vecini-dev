/*
  Fixing a typo in something you already sent.

  Not an update policy, a function. An `update` policy on the comment tables
  would let the client send any column it liked and then argue about which ones
  the policy happened to constrain: the fifteen-minute window lives in
  created_at, so a client permitted to write created_at can extend its own
  deadline, and one permitted to write edited_at can edit without the mark
  appearing. Both are the sort of hole you find later by accident.

  So the tables stay closed to updates entirely, and this is the only door.
  Body and edited_at are the only columns it touches, which makes them the only
  columns anybody can change — by construction rather than by having remembered
  to forbid the rest.

  Fifteen minutes, matching WhatsApp: long enough to catch the typo you see the
  moment you send it, short enough that a neighbour cannot rewrite what they
  promised after three people have replied to it. And the edit always leaves a
  mark, which is the part that matters in a thread where money and decisions get
  discussed.
*/
begin;

alter table public.issue_comments      add column if not exists edited_at timestamptz;
alter table public.discussion_replies  add column if not exists edited_at timestamptz;

comment on column public.issue_comments.edited_at is
  'When the author last corrected it. Null means untouched since it was sent.';
comment on column public.discussion_replies.edited_at is
  'When the author last corrected it. Null means untouched since it was sent.';

/*
  p_kind is 'comment' for an issue comment and 'reply' for one in a discussion.
  One function rather than two because the caller is one button, and the two
  branches are the same statement against a different table.

  security definer because the tables have no update policy at all — that is
  the point. The checks the policy would have made are here instead, in the
  where clause, where the client cannot reach around them: yours, and inside
  the window. No rows updated means one of those was false, and the caller is
  told so rather than being handed a silent success.
*/
create or replace function public.edit_comment(p_kind text, p_id uuid, p_body text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_edited timestamptz;
begin
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'a comment cannot be edited into nothing';
  end if;

  if p_kind = 'comment' then
    update public.issue_comments
       set body = p_body, edited_at = now()
     where id = p_id
       and author_id = auth.uid()
       and created_at > now() - interval '15 minutes'
    returning edited_at into v_edited;
  elsif p_kind = 'reply' then
    update public.discussion_replies
       set body = p_body, edited_at = now()
     where id = p_id
       and author_id = auth.uid()
       and created_at > now() - interval '15 minutes'
    returning edited_at into v_edited;
  else
    raise exception 'unknown kind: %', p_kind;
  end if;

  if v_edited is null then
    raise exception 'not yours to edit, or the fifteen minutes are up';
  end if;
  return v_edited;
end;
$$;

revoke all on function public.edit_comment(text, uuid, text) from public;
grant execute on function public.edit_comment(text, uuid, text) to authenticated;

commit;
