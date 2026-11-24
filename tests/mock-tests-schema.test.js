const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(root, "supabase/phase-22-mock-tests.sql"), "utf8");

test("Mock Test schema creates separate test, question, attempt and answer tables", () => {
  for (const table of [
    "pixel_forge_mock_tests",
    "pixel_forge_mock_questions",
    "pixel_forge_mock_attempts",
    "pixel_forge_mock_attempt_answers",
  ]) {
    assert.match(sql, new RegExp("create table if not exists public\\." + table, "i"));
  }
});

test("Mock Test schema validates test settings, four-option MCQs and question order", () => {
  assert.match(sql, /duration_seconds between 60 and 14400/);
  assert.match(sql, /marks_per_question > 0/);
  assert.match(sql, /negative_marks >= 0/);
  assert.match(sql, /status in \('draft', 'published', 'archived'\)/);
  assert.match(sql, /cardinality\(options\) = 4/);
  assert.match(sql, /correct_option_index between 0 and 3/);
  assert.match(sql, /unique \(test_id, question_order\)/);
});

test("candidate attempts store only a token hash and enforce submission state", () => {
  assert.match(sql, /attempt_token_hash text not null unique/);
  assert.match(sql, /attempt_token_hash ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(sql, /status = 'in_progress' and submitted_at is null and score is null/);
  assert.match(sql, /status in \('submitted', 'expired'\) and submitted_at is not null and score is not null/);
  assert.match(sql, /unique \(attempt_id, question_id\)/);
});

test("Mock Test tables deny direct browser access and grant service-role access only", () => {
  for (const table of [
    "pixel_forge_mock_tests",
    "pixel_forge_mock_questions",
    "pixel_forge_mock_attempts",
    "pixel_forge_mock_attempt_answers",
  ]) {
    assert.match(sql, new RegExp("alter table public\\." + table + " enable row level security", "i"));
    assert.match(sql, new RegExp("revoke all on public\\." + table + " from public, anon, authenticated", "i"));
    assert.match(sql, new RegExp("grant all on public\\." + table + " to service_role", "i"));
  }
});

test("Mock Test management permission is admin-only in the existing role registry", () => {
  assert.match(sql, /\('admin', 'mock_tests\.manage', true\)/);
  assert.match(sql, /\('editor', 'mock_tests\.manage', false\)/);
  assert.match(sql, /\('viewer', 'mock_tests\.manage', false\)/);
});
