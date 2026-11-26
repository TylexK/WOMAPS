insert into public.catalog_admins (user_id, username)
select id, 'Gonx4'
from auth.users
where lower(email) = lower('REPLACE_WITH_GONX4_GOOGLE_EMAIL')
on conflict (username) do update set user_id = excluded.user_id;

insert into public.catalog_admins (user_id, username)
select id, 'onyx'
from auth.users
where lower(email) = lower('REPLACE_WITH_ONYX_GOOGLE_EMAIL')
on conflict (username) do update set user_id = excluded.user_id;

select username, user_id from public.catalog_admins order by username;
