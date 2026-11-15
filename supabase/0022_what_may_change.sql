/*
  What may be changed, by whom, and when it was written.

  A batch of small rules that were each stated somewhere and enforced nowhere.
  They share a cause: a policy says who may touch a row, and says nothing
  about which part of it. "Staff can update status (moderation)" was written
  as "staff can update", so a moderator could rewrite a neighbour's post; "the
  author may update" let the author undo the moderator. And every table
  trusted the client for the one column the fifteen-minute rule in 0015 hangs
  from.

  All found by tests-db: IZO-28, NOT-03, ROL-05, ROL-06, DAT-02, DAT-03,
  DAT-05, SES-02, MSG-05 to MSG-08, REA-04.

  Safe to run more than once.
*/
begin;

-- ===========================================================================
-- Notifications are written by the functions, and only by them.
-- ===========================================================================
/*
  notifications_insert asked that the sender belong to the community named on
  the row, and never asked who the row was for. Anyone could put a line, with
  any text and any link, in the list of anyone on the service — and doing it
  directly skipped the preferences notify_members and notify_user honour.
  The app has only ever used the two functions, so the policy just goes.
*/
drop policy if exists notifications_insert on public.notifications;

-- ===========================================================================
-- Moderation changes the status. It does not change the words.
-- ===========================================================================
/*
  Column privileges rather than a trigger: "only these columns" is exactly
  what a column grant says, it cannot be forgotten by the next policy, and
  the refusal comes from the same place as every other one.

  A discussion: staff may hide it, restore it, or move it to another
  category. Nobody may edit its text, change its author or move it to another
  community — there has never been a screen for any of those, only the gap.
  The author loses the update right altogether, which is what stops a hidden
  discussion being un-hidden by the person it was hidden from.
*/
revoke update on public.discussions from anon, authenticated;
grant update (status, category) on public.discussions to authenticated;

drop policy if exists discussions_update on public.discussions;
create policy discussions_update on public.discussions
  for update using (public.is_staff(community_id)) with check (public.is_staff(community_id));

-- An issue: its status, and nothing else.
revoke update on public.issues from anon, authenticated;
grant update (status) on public.issues to authenticated;

/*
  And where something starts is not the writer's choice either. A report
  opened as "resolved" by the person reporting it, or a discussion that
  arrives pre-hidden, are both states nobody decided.
*/
drop policy if exists issues_insert on public.issues;
create policy issues_insert on public.issues for insert with check (
  public.is_member(community_id) and reporter_id = auth.uid() and status = 'new'
);
drop policy if exists discussions_insert on public.discussions;
create policy discussions_insert on public.discussions for insert with check (
  public.is_member(community_id) and author_id = auth.uid()
  and (status = 'approved' or public.is_staff(community_id))
);

/*
  0003 let the reporter write "the opening entry" of their own issue's
  history, and described it that way. What it permitted was any number of
  entries with the status 'new', at any time, saying anything. The opening
  entry is the one written when there are none.

  "Are there none" is asked through a function because a policy on
  issue_history that itself selects from issue_history is a policy inside
  itself, and PostgreSQL refuses to evaluate it. It answers one bit about an
  issue the caller could already read.
*/
create or replace function public.issue_has_history(p_issue uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.issue_history h where h.issue_id = p_issue);
$$;

drop policy if exists issue_history_insert on public.issue_history;
create policy issue_history_insert on public.issue_history for insert with check (
  by_id = auth.uid()
  and (
    exists (
      select 1 from public.issues i
      where i.id = issue_id and public.is_staff(i.community_id)
    )
    or (
      status = 'new'
      and exists (
        select 1 from public.issues i
        where i.id = issue_id and i.reporter_id = auth.uid()
      )
      and not public.issue_has_history(issue_id)
    )
  )
);

-- ===========================================================================
-- When something was written is not up to the person writing it.
-- ===========================================================================
/*
  0015 closed the comment tables to updates precisely because "a client
  permitted to write created_at can extend its own deadline". It could write
  created_at all along — on the insert. A comment dated ten years ahead is
  inside its fifteen minutes for ten years; one dated 2020 sits above the
  messages it is answering.

  Only for requests arriving through the API. Migrations and the SQL editor
  run as the owner and may still say when something happened, which 0013
  relied on when it carried the events across with their own dates.
*/
create or replace function public.stamp_created_at()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
  end if;
  return new;
end;
$$;

-- The same, for the tables that also carry the mark of a later correction:
-- nothing is born already edited.
create or replace function public.stamp_created_unedited()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();
    new.edited_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.stamp_history_at()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.at := now();
  end if;
  return new;
end;
$$;

do $stamps$
declare
  t text;
begin
  foreach t in array array[
    'announcements', 'discussions', 'issues', 'polls', 'poll_votes', 'reactions',
    'funds', 'fund_payments', 'documents'
  ] loop
    execute format('drop trigger if exists trg_stamp_created_at on public.%I', t);
    execute format('create trigger trg_stamp_created_at before insert on public.%I for each row execute procedure public.stamp_created_at()', t);
  end loop;
  foreach t in array array['issue_comments', 'discussion_replies'] loop
    execute format('drop trigger if exists trg_stamp_created_at on public.%I', t);
    execute format('create trigger trg_stamp_created_at before insert on public.%I for each row execute procedure public.stamp_created_unedited()', t);
  end loop;
end
$stamps$;

drop trigger if exists trg_stamp_history_at on public.issue_history;
create trigger trg_stamp_history_at before insert on public.issue_history
  for each row execute procedure public.stamp_history_at();

