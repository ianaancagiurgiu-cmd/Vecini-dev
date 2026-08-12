-- Vecini — let the reporter record the opening entry of their own issue.
-- Safe to run more than once.
--
-- The original policy required staff for every issue_history insert, but the
-- app writes the initial 'new' row as the reporter — who is usually an ordinary
-- member. That insert was failing with a row-level-security error on every
-- report, and the app ignored the error, so issues were quietly created with
-- no history at all.
--
-- Status changes still require staff; a reporter may only add the opening
-- 'new' entry, and only for an issue they themselves reported.

drop policy if exists issue_history_insert on public.issue_history;
create policy issue_history_insert on public.issue_history for insert with check (
  by_id = auth.uid()
  and (
    -- Staff may record any entry, at any status.
    exists (
      select 1 from public.issues i
      where i.id = issue_id and public.is_staff(i.community_id)
    )
    -- The reporter may record only the opening entry of their own issue.
    -- `status` and `issue_id` are unqualified on purpose: outside the
    -- subquery they refer to the row being inserted, not to public.issues.
    or (
      status = 'new'
      and exists (
        select 1 from public.issues i
        where i.id = issue_id and i.reporter_id = auth.uid()
      )
    )
  )
);
