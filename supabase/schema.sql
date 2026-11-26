create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Usuario',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  username text not null unique check (username in ('Gonx4', 'onyx')),
  created_at timestamptz not null default now(),
  unique (user_id, username)
);

create table if not exists public.mapper_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 70),
  kind text not null default 'mapper' check (kind in ('mapper', 'module')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mappers (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.mapper_folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '' check (char_length(description) <= 180),
  file_type text not null default 'MAPEADOR' check (char_length(file_type) <= 30),
  download_url text not null,
  search_terms text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (folder_id, name),
  constraint mappers_download_url_http check (
    download_url ~* '^https?://'
  )
);

create index if not exists mappers_folder_sort_idx
  on public.mappers (folder_id, sort_order);

create or replace function public.is_catalog_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.catalog_admins
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'Usuario'
    ),
    nullif(new.raw_user_meta_data ->> 'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.catalog_admins enable row level security;
alter table public.mapper_folders enable row level security;
alter table public.mappers enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Admins can read their own admin assignments" on public.catalog_admins;
create policy "Admins can read their own admin assignments"
  on public.catalog_admins for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Folders are publicly readable" on public.mapper_folders;
create policy "Folders are publicly readable"
  on public.mapper_folders for select
  using (true);

drop policy if exists "Admins can create folders" on public.mapper_folders;
create policy "Admins can create folders"
  on public.mapper_folders for insert to authenticated
  with check ((select public.is_catalog_admin()));

drop policy if exists "Admins can update folders" on public.mapper_folders;
create policy "Admins can update folders"
  on public.mapper_folders for update to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

drop policy if exists "Admins can delete folders" on public.mapper_folders;
create policy "Admins can delete folders"
  on public.mapper_folders for delete to authenticated
  using ((select public.is_catalog_admin()));

drop policy if exists "Mappers are publicly readable" on public.mappers;
create policy "Mappers are publicly readable"
  on public.mappers for select
  using (true);

drop policy if exists "Admins can create mappers" on public.mappers;
create policy "Admins can create mappers"
  on public.mappers for insert to authenticated
  with check ((select public.is_catalog_admin()));

drop policy if exists "Admins can update mappers" on public.mappers;
create policy "Admins can update mappers"
  on public.mappers for update to authenticated
  using ((select public.is_catalog_admin()))
  with check ((select public.is_catalog_admin()));

drop policy if exists "Admins can delete mappers" on public.mappers;
create policy "Admins can delete mappers"
  on public.mappers for delete to authenticated
  using ((select public.is_catalog_admin()));

grant select on public.profiles, public.mapper_folders, public.mappers to anon, authenticated;
grant update (display_name, avatar_url, updated_at) on public.profiles to authenticated;
grant select on public.catalog_admins to authenticated;
grant insert, update, delete on public.mapper_folders, public.mappers to authenticated;
revoke all on function public.is_catalog_admin() from public, anon;
grant execute on function public.is_catalog_admin() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- After each admin has signed in with Google once, assign their Google account:
-- insert into public.catalog_admins (user_id, username)
-- select id, 'Gonx4' from auth.users
-- where lower(email) = lower('REPLACE_WITH_GONX4_GOOGLE_EMAIL')
-- on conflict (username) do update set user_id = excluded.user_id;
--
-- insert into public.catalog_admins (user_id, username)
-- select id, 'onyx' from auth.users
-- where lower(email) = lower('REPLACE_WITH_ONYX_GOOGLE_EMAIL')
-- on conflict (username) do update set user_id = excluded.user_id;
