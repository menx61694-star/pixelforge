-- PixelForge Phase 2: role registry and permission enforcement.
-- Apply manually in Supabase SQL Editor after reviewing this migration.
-- Firebase Authentication remains the identity provider; this table is the app's
-- authoritative role registry. Client roles are never trusted.

create table if not exists public.pixel_forge_users (
  uid text primary key,
  email text,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.pixel_forge_role_permissions (
  role text not null check (role in ('admin', 'editor', 'viewer')),
  permission text not null,
  allowed boolean not null default false,
  primary key (role, permission)
);

alter table public.pixel_forge_users enable row level security;
alter table public.pixel_forge_role_permissions enable row level security;
revoke all on public.pixel_forge_users from anon, authenticated;
revoke all on public.pixel_forge_role_permissions from anon, authenticated;
grant all on public.pixel_forge_users to service_role;
grant all on public.pixel_forge_role_permissions to service_role;

insert into public.pixel_forge_users (uid, email, role, status)
values ('5PcOkyDEcNc1puSeB2lQ6dLFVOF2', null, 'admin', 'active')
on conflict (uid) do nothing;

insert into public.pixel_forge_role_permissions (role, permission, allowed) values
('admin','dashboard.view',true),('admin','activity.view',true),('admin','vault.read',true),('admin','vault.write',true),('admin','vault.delete',true),('admin','vault.publish',true),('admin','drive.read',true),('admin','drive.write',true),('admin','drive.delete',true),('admin','users.manage',true),('admin','roles.manage',true),
('editor','dashboard.view',true),('editor','activity.view',true),('editor','vault.read',true),('editor','vault.write',true),('editor','vault.delete',false),('editor','vault.publish',true),('editor','drive.read',true),('editor','drive.write',true),('editor','drive.delete',false),('editor','users.manage',false),('editor','roles.manage',false),
('viewer','dashboard.view',true),('viewer','activity.view',true),('viewer','vault.read',true),('viewer','vault.write',false),('viewer','vault.delete',false),('viewer','vault.publish',false),('viewer','drive.read',true),('viewer','drive.write',false),('viewer','drive.delete',false),('viewer','users.manage',false),('viewer','roles.manage',false)
on conflict (role, permission) do nothing;

create or replace function public.pixel_forge_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pixel_forge_users u
    join public.pixel_forge_role_permissions rp on rp.role = u.role
    where u.uid = (select auth.jwt() ->> 'sub')
      and u.status = 'active'
      and rp.permission = p_permission
      and rp.allowed = true
      and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
      and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
  );
$$;

