/*
  Which of the recent migrations are actually in this database.

  Read-only: it creates nothing, changes nothing and locks nothing, so it is
  safe to run against production as often as you like.

  Each row is one object the app calls at runtime. A "LIPSEȘTE" anywhere means
  the migration in that row's file has not been run, and the feature beside it
  will fail when somebody uses it — not at deploy time, which is why this is
  worth checking rather than assuming.

  Every migration from 0007 on has to appear here; scripts/build-pending-sql.mjs
  refuses to build the bundle if one of them does not, so this cannot fall
  behind the way the bundle once did.
*/
with expected(fisier, obiect, tip, la_ce_e) as (values
  ('0007_account_deletion', 'public.deleted_accounts',  'table',    'contorul de conturi șterse'),
  ('0007_account_deletion', 'public.delete_my_account', 'function', 'ștergerea contului, cu anonimizare'),
  ('0008_archive',          'public.archived_items',    'table',    'arhivarea anunțurilor și sesizărilor'),
  ('0009_neighbour_phones', 'public.member_phones',     'table',    'numărul de telefon al vecinilor'),
  ('0009_neighbour_phones', 'public.shares_community',  'function', 'cine are voie să vadă un număr'),
  ('0010_admin_handover',   'public.keep_one_admin',    'function', 'oprește rămânerea fără administrator'),
  ('0010_admin_handover',   'public.set_member_role',   'function', 'schimbarea rolului unui membru'),
  ('0010_admin_handover',   'public.transfer_admin',    'function', 'predarea comunității altcuiva'),
  ('0011_priority_until',   'announcements.pinned_until', 'column', 'anunțuri prioritare, cu termen'),
  ('0012_events',           'public.events',            'table',    'calendarul asociației'),
  ('0012_events',           'notification_prefs.events', 'column',  'comutatorul pentru notificările de calendar')
)
select
  e.fisier,
  e.obiect,
  e.la_ce_e,
  case when e.tip = 'table'
         then to_regclass(e.obiect) is not null
       when e.tip = 'column'
         then exists (
           select 1 from information_schema.columns
            where table_schema = 'public'
              and table_name  = split_part(e.obiect, '.', 1)
              and column_name = split_part(e.obiect, '.', 2)
         )
         else to_regprocedure(e.obiect || '(' ||
                case e.obiect
                  when 'public.shares_community' then 'uuid'
                  when 'public.set_member_role'  then 'uuid,uuid,text'
                  when 'public.transfer_admin'   then 'uuid,uuid'
                  else ''
                end || ')') is not null
  end as exista
from expected e
order by e.fisier, e.obiect;

/*
  Two things a "does it exist" check cannot see.

  The trigger is separate because a function can exist without being wired to
  the table, and then nothing enforces it.

  pref_allows is separate because it existed long before the calendar did:
  adding the events column without teaching the function about it would leave a
  switch on the settings screen that changes nothing. There is no way to ask the
  function whether it knows the type — passing it a row it has no branch for
  gives the same answer as passing one it does — so this reads its text.
*/
select '0010_admin_handover' as fisier,
       'trg_keep_one_admin'  as obiect,
       'declanșatorul care aplică regula de mai sus' as la_ce_e,
       exists (
         select 1 from pg_trigger
          where tgname = 'trg_keep_one_admin' and not tgisinternal
       ) as exista
union all
select '0012_events',
       'pref_allows(''event'')',
       'notificările de calendar chiar pot fi oprite',
       exists (
         select 1 from pg_proc
          where proname = 'pref_allows' and prosrc like '%when ''event''%'
       );
