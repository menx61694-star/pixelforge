-- PixelForge private document bucket policies
-- Prerequisite: create a PRIVATE bucket named "private-documents" in Supabase Storage.
-- Firebase Auth is the identity provider. Firebase ID tokens are validated by the
-- Supabase Firebase third-party auth integration.
-- Firebase tokens without a custom "role":"authenticated" claim map to Postgres "anon".
-- These policies intentionally target anon and independently verify Firebase issuer,
-- audience, and the one authorized Firebase UID. Never make this bucket public.

create policy "PixelForge admin can list and download private documents"
on storage.objects
for select
to anon
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge admin can upload private documents"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);

create policy "PixelForge admin can delete private documents"
on storage.objects
for delete
to anon
using (
  bucket_id = 'private-documents'
  and (select auth.jwt() ->> 'sub') = '5PcOkyDEcNc1puSeB2lQ6dLFVOF2'
  and (select auth.jwt() ->> 'iss') = 'https://securetoken.google.com/pixelforge-66f0c'
  and (select auth.jwt() ->> 'aud') = 'pixelforge-66f0c'
);
