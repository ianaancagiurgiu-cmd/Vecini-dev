-- Vecini — diagnostic notificari. Doar citeste, nu modifica nimic.
select 'A. tabel push_subscriptions existe' as verificare,
       coalesce((select 'DA' where to_regclass('public.push_subscriptions') is not null), 'NU - lipseste migrarea 0002') as rezultat
union all
select 'B. functia notify_members existe',
       coalesce((select 'DA' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'notify_members' limit 1),
                'NU - lipseste migrarea 0002')
union all
select 'C. migrarea 0003 aplicata (raportorul poate scrie istoric)',
       coalesce((select 'DA' from pg_policies
                 where schemaname = 'public' and tablename = 'issue_history'
                   and policyname = 'issue_history_insert'
                   and with_check like '%reporter_id%' limit 1),
                'NU - ruleaza 0003')
union all
select 'D. cate dispozitive s-au inregistrat pentru push',
       coalesce((select count(*)::text from public.push_subscriptions), 'tabel lipsa')
union all
select 'E. cati utilizatori au push pornit in preferinte',
       (select count(*)::text from public.notification_prefs where push is true)
union all
select 'F. notificari create in ultima ora',
       (select count(*)::text from public.notifications where created_at > now() - interval '1 hour')
union all
select 'G. total notificari in baza',
       (select count(*)::text from public.notifications)
union all
select 'H. ultimele 5 notificari (tip / catre cine / cand)',
       coalesce((select string_agg(x.info, ' | ')
                 from (select n.type || ' -> ' || right(n.user_id::text, 4) || ' @ '
                              || to_char(n.created_at, 'HH24:MI') as info
                       from public.notifications n
                       order by n.created_at desc limit 5) x), 'niciuna');
