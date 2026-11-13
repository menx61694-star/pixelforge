-- PixelForge Phase 4: privacy-first page-view analytics.
-- Apply manually in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.pixel_forge_analytics_events (
  id uuid primary key default gen_random_uuid(),
  page_path text not null check (page_path in (
    '/', '/index.html', '/library.html', '/pdf-documents.html',
    '/study-notes.html', '/books-resources.html', '/other-documents.html',
    '/exam-materials.html', '/technology-guides.html'
  )),
  created_at timestamptz not null default now()
);

create index if not exists pixel_forge_analytics_events_created_at_idx
  on public.pixel_forge_analytics_events (created_at desc);
create index if not exists pixel_forge_analytics_events_path_created_idx
  on public.pixel_forge_analytics_events (page_path, created_at desc);
alter table public.pixel_forge_analytics_events
  add column if not exists visitor_hash text,
  add column if not exists country_code text,
  add column if not exists region_name text;

create index if not exists pixel_forge_analytics_events_visitor_created_idx
  on public.pixel_forge_analytics_events (visitor_hash, created_at desc);
create index if not exists pixel_forge_analytics_events_location_created_idx
  on public.pixel_forge_analytics_events (country_code, region_name, created_at desc);


alter table public.pixel_forge_analytics_events enable row level security;
revoke all on public.pixel_forge_analytics_events from public, anon, authenticated;
grant all on public.pixel_forge_analytics_events to service_role;

-- Pseudonymous, short-window rate-limit keys. Raw IP addresses are never stored.
create table if not exists public.pixel_forge_analytics_rate_limits (
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (key_hash, window_start)
);
create index if not exists pixel_forge_analytics_rate_limits_window_idx
  on public.pixel_forge_analytics_rate_limits (window_start);
alter table public.pixel_forge_analytics_rate_limits enable row level security;
revoke all on public.pixel_forge_analytics_rate_limits from public, anon, authenticated;
grant all on public.pixel_forge_analytics_rate_limits to service_role;

create or replace function public.pixel_forge_analytics_consume_rate_limit(
  p_key_hash text,
  p_window_start timestamptz,
  p_max_requests integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' or p_max_requests < 1 or p_max_requests > 1000 then
    return false;
  end if;

  insert into public.pixel_forge_analytics_rate_limits (key_hash, window_start, request_count)
  values (p_key_hash, p_window_start, 1)
  on conflict (key_hash, window_start)
  do update set request_count = public.pixel_forge_analytics_rate_limits.request_count + 1
  returning request_count into v_count;

  -- Opportunistic cleanup; the table retains at most a short history per active key.
  delete from public.pixel_forge_analytics_rate_limits
  where window_start < now() - interval '2 days';
  delete from public.pixel_forge_analytics_events
  where created_at < now() - interval '90 days';

  return v_count <= p_max_requests;
end;
$$;
revoke all on function public.pixel_forge_analytics_consume_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.pixel_forge_analytics_consume_rate_limit(text, timestamptz, integer) to service_role;

create or replace function public.pixel_forge_analytics_summary(
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'totalPageViews', count(*),
    'uniqueVisitors', count(distinct e.visitor_hash),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.day, 'views', d.views, 'visitors', d.visitors) order by d.day)
      from (
        select (e.created_at at time zone 'UTC')::date as day,
          count(*)::bigint as views,
          count(distinct e.visitor_hash)::bigint as visitors
        from public.pixel_forge_analytics_events e
        where e.created_at >= p_from and e.created_at < p_to
        group by 1
      ) d
    ), '[]'::jsonb),
    'topPages', coalesce((
      select jsonb_agg(jsonb_build_object('path', p.page_path, 'views', p.views) order by p.views desc, p.page_path)
      from (
        select e.page_path, count(*)::bigint as views
        from public.pixel_forge_analytics_events e
        where e.created_at >= p_from and e.created_at < p_to
        group by e.page_path
        order by views desc, e.page_path
        limit 10
      ) p
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('country', l.country_code, 'region', l.region_name, 'visitors', l.visitors)
        order by l.visitors desc, l.country_code, l.region_name)
      from (
        select e.country_code, e.region_name, count(distinct e.visitor_hash)::bigint as visitors
        from public.pixel_forge_analytics_events e
        where e.created_at >= p_from and e.created_at < p_to
          and e.country_code is not null
        group by e.country_code, e.region_name
        order by visitors desc, e.country_code, e.region_name
        limit 20
      ) l
    ), '[]'::jsonb)
  )
  from public.pixel_forge_analytics_events e
  where e.created_at >= p_from and e.created_at < p_to;
$$;
revoke all on function public.pixel_forge_analytics_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.pixel_forge_analytics_summary(timestamptz, timestamptz) to service_role;

insert into public.pixel_forge_role_permissions (role, permission, allowed) values
  ('admin', 'analytics.view', true),
  ('editor', 'analytics.view', false),
  ('viewer', 'analytics.view', false)
on conflict (role, permission) do nothing;

comment on table public.pixel_forge_analytics_events is
  'Anonymous page views with HMAC-hashed tab-session identifiers and trusted edge country/region headers only; no raw IP, referrer, query string, or document metadata. Events older than 90 days are purged during collection.';
