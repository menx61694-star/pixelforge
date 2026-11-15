-- Optional browser location sharing fields for restricted PixelForge Security Logs.
-- Coordinates are written only after the visitor grants browser location permission
-- and confirms the separate sharing consent dialog.
alter table public.pixel_forge_security_logs
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_source text;

alter table public.pixel_forge_security_logs
  drop constraint if exists pixel_forge_security_logs_location_latitude_check,
  add constraint pixel_forge_security_logs_location_latitude_check
    check (location_latitude is null or location_latitude between -90 and 90),
  drop constraint if exists pixel_forge_security_logs_location_longitude_check,
  add constraint pixel_forge_security_logs_location_longitude_check
    check (location_longitude is null or location_longitude between -180 and 180),
  drop constraint if exists pixel_forge_security_logs_location_accuracy_check,
  add constraint pixel_forge_security_logs_location_accuracy_check
    check (location_accuracy_m is null or location_accuracy_m between 0 and 100000);

comment on column public.pixel_forge_security_logs.location_latitude is
  'Visitor-shared latitude; recorded only after explicit browser permission and consent.';
comment on column public.pixel_forge_security_logs.location_longitude is
  'Visitor-shared longitude; recorded only after explicit browser permission and consent.';
comment on column public.pixel_forge_security_logs.location_accuracy_m is
  'Browser-reported location accuracy in metres.';
comment on column public.pixel_forge_security_logs.location_source is
  'Source marker for explicitly consented browser geolocation.';
