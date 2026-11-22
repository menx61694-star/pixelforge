-- PixelForge security logs: add explicit-consent location columns used by analytics Edge Function.
-- Safe to re-run; existing logs retain NULL location values.
alter table public.pixel_forge_security_logs
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_source text;

alter table public.pixel_forge_security_logs
  drop constraint if exists pixel_forge_security_logs_location_bounds_check;
alter table public.pixel_forge_security_logs
  add constraint pixel_forge_security_logs_location_bounds_check
  check (
    (location_latitude is null and location_longitude is null and location_accuracy_m is null and location_source is null)
    or
    (location_latitude between -90 and 90
      and location_longitude between -180 and 180
      and location_accuracy_m between 0 and 100000
      and location_source = 'browser-geolocation-explicit-consent')
  );

comment on column public.pixel_forge_security_logs.location_latitude is
  'Latitude recorded only after explicit browser location consent.';
comment on column public.pixel_forge_security_logs.location_longitude is
  'Longitude recorded only after explicit browser location consent.';
comment on column public.pixel_forge_security_logs.location_accuracy_m is
  'Browser-reported location accuracy in meters after explicit consent.';
comment on column public.pixel_forge_security_logs.location_source is
  'Source marker for explicitly consented browser geolocation.';
