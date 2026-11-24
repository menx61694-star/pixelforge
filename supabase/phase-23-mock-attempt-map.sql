-- Per-attempt display order and option permutation. The map prevents shuffled options
-- from changing the canonical answer key and lets candidates resume the same attempt.
create table if not exists public.pixel_forge_mock_attempt_question_map (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.pixel_forge_mock_attempts(id) on delete cascade,
  question_id uuid not null references public.pixel_forge_mock_questions(id) on delete restrict,
  display_order integer not null check (display_order between 1 and 1000),
  option_order smallint[] not null,
  constraint pixel_forge_mock_attempt_map_four_options check (
    cardinality(option_order)=4 and array_length(option_order,1)=4
    and array_position(option_order, null) is null
    and option_order <@ array[0,1,2,3]::smallint[]
    and array[0,1,2,3]::smallint[] <@ option_order
  ),
  constraint pixel_forge_mock_attempt_map_question_unique unique (attempt_id,question_id),
  constraint pixel_forge_mock_attempt_map_order_unique unique (attempt_id,display_order)
);
create index if not exists pixel_forge_mock_attempt_map_attempt_order_idx
  on public.pixel_forge_mock_attempt_question_map(attempt_id,display_order);
alter table public.pixel_forge_mock_attempt_question_map enable row level security;
revoke all on public.pixel_forge_mock_attempt_question_map from public, anon, authenticated;
grant all on public.pixel_forge_mock_attempt_question_map to service_role;
comment on table public.pixel_forge_mock_attempt_question_map is
  'Private per-attempt question and option ordering; only trusted Edge Functions may access it.';
