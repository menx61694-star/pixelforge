-- PixelForge Phase 13: public feedback with admin moderation.
-- Apply once in Supabase SQL Editor. Existing settings and audit records are preserved.
alter table public.pixel_forge_site_settings
  drop constraint if exists pixel_forge_site_settings_setting_key_check;
alter table public.pixel_forge_site_settings
  add constraint pixel_forge_site_settings_setting_key_check check (setting_key in (
    'site.name','site.description','site.contact_email','maintenance.enabled',
    'maintenance.message','sync.drive.auto_enabled','sync.vault.auto_enabled',
  'home.library.pdf_preview_enabled',
    'home.knowledge.enabled','home.knowledge.items',
    'home.quiz.enabled','home.quiz.items',
    'home.tools.enabled','home.tools.items',
    'home.featured.enabled','home.featured.items',
    'home.announcements.enabled','home.announcements.items',
    'home.search.enabled','home.search.smart_enabled','home.search.filters_enabled',
    'home.search.max_results','home.search.placeholder',
    'home.learning.enabled','home.learning.items',
    'home.feedback.enabled','home.feedback.categories','home.feedback.allow_anonymous',
    'home.feedback.display_approved','home.feedback.max_display'
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
      when 'home.library.pdf_preview_enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.knowledge.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.knowledge.items' then
        case when jsonb_typeof(setting_value) = 'array'
          then jsonb_array_length(setting_value) <= 50
          else false
        end
      when 'home.quiz.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.quiz.items' then
        case when jsonb_typeof(setting_value) = 'array'
          then jsonb_array_length(setting_value) <= 100
          else false
        end
      when 'home.tools.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.tools.items' then
        case when jsonb_typeof(setting_value) = 'array'
          then jsonb_array_length(setting_value) <= 4
          else false
        end
      when 'home.featured.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.featured.items' then
        case when jsonb_typeof(setting_value) = 'array'
          then jsonb_array_length(setting_value) <= 12
          else false
        end
      when 'home.announcements.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.announcements.items' then
        case when jsonb_typeof(setting_value) = 'array'
          then jsonb_array_length(setting_value) <= 20
          else false
        end
      when 'home.search.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.search.smart_enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.search.filters_enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.search.max_results' then
        jsonb_typeof(setting_value) = 'number' and (setting_value #>> '{}') ~ '^[0-9]+$'
        and (setting_value #>> '{}')::integer between 6 and 100
      when 'home.search.placeholder' then
        jsonb_typeof(setting_value) = 'string' and length(setting_value #>> '{}') between 5 and 100
      when 'home.learning.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.learning.items' then
        case when jsonb_typeof(setting_value) = 'array'
          then jsonb_array_length(setting_value) <= 12
          else false
        end
      when 'home.feedback.enabled' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.feedback.allow_anonymous' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.feedback.display_approved' then jsonb_typeof(setting_value) = 'boolean'
      when 'home.feedback.categories' then
        case when jsonb_typeof(setting_value) = 'array' then
          jsonb_array_length(setting_value) between 1 and 8
        else false end
      when 'home.feedback.max_display' then
        jsonb_typeof(setting_value) = 'number' and (setting_value #>> '{}') ~ '^[0-9]+$'
        and (setting_value #>> '{}')::integer between 1 and 12
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
    when 'home.library.pdf_preview_enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.knowledge.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.knowledge.items' then
      case when jsonb_typeof(p_value) = 'array' then
        case when jsonb_array_length(p_value) <= 50 then
        not exists (
          select 1 from jsonb_array_elements(p_value) as item(value)
          where jsonb_typeof(item.value) <> 'object'
            or not (item.value ? 'category')
              or jsonb_typeof(item.value->'category') <> 'string'
            or length(item.value->>'category') > 32
            or not (item.value ? 'text')
              or jsonb_typeof(item.value->'text') <> 'string'
            or length(trim(item.value->>'text')) < 8
            or length(item.value->>'text') > 240
        )
        else false end
      else false end
    when 'home.quiz.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.quiz.items' then
      case when jsonb_typeof(p_value) = 'array' then
        case when jsonb_array_length(p_value) <= 100 then
          not exists (
            select 1 from jsonb_array_elements(p_value) as item(value)
            where jsonb_typeof(item.value) <> 'object'
              or coalesce(jsonb_typeof(item.value->'id'), '') <> 'string'
              or length(trim(coalesce(item.value->>'id', ''))) < 1
              or length(item.value->>'id') > 80
              or coalesce(jsonb_typeof(item.value->'category'), '') <> 'string'
              or length(trim(coalesce(item.value->>'category', ''))) < 1
              or length(item.value->>'category') > 32
              or coalesce(jsonb_typeof(item.value->'publishDate'), '') <> 'string'
              or (item.value->>'publishDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              or coalesce(jsonb_typeof(item.value->'published'), '') <> 'boolean'
              or coalesce(jsonb_typeof(item.value->'question'), '') <> 'string'
              or length(trim(coalesce(item.value->>'question', ''))) < 10
              or length(item.value->>'question') > 500
              or case when jsonb_typeof(item.value->'options') = 'array'
                   then jsonb_array_length(item.value->'options') <> 4
                   else true end
              or case when jsonb_typeof(item.value->'options') = 'array'
                   then exists (
                     select 1 from jsonb_array_elements(item.value->'options') as option(value)
                     where coalesce(jsonb_typeof(option.value), '') <> 'string'
                       or length(trim(coalesce(option.value #>> '{}', ''))) < 1
                       or length(option.value #>> '{}') > 160
                   )
                   else true end
              or coalesce(jsonb_typeof(item.value->'correctIndex'), '') <> 'number'
              or (item.value->>'correctIndex') !~ '^[0-3]$'
              or coalesce(jsonb_typeof(item.value->'explanation'), '') <> 'string'
              or length(item.value->>'explanation') > 1000
          )
        else false end
      else false end
    when 'home.tools.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.tools.items' then
      case when jsonb_typeof(p_value) = 'array' then
        case when jsonb_array_length(p_value) <= 4 then
          not exists (
            select 1 from jsonb_array_elements(p_value) as tool(value)
            where jsonb_typeof(tool.value) <> 'string'
              or tool.value #>> '{}' not in ('calculator','percentage','word-counter','unit-converter')
          )
          and (select count(*) = count(distinct value)
               from jsonb_array_elements_text(p_value) as entries(value))
        else false end
      else false end
    when 'home.featured.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.featured.items' then
      case when jsonb_typeof(p_value) = 'array' then
        case when jsonb_array_length(p_value) <= 12 then
          not exists (
            select 1 from jsonb_array_elements(p_value) as resource(value)
            where jsonb_typeof(resource.value) <> 'object'
              or not (resource.value ? 'id') or coalesce(jsonb_typeof(resource.value->'id'), '') <> 'string'
              or length(trim(coalesce(resource.value->>'id',''))) < 1 or length(resource.value->>'id') > 64
              or coalesce(jsonb_typeof(resource.value->'title'), '') <> 'string'
              or length(trim(coalesce(resource.value->>'title',''))) < 1 or length(resource.value->>'title') > 100
              or coalesce(jsonb_typeof(resource.value->'description'), '') <> 'string'
              or length(resource.value->>'description') > 240
              or coalesce(jsonb_typeof(resource.value->'category'), '') <> 'string'
              or length(trim(coalesce(resource.value->>'category',''))) < 1 or length(resource.value->>'category') > 40
              or coalesce(jsonb_typeof(resource.value->'url'), '') <> 'string'
              or (resource.value->>'url') !~* '^https://[^[:space:]]+$'
              or length(resource.value->>'url') > 1200
              or coalesce(jsonb_typeof(resource.value->'label'), '') <> 'string'
              or length(trim(coalesce(resource.value->>'label',''))) < 1 or length(resource.value->>'label') > 32
              or coalesce(jsonb_typeof(resource.value->'published'), '') <> 'boolean'
          )
          and (select count(*) = count(distinct resource_id)
               from (select value->>'id' as resource_id from jsonb_array_elements(p_value)) ids)
        else false end
      else false end
    when 'home.announcements.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.announcements.items' then
      case when jsonb_typeof(p_value) = 'array' then
        case when jsonb_array_length(p_value) <= 20 then
          not exists (
            select 1 from jsonb_array_elements(p_value) as notice(value)
            where jsonb_typeof(notice.value) <> 'object'
              or coalesce(jsonb_typeof(notice.value->'id'), '') <> 'string'
              or length(trim(coalesce(notice.value->>'id',''))) < 1 or length(notice.value->>'id') > 64
              or coalesce(jsonb_typeof(notice.value->'title'), '') <> 'string'
              or length(trim(coalesce(notice.value->>'title',''))) < 1 or length(notice.value->>'title') > 120
              or coalesce(jsonb_typeof(notice.value->'message'), '') <> 'string'
              or length(trim(coalesce(notice.value->>'message',''))) < 1 or length(notice.value->>'message') > 500
              or coalesce(jsonb_typeof(notice.value->'type'), '') <> 'string'
              or notice.value->>'type' not in ('info','update','important')
              or coalesce(jsonb_typeof(notice.value->'startDate'), '') <> 'string'
              or (notice.value->>'startDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              or coalesce(jsonb_typeof(notice.value->'endDate'), '') <> 'string'
              or (notice.value->>'endDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              or notice.value->>'startDate' > notice.value->>'endDate'
              or coalesce(jsonb_typeof(notice.value->'published'), '') <> 'boolean'
              or coalesce(jsonb_typeof(notice.value->'url'), '') <> 'string'
              or length(notice.value->>'url') > 1200
              or (notice.value->>'url') <> '' and (notice.value->>'url') !~* '^https://[^[:space:]]+$'
              or coalesce(jsonb_typeof(notice.value->'label'), '') <> 'string'
              or length(notice.value->>'label') > 32
              or ((notice.value->>'url') = '' and (notice.value->>'label') <> '')
              or ((notice.value->>'url') <> '' and length(trim(notice.value->>'label')) < 1)
          )
          and (select count(*) = count(distinct notice_id)
               from (select value->>'id' as notice_id from jsonb_array_elements(p_value)) ids)
        else false end
      else false end
    when 'home.search.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.search.smart_enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.search.filters_enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.search.max_results' then
      jsonb_typeof(p_value) = 'number' and (p_value #>> '{}') ~ '^[0-9]+$'
      and (p_value #>> '{}')::integer between 6 and 100
    when 'home.search.placeholder' then
      jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') between 5 and 100
    when 'home.learning.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.learning.items' then
      case when jsonb_typeof(p_value) = 'array' then
        case when jsonb_array_length(p_value) <= 12 then
          not exists (
            select 1 from jsonb_array_elements(p_value) as path(value)
            where jsonb_typeof(path.value) <> 'object'
              or coalesce(jsonb_typeof(path.value->'id'), '') <> 'string'
              or length(trim(coalesce(path.value->>'id',''))) < 1 or length(path.value->>'id') > 64
              or coalesce(jsonb_typeof(path.value->'title'), '') <> 'string'
              or length(trim(coalesce(path.value->>'title',''))) < 1 or length(path.value->>'title') > 100
              or coalesce(jsonb_typeof(path.value->'description'), '') <> 'string'
              or length(trim(coalesce(path.value->>'description',''))) < 1 or length(path.value->>'description') > 240
              or coalesce(jsonb_typeof(path.value->'topic'), '') <> 'string'
              or length(trim(coalesce(path.value->>'topic',''))) < 1 or length(path.value->>'topic') > 40
              or coalesce(jsonb_typeof(path.value->'level'), '') <> 'string'
              or path.value->>'level' not in ('beginner','intermediate','advanced')
              or coalesce(jsonb_typeof(path.value->'duration'), '') <> 'string'
              or length(path.value->>'duration') > 32
              or coalesce(jsonb_typeof(path.value->'published'), '') <> 'boolean'
              or case when jsonb_typeof(path.value->'steps') = 'array'
                   then jsonb_array_length(path.value->'steps') < 1 or jsonb_array_length(path.value->'steps') > 8
                   else true end
              or case when jsonb_typeof(path.value->'steps') = 'array'
                   then exists (
                     select 1 from jsonb_array_elements(path.value->'steps') as step(value)
                     where jsonb_typeof(step.value) <> 'object'
                       or coalesce(jsonb_typeof(step.value->'title'), '') <> 'string'
                       or length(trim(coalesce(step.value->>'title',''))) < 1
                       or length(step.value->>'title') > 100
                       or coalesce(jsonb_typeof(step.value->'url'), '') <> 'string'
                       or (step.value->>'url') !~* '^https://[^[:space:]]+$'
                       or length(step.value->>'url') > 1200
                   )
                   else true end
          )
          and (select count(*) = count(distinct path_id)
               from (select value->>'id' as path_id from jsonb_array_elements(p_value)) ids)
        else false end
      else false end
    when 'home.feedback.enabled' then jsonb_typeof(p_value) = 'boolean'
    when 'home.feedback.allow_anonymous' then jsonb_typeof(p_value) = 'boolean'
    when 'home.feedback.display_approved' then jsonb_typeof(p_value) = 'boolean'
    when 'home.feedback.categories' then
      case when jsonb_typeof(p_value) = 'array' then
        case when jsonb_array_length(p_value) between 1 and 8 then
          not exists (
            select 1 from jsonb_array_elements(p_value) as category(value)
            where jsonb_typeof(category.value) <> 'string'
              or length(trim(category.value #>> '{}')) < 2
              or length(category.value #>> '{}') > 32
          )
          and (select count(*) = count(distinct lower(category_name))
               from jsonb_array_elements_text(p_value) as entries(category_name))
        else false end
      else false end
    when 'home.feedback.max_display' then
      jsonb_typeof(p_value) = 'number' and (p_value #>> '{}') ~ '^[0-9]+$'
      and (p_value #>> '{}')::integer between 1 and 12
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
  ('home.knowledge.items', jsonb_build_array(
    jsonb_build_object('category','SPACE','text','A day on Venus is longer than its year: Venus takes about 243 Earth days to rotate once, but about 225 Earth days to orbit the Sun.'),
    jsonb_build_object('category','HUMAN BODY','text','Your brain uses roughly 20% of your body’s energy, even though it makes up only about 2% of your body weight.'),
    jsonb_build_object('category','COMPUTING','text','The first computer mouse, built in the 1960s, was made of wood and had just one button.'),
    jsonb_build_object('category','NATURE','text','Octopuses have three hearts: two pump blood to the gills, while one pumps it to the rest of the body.'),
    jsonb_build_object('category','SPACE','text','Light from the Sun takes about 8 minutes and 20 seconds to reach Earth.'),
    jsonb_build_object('category','TECHNOLOGY','text','The word robot comes from the Czech word robota, which refers to forced labour.'),
    jsonb_build_object('category','EARTH','text','Earth is not a perfect sphere; its rotation makes it slightly wider around the equator.'),
    jsonb_build_object('category','BIOLOGY','text','A single human cell contains about two metres of DNA when stretched out.')
  ), 'system'),
  ('home.quiz.enabled', 'false'::jsonb, 'system'),
  ('home.quiz.items', '[]'::jsonb, 'system'),
  ('home.tools.enabled', 'true'::jsonb, 'system'),
  ('home.tools.items', '["calculator","percentage","word-counter","unit-converter"]'::jsonb, 'system'),
  ('home.featured.enabled', 'true'::jsonb, 'system'),
  ('home.featured.items', '[]'::jsonb, 'system'),
  ('home.announcements.enabled', 'true'::jsonb, 'system'),
  ('home.announcements.items', '[]'::jsonb, 'system'),
  ('home.search.enabled', 'true'::jsonb, 'system'),
  ('home.search.smart_enabled', 'true'::jsonb, 'system'),
  ('home.search.filters_enabled', 'true'::jsonb, 'system'),
  ('home.search.max_results', '30'::jsonb, 'system'),
  ('home.search.placeholder', '"Search documents, notes and guides…"'::jsonb, 'system'),
  ('home.learning.enabled', 'true'::jsonb, 'system'),
  ('home.learning.items', '[]'::jsonb, 'system'),
  ('home.feedback.enabled', 'true'::jsonb, 'system'),
  ('home.feedback.categories', '["General","Website","Resources","Suggestion"]'::jsonb, 'system'),
  ('home.feedback.allow_anonymous', 'true'::jsonb, 'system'),
  ('home.feedback.display_approved', 'false'::jsonb, 'system'),
  ('home.feedback.max_display', '6'::jsonb, 'system')
on conflict (setting_key) do nothing;


-- Public submissions are written only by the Edge Function using service_role.
create table if not exists public.pixel_forge_public_feedback (
  id uuid primary key default gen_random_uuid(),
  name text,
  category text not null check (length(category) between 2 and 32),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (length(message) between 20 and 1000),
  consent boolean not null check (consent = true),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submission_hash text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);
create index if not exists pixel_forge_public_feedback_status_created_idx
  on public.pixel_forge_public_feedback(status, created_at desc);
create index if not exists pixel_forge_public_feedback_hash_created_idx
  on public.pixel_forge_public_feedback(submission_hash, created_at desc)
  where submission_hash is not null;

create table if not exists public.pixel_forge_feedback_audit (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.pixel_forge_public_feedback(id) on delete cascade,
  old_status text not null,
  new_status text not null,
  actor_uid text not null,
  created_at timestamptz not null default now()
);
create index if not exists pixel_forge_feedback_audit_created_idx
  on public.pixel_forge_feedback_audit(created_at desc);

alter table public.pixel_forge_public_feedback enable row level security;
alter table public.pixel_forge_feedback_audit enable row level security;
revoke all on table public.pixel_forge_public_feedback from anon, authenticated;
revoke all on table public.pixel_forge_feedback_audit from anon, authenticated;
grant all on table public.pixel_forge_public_feedback to service_role;
grant all on table public.pixel_forge_feedback_audit to service_role;

create or replace function public.pixel_forge_moderate_feedback(
  p_feedback_id uuid,
  p_status text,
  p_actor_uid text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid feedback status';
  end if;
  select status into v_old_status
  from public.pixel_forge_public_feedback
  where id = p_feedback_id
  for update;
  if not found then
    raise exception 'Feedback item not found';
  end if;
  update public.pixel_forge_public_feedback
  set status = p_status, reviewed_at = now(), reviewed_by = p_actor_uid
  where id = p_feedback_id;
  insert into public.pixel_forge_feedback_audit(feedback_id, old_status, new_status, actor_uid)
  values (p_feedback_id, v_old_status, p_status, p_actor_uid);
end;
$$;
revoke all on function public.pixel_forge_moderate_feedback(uuid, text, text) from public, anon, authenticated;
grant execute on function public.pixel_forge_moderate_feedback(uuid, text, text) to service_role;
