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
  ('0012_events',           'notification_prefs.events', 'column',  'comutatorul pentru notificările de calendar'),
  ('0013_announcement_dates', 'announcements.starts_at', 'column',  'data de pe anunț — ce ține locul calendarului'),
  ('0014_reactions',        'public.reactions',          'table',   'inimioara pe comentarii și pe răspunsuri'),
  ('0014_reactions',        'public.can_react',          'function', 'cine are voie să aprecieze un comentariu'),
  ('0015_comment_edits',    'issue_comments.edited_at',   'column',  'marcajul „editat” pe comentarii'),
  ('0015_comment_edits',    'discussion_replies.edited_at', 'column', 'marcajul „editat” pe răspunsuri'),
  ('0015_comment_edits',    'public.edit_comment',       'function', 'corectarea unui mesaj, în 15 minute'),
  ('0016_funds',            'public.funds',              'table',   'fondurile: colectele asociației'),
  ('0016_funds',            'public.fund_payments',      'table',   'cine a plătit, cât și când'),
  ('0016_funds',            'public.fund_quotas',        'table',   'excepțiile la suma pe apartament'),
  ('0016_funds',            'public.fund_summary',       'function', 'totalurile, pentru cine nu vede rândurile'),
  ('0016_funds',            'notification_prefs.funds',  'column',  'comutatorul pentru notificările de fonduri'),
  ('0017_documents',        'public.documents',          'table',   'documentele asociației'),
  ('0017_documents',        'public.doc_community',      'function', 'din ce comunitate e un fișier, după calea lui'),
  ('0018_private_issue_photos', 'issues.photo_path',     'column',  'calea pozei, nu mai un link permanent'),
  ('0019_legacy_issue_photo_paths', 'public.legacy_issue_photos', 'table', 'pozele vechi, corectate — vezi mai jos dacă e completă'),
  ('0020_entering_a_community', 'public.join_requests',   'table',   'cererile de intrare, pentru modul „cu aprobare”'),
  ('0020_entering_a_community', 'public.join_community',  'function', 'intrarea cu cod — singura cale'),
  ('0020_entering_a_community', 'public.create_community', 'function', 'crearea comunității, cu fondatorul în același pas'),
  ('0020_entering_a_community', 'public.decide_join_request', 'function', 'aprobarea sau respingerea unei cereri'),
  ('0021_secret_ballot',     'public.poll_results',        'function', 'rezultatele sondajelor, fără nume'),
  ('0022_what_may_change',   'public.issue_has_history',   'function', 'prima linie din istoricul sesizării, o singură dată'),
  ('0023_fund_totals',       'public.lives_where_fund_is', 'function', 'plățile doar pe numele membrilor'),
  ('0024_apartment_for_neighbours', 'public.apartments_of', 'function', 'apartamentul, doar pentru vecini'),
  ('0025_apartment_per_community', 'memberships.apartment', 'column', 'apartamentul, separat în fiecare comunitate'),
  ('0025_apartment_per_community', 'public.set_my_apartment', 'function', 'fiecare își scrie doar apartamentul lui, într-o comunitate în care e')
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
                  when 'public.can_react'        then 'uuid,uuid'
                  when 'public.fund_summary'    then 'uuid'
                  when 'public.doc_community'   then 'text'
                  when 'public.join_community'  then 'text'
                  when 'public.create_community' then 'text,text,text'
                  when 'public.decide_join_request' then 'uuid,uuid,boolean'
                  when 'public.poll_results'    then 'uuid'
                  when 'public.issue_has_history' then 'uuid'
                  when 'public.lives_where_fund_is' then 'uuid,uuid'
                  when 'public.apartments_of'   then 'uuid[]'
                  when 'public.set_my_apartment' then 'uuid,text'
                  when 'public.edit_comment'    then 'text,uuid,text'
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
select '0016_funds',
       'pref_allows(''fund'')',
       'notificările de fonduri chiar pot fi oprite',
       exists (
         select 1 from pg_proc
          where proname = 'pref_allows' and prosrc like '%when ''fund''%'
       )
union all
select '0012_events',
       'pref_allows(''event'')',
       'notificările de calendar chiar pot fi oprite',
       exists (
         select 1 from pg_proc
          where proname = 'pref_allows' and prosrc like '%when ''event''%'
       )
union all
-- Ștergerea a venit odată cu calendarul: o ședință anulată trebuie să poată fi
-- dată jos, iar anunțurile nu aveau până acum voie să fie șterse deloc.
select '0013_announcement_dates',
       'announcements_delete',
       'un anunț sau o ședință anulată poate fi ștearsă',
       exists (
         select 1 from pg_policy
          where polrelid = 'public.announcements'::regclass and polname = 'announcements_delete'
       )
union all
-- Un bucket public ar face inutile toate politicile de mai sus: oricine are
-- linkul citește fișierul, fără verificare.
select '0017_documents',
       'bucket-ul documents',
       'e privat — se ajunge la fișiere doar prin linkuri care expiră',
       exists (
         select 1 from storage.buckets where id = 'documents' and public = false
       )
union all
select '0018_private_issue_photos',
       'bucket-ul issue-photos',
       'e privat — pozele de la sesizări nu mai au adresă permanentă',
       exists (
         select 1 from storage.buckets where id = 'issue-photos' and public = false
       )
union all
-- Ușa din față: dacă politica veche de înscriere mai există, oricine intră
-- în orice comunitate fără cod, oricât de bine ar fi restul.
select '0020_entering_a_community',
       'memberships_insert_self (politica veche)',
       'a dispărut — nu se mai intră fără cod',
       not exists (
         select 1 from pg_policy
          where polrelid = 'public.memberships'::regclass and polname = 'memberships_insert_self'
       )
union all
select '0021_secret_ballot',
       'poll_votes_select',
       'fiecare își vede doar votul lui',
       exists (
         select 1 from pg_policy
          where polrelid = 'public.poll_votes'::regclass and polname = 'poll_votes_select'
            and pg_get_expr(polqual, polrelid) not like '%is_member%'
       )
union all
-- Funcția există și fără ca regula să fie aplicată; asta e regula.
select '0024_apartment_for_neighbours',
       'profiles.apartment',
       'nu se mai poate citi direct din profil',
       not has_column_privilege('authenticated', 'public.profiles', 'apartment', 'select')
union all
-- Singurul rând care e adevărat prin absență: dacă tabelul vechi mai există,
-- migrarea nu a ajuns până la capăt și undeva mai sunt evenimente pe care
-- aplicația nu le mai citește.
select '0013_announcement_dates',
       'events (tabelul vechi)',
       'a dispărut — calendarul nu mai e o listă separată',
       to_regclass('public.events') is null;
