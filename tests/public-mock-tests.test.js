const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "mock-tests.html"), "utf8");
const js = fs.readFileSync(path.join(root, "mock-tests.js"), "utf8");
const api = fs.readFileSync(path.join(root, "supabase/functions/mock-test-management/index.ts"), "utf8");

test("Public Mock Tests page is linked from homepage and has a published-test listing", () => {
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /href="mock-tests\.html"/);
  assert.match(html, /id="mock-test-grid"/);
  assert.match(html, /id="mock-list-status"/);
  assert.match(js, /action=public-list/);
});

test("Public listing returns published metadata only and never exposes answer keys", () => {
  assert.match(api, /action === "public-list"/);
  assert.match(api, /\.eq\("status", "published"\)/);
  assert.match(api, /select\("id,title,description,instructions,duration_seconds,marks_per_question,negative_marks,starts_at,ends_at,created_at"\)/);
  assert.doesNotMatch(api.slice(api.indexOf('action === "public-list"'), api.indexOf("const actor = await requireMockAdmin")), /correct_option_index|pixel_forge_mock_questions|pixel_forge_mock_attempt/);
});

test("Public page explains empty state and that timed test-taking is a later release", () => {
  assert.match(js, /No tests published yet/);
  assert.match(js, /Online test-taking will be enabled in the next release/);
});
