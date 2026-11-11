-- PixelForge public document publishing policies (non-DROP migration)
-- Verified precondition from Supabase dashboard: these four existing restrictive
-- private policies exist, and no public-documents policies exist yet.
-- Run this script ONCE. It alters existing private restrictive policies in-place,
-- preserving their names and policy objects, then adds public-bucket policies.
--
-- Result:
--   public-documents: public SELECT; owner-only INSERT/UPDATE/DELETE.
--   private-documents: owner-only SELECT/INSERT/UPDATE/DELETE.
-- Firebase Third-Party Auth must be configured for pixelforge-66f0c.
-- Never put a Supabase service-role key in frontend code.

-- SELECT: permit public listing while retaining owner-only access to private objects.
alter policy "PixelForge owner restrict select private documents"
on storage.objects
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

-- INSERT: existing private restrictive policy now accepts either bucket,
-- but still requires the exact owner Firebase identity.
alter policy "PixelForge owner restrict insert private documents"
on storage.objects
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

-- UPDATE: extend existing private restrictive rule without weakening owner checks.
alter policy "PixelForge owner restrict update private documents"
on storage.objects
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

-- DELETE: extend existing private restrictive rule, still requiring owner identity.
alter policy "PixelForge owner restrict delete private documents"
on storage.objects
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
