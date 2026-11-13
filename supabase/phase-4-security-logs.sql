-- PixelForge Security Logs: encrypted IP retention and admin-only access.
-- Apply in Supabase SQL Editor after adding ANALYTICS_IP_ENCRYPTION_KEY to Edge Function secrets.
-- Safe to re-run.

create table if not exists public.pixel_forge_security_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view')),
  page_path text not null check (page_path in (
    '/', '/index.html', '/library.html', '/pdf-documents.html',
    '/study-notes.html', '/books-resources.html', '/other-documents.html',
    '/exam-materials.html', '/technology-guides.html'
  )),
  ip_ciphertext text not null,
  ip_iv text not null,
  ip_source text,
  local_ip_ciphertext text,
  local_ip_iv text,
  local_ip_source text,
  created_at timestamptz not null default now()
);
alter table public.pixel_forge_security_logs add column if not exists ip_source text;
alter table public.pixel_forge_security_logs add column if not exists local_ip_ciphertext text;
alter table public.pixel_forge_security_logs add column if not exists local_ip_iv text;
alter table public.pixel_forge_security_logs add column if not exists local_ip_source text;

alter table public.pixel_forge_security_logs
  drop constraint if exists pixel_forge_security_logs_event_type_check;
alter table public.pixel_forge_security_logs
  add constraint pixel_forge_security_logs_event_type_check
  check (event_type in ('page_view', 'local_ip_diagnostic'));

create index if not exists pixel_forge_security_logs_created_idx
  on public.pixel_forge_security_logs (created_at desc);
alter table public.pixel_forge_security_logs enable row level security;
revoke all on public.pixel_forge_security_logs from public, anon, authenticated;
grant all on public.pixel_forge_security_logs to service_role;

create table if not exists public.pixel_forge_security_log_admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_uid text not null,
  action text not null check (action in ('manual_delete_all')),
  deleted_count integer not null default 0 check (deleted_count >= 0),
  created_at timestamptz not null default now()
);
alter table public.pixel_forge_security_log_admin_actions enable row level security;
revoke all on public.pixel_forge_security_log_admin_actions from public, anon, authenticated;
grant all on public.pixel_forge_security_log_admin_actions to service_role;

insert into public.pixel_forge_role_permissions (role, permission, allowed) values
  ('admin', 'security.logs.view', true),
  ('admin', 'security.logs.delete', true),
  ('editor', 'security.logs.view', false),
  ('editor', 'security.logs.delete', false),
  ('viewer', 'security.logs.view', false),
  ('viewer', 'security.logs.delete', false)
on conflict (role, permission) do update set allowed = excluded.allowed;

-- Daily automatic deletion. pg_cron is supported by Supabase; job replacement keeps this migration idempotent.
-- pg_cron is already enabled on this Supabase project; preserve the existing managed extension and job.
do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'pixelforge-security-logs-retention'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
  perform cron.schedule(
    'pixelforge-security-logs-retention',
    '17 3 * * *',
    $job$delete from public.pixel_forge_security_logs where created_at < now() - interval '90 days';$job$
  );
end;
$$;

comment on table public.pixel_forge_security_logs is
  'Security event log with AES-256-GCM encrypted IP addresses; accessible only through authenticated admin Edge Function endpoints; automatically deleted after 90 days.';
comment on table public.pixel_forge_security_log_admin_actions is
  'Audit trail of manual security log deletion actions; contains no visitor IP addresses.';
