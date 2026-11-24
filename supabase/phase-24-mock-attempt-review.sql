-- Extend candidate answer records with the review flag used by the question palette.
alter table public.pixel_forge_mock_attempt_answers
  add column if not exists marked_for_review boolean not null default false;
