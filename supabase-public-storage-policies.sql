-- PixelForge public document publishing bucket
-- Create a bucket named "public-documents" and set it to PUBLIC.
-- Public objects can be downloaded by anyone; writes remain restricted to the Firebase owner UID.
-- Firebase Third-Party Auth must be configured in Supabase for project pixelforge-66f0c.
-- Never place a Supabase service-role key in browser code.

-- Public read is provided by the bucket's PUBLIC setting.
-- Allow visitors to list only objects in the public library bucket.
create policy "PixelForge public list documents"
on storage.objects
as permissive
for select
to anon, authenticated
using (bucket_id = 'public-documents');

-- These policies restrict authenticated object mutations to the single owner identity.

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