-- ===========================================================================
-- Correcting a message: still yours, still fifteen minutes, still a member.
-- ===========================================================================
/*
  Two things added to 0015's function. It never asked whether the author was
  still in the community, so somebody removed a minute after posting kept the
  other fourteen. And "cannot be edited into nothing" was tested with
  btrim(), which strips spaces and nothing else: a message of blank lines
  passed.
*/
create or replace function public.edit_comment(p_kind text, p_id uuid, p_body text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_edited timestamptz;
begin
  if coalesce(p_body, '') !~ '\S' then
    raise exception 'a comment cannot be edited into nothing';
  end if;

  if p_kind = 'comment' then
    update public.issue_comments c
       set body = p_body, edited_at = now()
     where c.id = p_id
       and c.author_id = auth.uid()
       and c.created_at > now() - interval '15 minutes'
       and exists (select 1 from public.issues i where i.id = c.issue_id and public.is_member(i.community_id))
    returning c.edited_at into v_edited;
  elsif p_kind = 'reply' then
    update public.discussion_replies r
       set body = p_body, edited_at = now()
     where r.id = p_id
       and r.author_id = auth.uid()
       and r.created_at > now() - interval '15 minutes'
       and exists (select 1 from public.discussions d where d.id = r.discussion_id and public.is_member(d.community_id))
    returning r.edited_at into v_edited;
  else
    raise exception 'unknown kind: %', p_kind;
  end if;

  if v_edited is null then
    raise exception 'not yours to edit, or the fifteen minutes are up';
  end if;
  return v_edited;
end;
$$;

revoke all on function public.edit_comment(text, uuid, text) from public, anon;
grant execute on function public.edit_comment(text, uuid, text) to authenticated;

-- ===========================================================================
-- Taking your heart back after you have left.
-- ===========================================================================
/*
  0014 kept this open on purpose — "the one direction worth keeping open" —
  with a delete policy that asks only whose heart it is. It did not work.
  A delete has to find the row first, finding is governed by the select
  policy, and the select policy asks for membership. The heart stayed,
  counted, with nobody able to remove it. Your own are now always visible to
  you, which is all the delete needed.
*/
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions
  for select using (user_id = auth.uid() or public.can_react(issue_comment_id, reply_id));

-- ===========================================================================
-- Text has to be something, and cannot be anything.
-- ===========================================================================
/*
  Every column here was `not null`, which the empty string satisfies, and
  none had a length. The app loads a community's comments when it opens; one
  two-megabyte comment is everyone's slow start.

  The limits are far above anything the screens are for — the longest
  announcement in production is under a hundred characters — so nobody
  meets them by writing. `not valid` so that rows already there are left
  alone whatever they hold: the rule is for what arrives from now on, and a
  migration that refuses to run because of one old row is worse than the row.
*/
do $limits$
declare
  r record;
begin
  for r in
    select * from (values
      ('announcements',      'announcements_title_text',   $c$ title ~ '\S' and char_length(title) <= 300 $c$),
      ('announcements',      'announcements_body_len',     $c$ char_length(body) <= 20000 and char_length(location) <= 300 $c$),
      ('discussions',        'discussions_title_text',     $c$ title ~ '\S' and char_length(title) <= 300 $c$),
      ('discussions',        'discussions_body_text',      $c$ body ~ '\S' and char_length(body) <= 20000 $c$),
      ('discussion_replies', 'discussion_replies_body_text', $c$ body ~ '\S' and char_length(body) <= 5000 $c$),
      ('issues',             'issues_title_text',          $c$ title ~ '\S' and char_length(title) <= 300 $c$),
      ('issues',             'issues_description_text',    $c$ description ~ '\S' and char_length(description) <= 20000 and char_length(coalesce(location, '')) <= 300 $c$),
      ('issue_comments',     'issue_comments_body_text',   $c$ body ~ '\S' and char_length(body) <= 5000 $c$),
      ('issue_history',      'issue_history_note_len',     $c$ char_length(note) <= 2000 and char_length(status) <= 40 $c$),
      ('polls',              'polls_question_text',        $c$ question ~ '\S' and char_length(question) <= 500 $c$),
      ('poll_options',       'poll_options_label_text',    $c$ label ~ '\S' and char_length(label) <= 200 $c$),
      ('notifications',      'notifications_text_len',     $c$ char_length(title) <= 300 and char_length(body) <= 2000 and char_length(link) <= 500 and char_length(type) <= 40 $c$),
      ('funds',              'funds_text',                 $c$ title ~ '\S' and char_length(title) <= 300 and char_length(description) <= 20000 $c$),
      ('fund_payments',      'fund_payments_note_len',     $c$ char_length(note) <= 1000 $c$),
      ('documents',          'documents_text',             $c$ title ~ '\S' and char_length(title) <= 300 and char_length(path) <= 500 and char_length(kind) <= 40 $c$),
      ('communities',        'communities_text',           $c$ name ~ '\S' and char_length(name) <= 200 and char_length(code) between 1 and 40 and char_length(coalesce(address, '')) <= 300 and char_length(coalesce(description, '')) <= 5000 $c$),
      ('profiles',           'profiles_text_len',          $c$ char_length(full_name) <= 120 and char_length(coalesce(apartment, '')) <= 60 $c$),
      ('member_phones',      'member_phones_len',          $c$ char_length(coalesce(phone, '')) <= 40 $c$)
    ) as v(tbl, name, expr)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.name);
    execute format('alter table public.%I add constraint %I check (%s) not valid', r.tbl, r.name, r.expr);
  end loop;
end
$limits$;

commit;
