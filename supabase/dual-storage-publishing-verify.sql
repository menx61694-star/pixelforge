-- Read-only checks for the dual-storage publishing migration.
select to_regclass('public.pixel_forge_published_documents') as published_documents_table;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'pixel_forge_published_documents'
order by indexname;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'pixel_forge_published_documents'
order by policyname;

select
  count(*) filter (where source = 'google_drive' and published) as published_drive_references,
  count(*) filter (where source = 'supabase' and published) as published_supabase_references
from public.pixel_forge_published_documents;
