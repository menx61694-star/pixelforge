-- PixelForge public document publishing bucket policies
-- Prerequisites:
--   1. public-documents exists and is configured as PUBLIC.
--   2. Firebase Third-Party Auth is configured in Supabase for pixelforge-66f0c.
-- Security model:
--   - Anyone may list/read objects in public-documents.
--   - Only the PixelForge owner Firebase UID may insert/update/delete public objects.
--   - private-documents remains owner-only for every operation.
-- Never place a Supabase service-role key in browser code.

-- Shared owner-identity predicate is repeated inline because Storage policies
-- evaluate against storage.objects and must remain explicit.

-- Remove policies created by earlier versions of this public-bucket script.
drop policy if exists "PixelForge public list documents" on storage.objects;
drop policy if exists "PixelForge owner insert public documents" on storage.objects;
drop policy if exists "PixelForge owner restrict insert public documents" on storage.objects;
drop policy if exists "PixelForge owner update public documents" on storage.objects;
drop policy if exists "PixelForge owner restrict update public documents" on storage.objects;
drop policy if exists "PixelForge owner delete public documents" on storage.objects;
drop policy if exists "PixelForge owner restrict delete public documents" on storage.objects;

-- SELECT:
-- Public bucket objects are readable/listable by visitors.
-- Private bucket objects are visible only to the configured Firebase owner.
drop policy if exists "PixelForge owner restrict select private documents" on storage.objects;
create policy "PixelForge owner restrict select private documents"
on storage.objects
as restrictive
for select
to anon, authenticated
using (
  bucket_id = 'public-documents'
  or (
    bucket_id = 'private-documents'
    and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
    and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
    and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
  )
);

create policy "PixelForge public list documents"
on storage.objects
as permissive
for select
to anon, authenticated
using (bucket_id = 'public-documents');

-- INSERT:
-- Preserve private owner-only restriction while allowing the same owner to
-- publish into public-documents.
drop policy if exists "PixelForge owner restrict insert private documents" on storage.objects;
create policy "PixelForge owner restrict insert private documents"
on storage.objects
as restrictive
for insert
to anon, authenticated
with check (
  bucket_id in ('private-documents', 'public-documents')
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner insert public documents"
on storage.objects
as permissive
for insert
to anon, authenticated
with check (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner restrict insert public documents"
on storage.objects
as restrictive
for insert
to anon, authenticated
with check (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

-- UPDATE:
-- Both USING and WITH CHECK enforce the owner identity and bucket boundary.
drop policy if exists "PixelForge owner restrict update private documents" on storage.objects;
create policy "PixelForge owner restrict update private documents"
on storage.objects
as restrictive
for update
to anon, authenticated
using (
  bucket_id in ('private-documents', 'public-documents')
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
)
with check (
  bucket_id in ('private-documents', 'public-documents')
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner update public documents"
on storage.objects
as permissive
for update
to anon, authenticated
using (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
)
with check (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner restrict update public documents"
on storage.objects
as restrictive
for update
to anon, authenticated
using (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
)
with check (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

-- DELETE:
drop policy if exists "PixelForge owner restrict delete private documents" on storage.objects;
create policy "PixelForge owner restrict delete private documents"
on storage.objects
as restrictive
for delete
to anon, authenticated
using (
  bucket_id in ('private-documents', 'public-documents')
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner delete public documents"
on storage.objects
as permissive
for delete
to anon, authenticated
using (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner restrict delete public documents"
on storage.objects
as restrictive
for delete
to anon, authenticated
using (
  bucket_id = 'public-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);
