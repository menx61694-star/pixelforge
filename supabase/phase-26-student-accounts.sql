-- PixelForge student accounts are separate from the admin role registry.
-- Apply manually in Supabase SQL Editor after review.
create table if not exists public.pixel_forge_students (
  uid text primary key check (char_length(uid) between 1 and 128),
  email text not null,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pixel_forge_students_created_idx
  on public.pixel_forge_students (created_at desc);
alter table public.pixel_forge_students enable row level security;
revoke all on public.pixel_forge_students from public, anon, authenticated;
grant all on public.pixel_forge_students to service_role;
comment on table public.pixel_forge_students is
  'Public student accounts. Deliberately separate from pixel_forge_users admin/editor/viewer role registry; all access is through the verified user-management Edge Function.';
