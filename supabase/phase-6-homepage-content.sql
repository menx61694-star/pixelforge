-- PixelForge Phase 6: admin-managed public homepage knowledge section.
-- Apply once in Supabase SQL Editor. Existing settings and audit records are preserved.
alter table public.pixel_forge_site_settings
  drop constraint if exists pixel_forge_site_settings_setting_key_check;
alter table public.pixel_forge_site_settings
  add constraint pixel_forge_site_settings_setting_key_check check (setting_key in (
    'site.name','site.description','site.contact_email','maintenance.enabled',
    'maintenance.message','sync.drive.auto_enabled','sync.vault.auto_enabled',
    'home.knowledge.enabled','home.knowledge.items'
  ));

alter table public.pixel_forge_site_settings
  drop constraint if exists pixel_forge_site_settings_value_type;
alter table public.pixel_forge_site_settings
  add constraint pixel_forge_site_settings_value_type check (
    case setting_key
      when 'site.name' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') between 1 and 80
      when 'site.description' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') <= 300
      when 'site.contact_email' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') <= 254
      when 'maintenance.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'maintenance.message' then jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') <= 500
      when 'sync.drive.auto_enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'sync.vault.auto_enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.knowledge.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.knowledge.items' then
        case when jsonb_typeof(setting_value) = 'array' and jsonb_array_length(setting_value) <= 50 then
          not exists (
            select 1 from jsonb_array_elements(setting_value) as item(value)
            where jsonb_typeof(item.value) <> 'object'
              or jsonb_typeof(item.value->'category') <> 'string'
              or length(item.value->>'category') > 32
              or jsonb_typeof(item.value->'text') <> 'string'
              or length(trim(item.value->>'text')) < 8
              or length(item.value->>'text') > 240
          )
        else false end
      else false
    end
  );

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
    when 'home.knowledge.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.knowledge.items' then
      case when jsonb_typeof(p_value) = 'array' and jsonb_array_length(p_value) <= 50 then
        not exists (
          select 1 from jsonb_array_elements(p_value) as item(value)
          where jsonb_typeof(item.value) <> 'object'
            or jsonb_typeof(item.value->'category') <> 'string'
            or length(item.value->>'category') > 32
            or jsonb_typeof(item.value->'text') <> 'string'
            or length(trim(item.value->>'text')) < 8
            or length(item.value->>'text') > 240
        )
      else false end
    else false
  end;
  if coalesce(v_valid, false) is not true then
    raise exception 'Invalid site setting key or value';
  end if;

  select setting_value into v_old_value from public.pixel_forge_site_settings
  where setting_key = p_key for update;

  update public.pixel_forge_site_settings
  set setting_value = p_value, updated_by = p_actor_uid, updated_at = now()
  where setting_key = p_key returning updated_at into v_updated_at;

  if not found then raise exception 'Site setting has not been initialized'; end if;

  insert into public.pixel_forge_site_settings_audit
    (setting_key, old_value, new_value, actor_uid)
  values (p_key, v_old_value, p_value, p_actor_uid);
  return v_updated_at;
end;
$$;
revoke all on function public.pixel_forge_update_site_setting(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.pixel_forge_update_site_setting(text, jsonb, text) to service_role;

insert into public.pixel_forge_site_settings (setting_key, setting_value, updated_by) values
  ('home.knowledge.enabled', 'true'::jsonb, 'system'),
  ('home.knowledge.items', '[]'::jsonb, 'system')
on conflict (setting_key) do nothing;
