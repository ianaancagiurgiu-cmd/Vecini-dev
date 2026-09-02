/*
  Which of the recent migrations are actually in this database.

  Read-only: it creates nothing, changes nothing and locks nothing, so it is
  safe to run against production as often as you like.

  Each row is one object the app calls at runtime. A "LIPSEȘTE" anywhere means
  the migration in that row's file has not been run, and the feature beside it
  will fail when somebody uses it — not at deploy time, which is why this is
  worth checking rather than assuming.
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
  ('0011_priority_until',   'announcements.pinned_until', 'column', 'anunțuri prioritare, cu termen')
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

-- The trigger is separate: a function can exist without being wired to the
-- table, and then nothing enforces it.
select
  '0010_admin_handover' as fisier,
  'trg_keep_one_admin'  as obiect,
  'declanșatorul care aplică regula de mai sus' as la_ce_e,
  exists (
    select 1 from pg_trigger
     where tgname = 'trg_keep_one_admin' and not tgisinternal
  ) as exista;
