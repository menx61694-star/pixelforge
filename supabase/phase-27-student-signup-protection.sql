-- Phase 27: student signup verification and abuse protection.
-- Run after phase-26-student-accounts.sql in Supabase SQL Editor.
create table if not exists public.pixel_forge_student_signup_limits (
  scope text not null check (scope in ('ip','email')),
  key_hash text not null check (char_length(key_hash) = 64),
  window_start timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (scope, key_hash, window_start)
);
alter table public.pixel_forge_student_signup_limits enable row level security;
revoke all on public.pixel_forge_student_signup_limits from public, anon, authenticated;
grant all on public.pixel_forge_student_signup_limits to service_role;

create or replace function public.pixel_forge_check_student_signup_limit(
  p_ip_hash text,
  p_email_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_ip_count integer;
  v_email_count integer;
begin
  if p_ip_hash is null or char_length(p_ip_hash) <> 64
     or p_email_hash is null or char_length(p_email_hash) <> 64 then
    raise exception 'Invalid rate-limit key';
  end if;

  insert into public.pixel_forge_student_signup_limits(scope,key_hash,window_start,attempts)
  values ('ip',p_ip_hash,v_window,1)
  on conflict (scope,key_hash,window_start)
  do update set attempts = public.pixel_forge_student_signup_limits.attempts + 1
  returning attempts into v_ip_count;

  insert into public.pixel_forge_student_signup_limits(scope,key_hash,window_start,attempts)
  values ('email',p_email_hash,v_window,1)
  on conflict (scope,key_hash,window_start)
  do update set attempts = public.pixel_forge_student_signup_limits.attempts + 1
  returning attempts into v_email_count;

  return jsonb_build_object(
    'allowed', v_ip_count <= 5 and v_email_count <= 3,
    'ip_attempts', v_ip_count,
    'email_attempts', v_email_count
  );
end;
$$;

revoke all on function public.pixel_forge_check_student_signup_limit(text,text) from public, anon, authenticated;
grant execute on function public.pixel_forge_check_student_signup_limit(text,text) to service_role;

-- Remove expired rate-limit buckets; safe to run periodically.
create or replace function public.pixel_forge_cleanup_student_signup_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.pixel_forge_student_signup_limits
  where window_start < date_trunc('hour', now()) - interval '7 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function public.pixel_forge_cleanup_student_signup_limits() from public, anon, authenticated;
grant execute on function public.pixel_forge_cleanup_student_signup_limits() to service_role;
