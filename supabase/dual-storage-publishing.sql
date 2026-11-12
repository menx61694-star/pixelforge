-- Dual-storage publishing: Drive documents are published by reference, while
-- Supabase Vault documents continue using public-documents object storage.
create table if not exists public.pixel_forge_published_documents (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('google_drive','supabase')),
  owner_uid text not null,
  drive_file_id text,
  storage_path text,
  category text not null check (category in ('pdf-documents','study-notes','books-resources','other-documents','exam-materials','technology-guides')),
  title text not null,
  mime_type text not null,
  size_bytes bigint,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pixel_forge_published_source_reference check (
    (source = 'google_drive' and drive_file_id is not null and storage_path is null)
    or (source = 'supabase' and storage_path is not null and drive_file_id is null)
  )
);

create unique index if not exists pixel_forge_published_drive_file_unique
  on public.pixel_forge_published_documents (source, drive_file_id);
create unique index if not exists pixel_forge_published_storage_path_unique
  on public.pixel_forge_published_documents (source, storage_path);
create index if not exists pixel_forge_published_documents_public_idx
  on public.pixel_forge_published_documents (published, category, updated_at desc);

alter table public.pixel_forge_published_documents enable row level security;
revoke all on public.pixel_forge_published_documents from anon, authenticated;
grant select, insert, update, delete on public.pixel_forge_published_documents to authenticated;
grant all on public.pixel_forge_published_documents to service_role;

drop policy if exists "PixelForge published documents owner read" on public.pixel_forge_published_documents;
create policy "PixelForge published documents owner read"
on public.pixel_forge_published_documents for select to authenticated
using (owner_uid = (select auth.jwt() ->> 'sub') and public.pixel_forge_has_permission('vault.read'));

drop policy if exists "PixelForge published documents owner insert" on public.pixel_forge_published_documents;
create policy "PixelForge published documents owner insert"
on public.pixel_forge_published_documents for insert to authenticated
with check (owner_uid = (select auth.jwt() ->> 'sub') and public.pixel_forge_has_permission('vault.publish'));

drop policy if exists "PixelForge published documents owner update" on public.pixel_forge_published_documents;
create policy "PixelForge published documents owner update"
on public.pixel_forge_published_documents for update to authenticated
using (owner_uid = (select auth.jwt() ->> 'sub') and public.pixel_forge_has_permission('vault.publish'))
with check (owner_uid = (select auth.jwt() ->> 'sub') and public.pixel_forge_has_permission('vault.publish'));

drop policy if exists "PixelForge published documents owner delete" on public.pixel_forge_published_documents;
create policy "PixelForge published documents owner delete"
on public.pixel_forge_published_documents for delete to authenticated
using (owner_uid = (select auth.jwt() ->> 'sub') and public.pixel_forge_has_permission('vault.publish'));

comment on table public.pixel_forge_published_documents is
  'Published document index. Google Drive rows reference the original Drive file; Supabase rows reference public-documents objects.';
