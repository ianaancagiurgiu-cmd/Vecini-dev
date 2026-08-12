-- Vecini — de ce a fost sarit toata lumea la push. Doar citeste.
select
  coalesce(p.full_name, '(fara nume)') as nume,
  coalesce(u.email, '?') as email,
  m.role as rol,
  coalesce((select case when np.push then 'DA' else 'NU' end
            from public.notification_prefs np where np.user_id = m.user_id), 'fara rand') as push,
  coalesce((select case when np.issues then 'DA' else 'NU' end
            from public.notification_prefs np where np.user_id = m.user_id), 'fara rand') as vrea_sesizari,
  coalesce((select case when np.announcements then 'DA' else 'NU' end
            from public.notification_prefs np where np.user_id = m.user_id), 'fara rand') as vrea_anunturi,
  (select count(*) from public.push_subscriptions ps where ps.user_id = m.user_id) as dispozitive,
  (select count(*) from public.notifications n where n.user_id = m.user_id) as notificari_total,
  coalesce((select to_char(max(n.created_at), 'HH24:MI')
            from public.notifications n where n.user_id = m.user_id), '-') as ultima
from public.memberships m
left join auth.users u on u.id = m.user_id
left join public.profiles p on p.id = m.user_id
order by dispozitive desc, nume;
