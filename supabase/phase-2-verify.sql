-- PixelForge Phase 2 post-migration verification.
-- Read-only: safe to run after phase-2-users-roles.sql.
-- Run this file only after the migration reports success.

-- 1) Both role registry tables must exist.
select
  to_regclass('public.pixel_forge_users') as users_table,
  to_regclass('public.pixel_forge_role_permissions') as permissions_table;

-- 2) Owner must exist and remain active Admin.
select uid, email, role, status
from public.pixel_forge_users
where uid = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2';

-- 3) All three built-in roles must have permission records.
select role, count(*) as permission_count
from public.pixel_forge_role_permissions
group by role
order by role;

-- 4) The role-aware Storage policies expected from this migration.
select policyname, cmd, permissive
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'PixelForge role%'
order by policyname;

-- 5) The restrictive policies must still exist after alteration.
select policyname, cmd, permissive
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'PixelForge owner restrict select private documents',
    'PixelForge owner restrict insert private documents',
    'PixelForge owner restrict update private documents',
    'PixelForge owner restrict delete private documents'
  )
order by policyname;

-- 6) Owner-protection trigger must be installed and enabled.
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.pixel_forge_users'::regclass
  and tgname = 'pixel_forge_protect_owner_trigger'
  and not tgisinternal;
