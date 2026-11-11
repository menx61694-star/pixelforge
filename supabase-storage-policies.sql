-- PixelForge private document bucket policies
-- Create a PRIVATE Supabase Storage bucket named "private-documents" first.
-- Firebase project: pixelforge-66f0c
-- Only the one owner UID below may access objects in this bucket.
-- Policies target both default Firebase "anon" JWTs and future "authenticated" JWTs.
-- No public bucket access. Never add service-role credentials to frontend code.

-- SELECT: list/download
create policy "PixelForge owner select private documents"
on storage.objects
as permissive
for select
to anon, authenticated
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner restrict select private documents"
on storage.objects
as restrictive
for select
to anon, authenticated
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

-- INSERT: upload new objects
create policy "PixelForge owner insert private documents"
on storage.objects
as permissive
for insert
to anon, authenticated
with check (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner restrict insert private documents"
on storage.objects
as restrictive
for insert
to anon, authenticated
with check (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

-- UPDATE: replace existing objects only as the owner
create policy "PixelForge owner update private documents"
on storage.objects
as permissive
for update
to anon, authenticated
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
)
with check (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner restrict update private documents"
on storage.objects
as restrictive
for update
to anon, authenticated
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
)
with check (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

-- DELETE: owner only
create policy "PixelForge owner delete private documents"
on storage.objects
as permissive
for delete
to anon, authenticated
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge owner restrict delete private documents"
on storage.objects
as restrictive
for delete
to anon, authenticated
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);
