select
  f.id,
  u.telegram_id,
  u.username,
  u.first_name,
  u.last_name,
  f.message,
  f.created_at
from public.feedback f
join public.users u on u.id = f.user_id
order by f.created_at desc;