create or replace function public.pixel_forge_user_can_manage(p_target_uid text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.pixel_forge_has_permission('users.manage')
    and p_target_uid <> '5PcOkyDEcNc1puSeB2lQ6dLFVOF2';
$$;

revoke all on function public.pixel_forge_has_permission(text) from public, anon, authenticated;
revoke all on function public.pixel_forge_user_can_manage(text) from public, anon, authenticated;
grant execute on function public.pixel_forge_has_permission(text) to anon, authenticated, service_role;
grant execute on function public.pixel_forge_user_can_manage(text) to service_role;

-- Add role-aware permissive policies. Existing restrictive owner policies are
-- replaced below, so both the permissive and restrictive sides enforce roles.
drop policy if exists "PixelForge role select private documents" on storage.objects;
create policy "PixelForge role select private documents" on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'private-documents'
  and public.pixel_forge_has_permission('vault.read')
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "PixelForge role insert private documents" on storage.objects;
create policy "PixelForge role insert private documents" on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'private-documents'
  and public.pixel_forge_has_permission('vault.write')
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "PixelForge role update private documents" on storage.objects;
create policy "PixelForge role update private documents" on storage.objects
for update to anon, authenticated
using (
  bucket_id = 'private-documents'
  and public.pixel_forge_has_permission('vault.write')
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
)
with check (
  bucket_id = 'private-documents'
  and public.pixel_forge_has_permission('vault.write')
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);

drop policy if exists "PixelForge role delete private documents" on storage.objects;
create policy "PixelForge role delete private documents" on storage.objects
for delete to anon, authenticated
using (
  bucket_id = 'private-documents'
  and public.pixel_forge_has_permission('vault.delete')
  and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
);


-- Public library writes are limited to each user's own published object namespace.
drop policy if exists "PixelForge role insert public documents" on storage.objects;
create policy "PixelForge role insert public documents" on storage.objects
for insert to anon, authenticated
with check (
  bucket_id = 'public-documents'
  and public.pixel_forge_has_permission('vault.publish')
  and split_part(name, '/', 2) like ((select auth.jwt() ->> 'sub') || '-%')
);

drop policy if exists "PixelForge role update public documents" on storage.objects;
create policy "PixelForge role update public documents" on storage.objects
for update to anon, authenticated
using (
  bucket_id = 'public-documents'
  and public.pixel_forge_has_permission('vault.publish')
  and split_part(name, '/', 2) like ((select auth.jwt() ->> 'sub') || '-%')
)
with check (
  bucket_id = 'public-documents'
  and public.pixel_forge_has_permission('vault.publish')
  and split_part(name, '/', 2) like ((select auth.jwt() ->> 'sub') || '-%')
);

drop policy if exists "PixelForge role delete public documents" on storage.objects;
create policy "PixelForge role delete public documents" on storage.objects
for delete to anon, authenticated
using (
  bucket_id = 'public-documents'
  and public.pixel_forge_has_permission('vault.publish')
  and split_part(name, '/', 2) like ((select auth.jwt() ->> 'sub') || '-%')
);

-- Restrictive policies make sure old owner-only policies cannot accidentally
-- grant access outside the role registry. Public documents stay publicly readable.
alter policy "PixelForge owner restrict select private documents"
on storage.objects using (
  bucket_id = 'public-documents'
  or (
    bucket_id = 'private-documents'
    and public.pixel_forge_has_permission('vault.read')
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub')
  )
);

alter policy "PixelForge owner restrict insert private documents"
on storage.objects with check (
  bucket_id in ('private-documents','public-documents')
  and (
    (bucket_id = 'private-documents'
      and public.pixel_forge_has_permission('vault.write')
      and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'))
    or
    (bucket_id = 'public-documents'
      and public.pixel_forge_has_permission('vault.publish')
      and split_part(name, '/', 2) like (select auth.jwt() ->> 'sub') || '-%')
  )
);

alter policy "PixelForge owner restrict update private documents"
on storage.objects using (
  (bucket_id = 'private-documents'
    and public.pixel_forge_has_permission('vault.write')
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'))
  or
  (bucket_id = 'public-documents'
    and public.pixel_forge_has_permission('vault.publish')
    and split_part(name, '/', 2) like (select auth.jwt() ->> 'sub') || '-%')
)
with check (
  (bucket_id = 'private-documents'
    and public.pixel_forge_has_permission('vault.write')
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'))
  or
  (bucket_id = 'public-documents'
    and public.pixel_forge_has_permission('vault.publish')
    and split_part(name, '/', 2) like (select auth.jwt() ->> 'sub') || '-%')
);

alter policy "PixelForge owner restrict delete private documents"
on storage.objects using (
  (bucket_id = 'private-documents'
    and public.pixel_forge_has_permission('vault.delete')
    and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'))
  or
  (bucket_id = 'public-documents'
    and public.pixel_forge_has_permission('vault.publish')
    and split_part(name, '/', 2) like (select auth.jwt() ->> 'sub') || '-%')
);

-- The owner is immutable and cannot be demoted/deleted by the API.
create or replace function public.pixel_forge_protect_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_active_admins integer;
begin
  -- Serialize admin changes so concurrent requests cannot remove the last admin.
  perform pg_advisory_xact_lock(73190521);

  if old.uid = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2' then
    raise exception 'The PixelForge owner account cannot be changed or removed';
  end if;

  if old.role = 'admin'
     and old.status = 'active'
     and (tg_op = 'DELETE' or (new.role <> 'admin' or new.status <> 'active')) then
    select count(*) into v_active_admins
    from public.pixel_forge_users
    where role = 'admin' and status = 'active';
    if v_active_admins <= 1 then
      raise exception 'The last active administrator cannot be demoted or suspended';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists pixel_forge_protect_owner_trigger on public.pixel_forge_users;
create trigger pixel_forge_protect_owner_trigger
before update or delete on public.pixel_forge_users
for each row execute function public.pixel_forge_protect_owner();
