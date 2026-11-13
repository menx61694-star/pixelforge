const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("public maintenance guard is loaded on homepage and document library", () => {
  assert.match(read("index.html"), /maintenance-mode\.js/);
  assert.match(read("library.html"), /maintenance-mode\.js/);
});

test("maintenance guard calls only the public status action and fails open", () => {
  const js = read("maintenance-mode.js");
  assert.match(js, /site-settings\?action=public-status/);
  assert.match(js, /credentials: "omit"/);
  assert.match(js, /cache: "no-store"/);
  assert.match(js, /data\.maintenance === true/);
  assert.match(js, /catch\(\(\) => \{/);
  assert.match(js, /must never take the public site offline/);
  assert.doesNotMatch(js, /SUPABASE_SERVICE_ROLE_KEY|FIREBASE_WEB_API_KEY/);
});

test("maintenance overlay uses textContent and does not inject admin controls", () => {
  const js = read("maintenance-mode.js");
  assert.match(js, /body\.textContent = message/);
  assert.doesNotMatch(js, /innerHTML/);
  assert.doesNotMatch(js, /settings\.manage|Authorization/);
});

test("public endpoint is GET-only and returns only maintenance status and message", () => {
  const edge = read("supabase/functions/site-settings/index.ts");
  assert.match(edge, /action === "public-status"/);
  assert.match(edge, /request\.method === "GET" && action === "public-status"/);
  assert.match(edge, /\.in\("setting_key", \["maintenance\.enabled", "maintenance\.message"\]\)/);
  assert.match(edge, /maintenance: values\["maintenance\.enabled"\] === true/);
  assert.match(edge, /message: typeof values\["maintenance\.message"\]/);
});
