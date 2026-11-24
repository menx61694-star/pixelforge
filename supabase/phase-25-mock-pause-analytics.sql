-- Mock test pause/resume, subject/topic analytics and per-question timing.
-- Apply after phases 22-24. Candidate access remains through the service-role Edge Function only.
alter table public.pixel_forge_mock_attempts
  drop constraint if exists pixel_forge_mock_attempts_status_check;
alter table public.pixel_forge_mock_attempts
  add constraint pixel_forge_mock_attempts_status_check
  check (status in ('in_progress','paused','submitted','expired'));
alter table public.pixel_forge_mock_attempts
  add column if not exists remaining_seconds integer,
  add column if not exists resumed_at timestamptz;
alter table public.pixel_forge_mock_attempts
  drop constraint if exists pixel_forge_mock_attempt_submit_state_check;
alter table public.pixel_forge_mock_attempts
  add constraint pixel_forge_mock_attempt_submit_state_check check (
    (status in ('in_progress','paused') and submitted_at is null and score is null)
    or (status in ('submitted','expired') and submitted_at is not null and score is not null)
  );
alter table public.pixel_forge_mock_questions
  add column if not exists subject text not null default 'Uncategorized',
  add column if not exists topic text not null default 'General';
alter table public.pixel_forge_mock_attempt_answers
  add column if not exists time_spent_seconds integer not null default 0
    check (time_spent_seconds between 0 and 14400);
comment on column public.pixel_forge_mock_attempts.remaining_seconds is
  'Server-calculated remaining exam time captured at pause; browser timer is not authoritative.';
comment on column public.pixel_forge_mock_questions.subject is
  'Question subject used for result analytics; set during question import/edit.';
comment on column public.pixel_forge_mock_questions.topic is
  'Question topic used for result analytics; set during question import/edit.';
