-- PixelForge analytics/security-log compatibility repair.
-- Adds columns expected by the deployed analytics Edge Function when older
-- security-log schemas are present. Safe to run repeatedly.
alter table if exists public.pixel_forge_security_logs
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_source text;
