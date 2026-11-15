-- PixelForge Phase 19: private tags for documents in the Private Vault.
-- Tags are stored separately from file bytes and remain private until explicitly published.
create table if not exists public.pixel_forge_private_document_tags (
  owner_uid text not null,
  storage_path text not null,
  tags text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  primary key (owner_uid, storage_path),
  constraint pixel_forge_private_document_tags_owner_path_check
    check (storage_path like owner_uid || '/%' and length(storage_path) <= 512),
  constraint pixel_forge_private_document_tags_max_tags_check
    check (cardinality(tags) <= 10)
);

create index if not exists pixel_forge_private_document_tags_owner_idx
  on public.pixel_forge_private_document_tags (owner_uid);

alter table public.pixel_forge_private_document_tags enable row level security;
revoke all on public.pixel_forge_private_document_tags from public, anon, authenticated;
grant all on public.pixel_forge_private_document_tags to service_role;
