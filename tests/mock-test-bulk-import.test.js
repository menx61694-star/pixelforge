const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const api = fs.readFileSync(path.join(root, "supabase/functions/mock-test-management/index.ts"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const script = fs.readFileSync(path.join(root, "admin.js"), "utf8");

test("Admin exposes JSON bulk import for five full-length mocks", () => {
  assert.match(admin, /id="mock-test-bulk-import"/);
  assert.match(admin, /id="mock-test-bulk-file"/);
  assert.match(script, /action, \{ method: "POST", body: payload \}/);
});

test("Bulk import enforces five tests and 120 questions per test", () => {
  assert.match(api, /action === "bulk-import"/);
  assert.match(api, /tests\.length !== 5/);
  assert.match(api, /test\.questions\.length !== 120/);
});

test("Bulk import enforces the official 10-section question distribution", () => {
  assert.match(api, /const expected = \[25,5,30,8,16,8,8,8,4,8\]/);
  assert.match(api, /section_index === sectionIndex/);
  assert.match(api, /status: "draft"/);
  assert.match(api, /duration_seconds: 7200, marks_per_question: 3, negative_marks: 1/);
});

test("Bulk import validates four-option MCQs and answer indices", () => {
  assert.match(api, /q\.options\.length !== 4/);
  assert.match(api, /q\.correct_option_index < 0/);
  assert.match(api, /q\.correct_option_index > 3/);
});
