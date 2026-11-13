-- PixelForge Phase 5, Step 2: centralized site settings foundation.
-- Apply manually in the Supabase SQL Editor. Safe to re-run.
-- Values are configuration only: never store API keys, OAuth tokens, or secrets here.

create table if not exists public.pixel_forge_site_settings (
  setting_key text primary key check (setting_key in (
    'site.name',
    'site.description',
    'site.contact_email',
    'maintenance.enabled',
    'maintenance.message',
    'sync.drive.auto_enabled',
    'sync.vault.auto_enabled'
  )),
  setting_value jsonb not null,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  constraint pixel_forge_site_settings_value_type check (
    case setting_key
      when 'site.name' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') between 1 and 80
      when 'site.description' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') <= 300
      when 'site.contact_email' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') <= 254
      when 'maintenance.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'maintenance.message' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') <= 500
      when 'sync.drive.auto_enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'sync.vault.auto_enabled' then jsonb_typeof(setting_value) = 'boolean'
      else false
    end
  )
);

create table if not exists public.pixel_forge_site_settings_audit (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  old_value jsonb,
  new_value jsonb not null,
  actor_uid text not null,
  created_at timestamptz not null default now()
);
create index if not exists pixel_forge_site_settings_audit_created_idx
  on public.pixel_forge_site_settings_audit (created_at desc);
create index if not exists pixel_forge_site_settings_audit_key_created_idx
  on public.pixel_forge_site_settings_audit (setting_key, created_at desc);

alter table public.pixel_forge_site_settings enable row level security;
alter table public.pixel_forge_site_settings_audit enable row level security;
revoke all on public.pixel_forge_site_settings from public, anon, authenticated;
revoke all on public.pixel_forge_site_settings_audit from public, anon, authenticated;
grant all on public.pixel_forge_site_settings to service_role;
grant all on public.pixel_forge_site_settings_audit to service_role;

insert into public.pixel_forge_site_settings (setting_key, setting_value, updated_by) values
  ('site.name', to_jsonb('PixelForge'::text), 'system'),
  ('site.description', to_jsonb('A private workspace for published documents and resources.'::text), 'system'),
  ('site.contact_email', to_jsonb(''::text), 'system'),
  ('maintenance.enabled', 'false'::jsonb, 'system'),
  ('maintenance.message', to_jsonb('We are performing scheduled maintenance. Please check back soon.'::text), 'system'),
  ('sync.drive.auto_enabled', 'false'::jsonb, 'system'),
  ('sync.vault.auto_enabled', 'false'::jsonb, 'system')
on conflict (setting_key) do nothing;

insert into public.pixel_forge_role_permissions (role, permission, allowed) values
  ('admin', 'settings.view', true),
  ('admin', 'settings.manage', true),
  ('editor', 'settings.view', false),
  ('editor', 'settings.manage', false),
  ('viewer', 'settings.view', false),
  ('viewer', 'settings.manage', false)
on conflict (role, permission) do update set allowed = excluded.allowed;

create or replace function public.pixel_forge_update_site_setting(
  p_key text,
  p_value jsonb,
  p_actor_uid text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_value jsonb;
  v_updated_at timestamptz;
  v_valid boolean;
begin
  if p_actor_uid is null or length(p_actor_uid) < 1 or length(p_actor_uid) > 128 then
    raise exception 'Invalid actor';
  end if;

  v_valid := case p_key
    when 'site.name' then jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 1 and 80
    when 'site.description' then jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') <= 300
    when 'site.contact_email' then jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') <= 254
    when 'maintenance.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'maintenance.message' then jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') <= 500
    when 'sync.drive.auto_enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'sync.vault.auto_enabled' then jsonb_typeof(p_value) = 'boolean'
    else false
  end;
  if coalesce(v_valid, false) is not true then
    raise exception 'Invalid site setting key or value';
  end if;

  select setting_value into v_old_value
  from public.pixel_forge_site_settings
  where setting_key = p_key
  for update;

  update public.pixel_forge_site_settings
  set setting_value = p_value, updated_by = p_actor_uid, updated_at = now()
  where setting_key = p_key
  returning updated_at into v_updated_at;

  if not found then
    raise exception 'Site setting has not been initialized';
  end if;

  insert into public.pixel_forge_site_settings_audit
    (setting_key, old_value, new_value, actor_uid)
  values (p_key, v_old_value, p_value, p_actor_uid);

  return v_updated_at;
end;
$$;
revoke all on function public.pixel_forge_update_site_setting(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.pixel_forge_update_site_setting(text, jsonb, text) to service_role;

comment on table public.pixel_forge_site_settings is
  'PixelForge non-secret website configuration. Access only through the authenticated site-settings Edge Function.';
comment on table public.pixel_forge_site_settings_audit is
  'Append-only audit history for site setting changes; access only through the authenticated site-settings Edge Function.';
