const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Edge Functions retain the production admin origin even when an override is configured", () => {
  for (const file of [
    "supabase/functions/analytics/index.ts",
    "supabase/functions/site-settings/index.ts",
    "supabase/functions/google-drive-files/index.ts",
  ]) {
    const source = read(file);
    assert.match(source, /"https:\\/\\/pixelforge\\.jo3\\.org"/, file + " must always allow the production admin origin");
    assert.match(source, /PIXELFORGE_ADMIN_ORIGIN/, file + " must also support the configured origin");
    assert.match(source, /"http:\\/\\/localhost:8000"/, file + " must retain local development origin");
  }
});
