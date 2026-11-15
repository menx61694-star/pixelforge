-- PixelForge Phase 18: custom searchable tags for published public documents.
-- Existing records remain valid and receive an empty tag list.
alter table public.pixel_forge_published_documents
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists pixel_forge_published_documents_tags_gin_idx
  on public.pixel_forge_published_documents using gin (tags);
