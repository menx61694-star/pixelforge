-- PixelForge Phase 4, Step 1: Online Mock Test schema and security boundary.
-- Apply manually in Supabase SQL Editor after reviewing this migration.
-- Test content and attempts are accessible only through trusted Edge Functions.
-- Never expose answer keys or attempt credentials through browser-side table access.

create table if not exists public.pixel_forge_mock_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  instructions text not null default '' check (char_length(instructions) <= 3000),
  duration_seconds integer not null check (duration_seconds between 60 and 14400),
  marks_per_question numeric(8,2) not null default 1 check (marks_per_question > 0 and marks_per_question <= 100),
  negative_marks numeric(8,2) not null default 0 check (negative_marks >= 0 and negative_marks <= 100),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  created_by text not null check (char_length(created_by) between 1 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pixel_forge_mock_test_window_check
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

create index if not exists pixel_forge_mock_tests_public_idx
  on public.pixel_forge_mock_tests (status, starts_at, ends_at, created_at desc);

create table if not exists public.pixel_forge_mock_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.pixel_forge_mock_tests(id) on delete cascade,
  question_order integer not null check (question_order between 1 and 1000),
  question_text text not null check (char_length(trim(question_text)) between 1 and 3000),
  options text[] not null,
  correct_option_index smallint not null check (correct_option_index between 0 and 3),
  explanation text not null default '' check (char_length(explanation) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pixel_forge_mock_questions_four_options_check
    check (
      cardinality(options) = 4
      and array_position(options, null) is null
      and array_length(options, 1) = 4
    ),
  constraint pixel_forge_mock_questions_order_unique unique (test_id, question_order)
);

create index if not exists pixel_forge_mock_questions_test_idx
  on public.pixel_forge_mock_questions (test_id, question_order);

create table if not exists public.pixel_forge_mock_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.pixel_forge_mock_tests(id) on delete restrict,
  -- A random bearer token is issued to the browser once; only its SHA-256 hash is stored.
  attempt_token_hash text not null unique check (attempt_token_hash ~ '^[a-f0-9]{64}$'),
  candidate_uid text,
  candidate_name text not null default '' check (char_length(candidate_name) <= 120),
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  total_questions integer not null check (total_questions between 1 and 1000),
  correct_count integer not null default 0 check (correct_count between 0 and total_questions),
  incorrect_count integer not null default 0 check (incorrect_count between 0 and total_questions),
  unanswered_count integer not null default 0 check (unanswered_count between 0 and total_questions),
  score numeric(12,2),
  max_score numeric(12,2) not null check (max_score > 0),
  created_at timestamptz not null default now(),
  constraint pixel_forge_mock_attempt_submit_state_check
    check (
      (status = 'in_progress' and submitted_at is null and score is null)
      or (status in ('submitted', 'expired') and submitted_at is not null and score is not null)
    )
);

create index if not exists pixel_forge_mock_attempts_test_started_idx
  on public.pixel_forge_mock_attempts (test_id, started_at desc);
create index if not exists pixel_forge_mock_attempts_candidate_idx
  on public.pixel_forge_mock_attempts (candidate_uid, started_at desc)
  where candidate_uid is not null;

create table if not exists public.pixel_forge_mock_attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.pixel_forge_mock_attempts(id) on delete cascade,
  question_id uuid not null references public.pixel_forge_mock_questions(id) on delete restrict,
  selected_option_index smallint check (selected_option_index between 0 and 3),
  is_correct boolean,
  awarded_marks numeric(12,2),
  answered_at timestamptz not null default now(),
  constraint pixel_forge_mock_attempt_answers_unique unique (attempt_id, question_id)
);

create index if not exists pixel_forge_mock_attempt_answers_attempt_idx
  on public.pixel_forge_mock_attempt_answers (attempt_id);

-- No direct browser access: all reads/writes must pass through an Edge Function
-- that verifies Firebase identity for admins and opaque attempt tokens for candidates.
alter table public.pixel_forge_mock_tests enable row level security;
alter table public.pixel_forge_mock_questions enable row level security;
alter table public.pixel_forge_mock_attempts enable row level security;
alter table public.pixel_forge_mock_attempt_answers enable row level security;

revoke all on public.pixel_forge_mock_tests from public, anon, authenticated;
revoke all on public.pixel_forge_mock_questions from public, anon, authenticated;
revoke all on public.pixel_forge_mock_attempts from public, anon, authenticated;
revoke all on public.pixel_forge_mock_attempt_answers from public, anon, authenticated;
grant all on public.pixel_forge_mock_tests to service_role;
grant all on public.pixel_forge_mock_questions to service_role;
grant all on public.pixel_forge_mock_attempts to service_role;
grant all on public.pixel_forge_mock_attempt_answers to service_role;

-- The existing Firebase-backed admin permission registry remains authoritative.
insert into public.pixel_forge_role_permissions (role, permission, allowed) values
  ('admin', 'mock_tests.manage', true),
  ('editor', 'mock_tests.manage', false),
  ('viewer', 'mock_tests.manage', false)
on conflict (role, permission) do update set allowed = excluded.allowed;

comment on table public.pixel_forge_mock_tests is
  'Admin-managed online mock tests. Public listing and all mutations are served through a trusted Edge Function.';
comment on table public.pixel_forge_mock_questions is
  'Mock test question bank. correct_option_index must never be returned to candidates before submission.';
comment on table public.pixel_forge_mock_attempts is
  'Mock test attempts. Stores only a SHA-256 hash of the candidate bearer token; direct client access is denied.';
comment on table public.pixel_forge_mock_attempt_answers is
  'Candidate answers and server-calculated scoring details; direct client access is denied.';
