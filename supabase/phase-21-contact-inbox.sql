-- PixelForge Contact inbox: visitor messages are stored for authorized admin review.
create table if not exists public.pixel_forge_contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 254),
  subject text not null check (char_length(subject) between 3 and 120),
  message text not null check (char_length(message) between 10 and 3000),
  status text not null default 'new' check (status in ('new', 'read', 'archived')),
  submission_hash text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists pixel_forge_contact_messages_created_idx
  on public.pixel_forge_contact_messages (created_at desc);
create index if not exists pixel_forge_contact_messages_submission_idx
  on public.pixel_forge_contact_messages (submission_hash, created_at desc)
  where submission_hash is not null;

alter table public.pixel_forge_contact_messages enable row level security;
revoke all on public.pixel_forge_contact_messages from anon, authenticated;
grant all on public.pixel_forge_contact_messages to service_role;

comment on table public.pixel_forge_contact_messages is
  'Private Contact Us inbox. Public submissions are accepted only through the site-settings Edge Function; administrators read and update messages through its authenticated API.';
