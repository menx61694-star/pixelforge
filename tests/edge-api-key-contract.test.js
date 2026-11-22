const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const admin = read("admin.js");

test("admin Edge Function requests include the Supabase publishable API key", () => {
  for (const helper of ["managementRequest", "settingsRequest", "securityLogsRequest", "googleDriveRequest"]) {
    const start = admin.indexOf("async function " + helper);
    assert.notEqual(start, -1, helper + " exists");
    const next = admin.indexOf("\n  async function ", start + 1);
    const body = admin.slice(start, next === -1 ? admin.length : next);
    assert.match(body, /SUPABASE_PUBLISHABLE_KEY/, helper + " sets apikey");
  }
  assert.match(admin, /headers:\s*\{\s*"apikey":\s*SUPABASE_PUBLISHABLE_KEY/);
});

test("Edge Function CORS permits apikey preflight header", () => {
  for (const file of [
    "supabase/functions/analytics/index.ts",
    "supabase/functions/site-settings/index.ts",
    "supabase/functions/google-drive-files/index.ts",
    "supabase/functions/google-drive-oauth/index.ts",
    "supabase/functions/user-management/index.ts",
  ]) {
    const source = read(file);
    assert.match(source, /Access-Control-Allow-Headers[^\n]*apikey/i, file);
  }
});


test("public JSON POST requests retain Content-Type and have no duplicate headers property", () => {
  const source = read("script.js");
  assert.doesNotMatch(source, /headers:[^\n]*\n\s*headers:/, "duplicate headers keys must not override Content-Type");
  for (const action of ["analytics?action=collect", "analytics?action=local-ip-diagnostic", "site-settings?action=quiz-answer", "site-settings?action=submit-contact"]) {
    const start = source.indexOf(action);
    assert.notEqual(start, -1, action + " request exists");
    const block = source.slice(Math.max(0, start - 150), start + 500);
    assert.match(block, /Content-Type[^\n]*application\/json/, action + " retains JSON content type");
  }
});