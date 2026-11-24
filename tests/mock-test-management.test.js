const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const js = fs.readFileSync(path.join(root, "admin.js"), "utf8");
const api = fs.readFileSync(path.join(root, "supabase/functions/mock-test-management/index.ts"), "utf8");
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");

test("Admin Mock Test navigation and forms are permission-gated", () => {
  assert.match(html, /href="#mock-tests"[^>]*data-permission="mock_tests\.manage"/);
  assert.match(html, /id="mock-test-form"/);
  assert.match(html, /id="mock-question-form"/);
  assert.match(js, /"mock-tests": "mock_tests\.manage"/);
  assert.match(js, /loadMockTests\(\)/);
});

test("Mock Test API authenticates Firebase identity and admin permission server-side", () => {
  assert.match(api, /accounts:lookup/);
  assert.match(api, /user\.role !== "admin"/);
  assert.match(api, /permission\?\.allowed === true/);
  assert.match(api, /mock_tests\.manage/);
});

test("Mock Test API provides test and question management actions", () => {
  for (const action of ["list", "create-test", "update-test", "delete-test", "questions", "save-question", "delete-question"]) {
    assert.ok(api.includes('"'+action+'"') || api.includes('=== "'+action+'"'), "Missing action: " + action);
  }
  assert.match(api, /correct_option_index/);
  assert.match(api, /options\.length !== 4/);
  assert.match(api, /question_order/);
});

test("Mock Test Edge Function is configured for explicit Firebase token verification", () => {
  assert.match(config, /\[functions\.mock-test-management\]\s+verify_jwt = false/);
});
