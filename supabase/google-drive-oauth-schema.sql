-- PixelForge Google Drive OAuth state and encrypted refresh-token storage.
-- Run in Supabase SQL Editor. No browser role receives access to these tables.

create table if not exists public.google_drive_oauth_states (
  state_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.google_drive_oauth_tokens (
  id text primary key check (id = 'pixelForge-owner'),
  refresh_token_encrypted text not null,
  scope text not null,
  connected_at timestamptz not null default now()
);

alter table public.google_drive_oauth_states enable row level security;
alter table public.google_drive_oauth_tokens enable row level security;

revoke all on table public.google_drive_oauth_states from anon, authenticated;
revoke all on table public.google_drive_oauth_tokens from anon, authenticated;

grant all on table public.google_drive_oauth_states to service_role;
grant all on table public.google_drive_oauth_tokens to service_role;


-- Persist the validated admin page origin for the OAuth completion redirect.
alter table public.google_drive_oauth_states
  add column if not exists return_to text;
