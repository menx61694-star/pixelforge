const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const edge = read("supabase/functions/site-settings/index.ts");
const sql = read("supabase/phase-5-settings.sql");
const config = read("supabase/config.toml");
const userManagement = read("supabase/functions/user-management/index.ts");

test("site-settings Edge Function is registered for Firebase-token authentication", () => {
  assert.match(config, /\[functions\.site-settings\][\s\S]*?verify_jwt\s*=\s*false/);
  assert.match(edge, /lookupFirebaseUser\(token\)/);
  assert.match(edge, /claims\.iss/);
  assert.match(edge, /claims\.aud/);
});

test("settings API is admin-only and checks dedicated view/manage permissions", () => {
  assert.match(edge, /user\.role !== "admin"/);
  assert.match(edge, /user\.status !== "active"/);
  assert.match(edge, /settings\.view/);
  assert.match(edge, /settings\.manage/);
  assert.match(edge, /access\?\.allowed === true/);
});

test("settings API rejects unknown keys, wrong value types and oversized input", () => {
  assert.match(edge, /const settingKeys = new Set/);
  assert.match(edge, /validSettingValue/);
  assert.match(edge, /Object\.keys\(input\)\.length !== 2/);
  assert.match(edge, /contentLength > 4096/);
  assert.match(edge, /value\.length <= 500/);
  assert.match(edge, /maintenance\.enabled/);
});

test("settings and audit tables deny direct client access and enable RLS", () => {
  for (const table of ["pixel_forge_site_settings", "pixel_forge_site_settings_audit"]) {
    assert.match(sql, new RegExp("alter table public\\." + table + " enable row level security", "i"));
    assert.match(sql, new RegExp("revoke all on public\\." + table + " from public, anon, authenticated", "i"));
    assert.match(sql, new RegExp("grant all on public\\." + table + " to service_role", "i"));
  }
});

test("settings schema contains only allowlisted non-secret configuration keys", () => {
  for (const key of ["site.name", "site.description", "site.contact_email", "maintenance.enabled", "maintenance.message", "sync.drive.auto_enabled", "sync.vault.auto_enabled"]) {
    assert.ok(sql.includes("'" + key + "'"), "missing setting key: " + key);
    assert.ok(edge.includes('"' + key + '"'), "API does not allow setting key: " + key);
  }
  assert.match(sql, /never store API keys, OAuth tokens, or secrets/i);
});

test("settings updates use a transactional RPC that records old and new values with actor", () => {
  assert.match(edge, /pixel_forge_update_site_setting/);
  assert.match(edge, /p_actor_uid: actor\.uid/);
  assert.match(sql, /for update/i);
  assert.match(sql, /insert into public\.pixel_forge_site_settings_audit/);
  assert.match(sql, /old_value, new_value, actor_uid/);
  assert.match(sql, /revoke all on function public\.pixel_forge_update_site_setting/);
  assert.match(sql, /grant execute on function public\.pixel_forge_update_site_setting[^;]+to service_role/i);
});

test("settings permissions are admin-only in both role seed and permission management API", () => {
  assert.match(sql, /\('admin', 'settings\.view', true\)/);
  assert.match(sql, /\('admin', 'settings\.manage', true\)/);
  assert.match(sql, /\('editor', 'settings\.view', false\)/);
  assert.match(sql, /\('viewer', 'settings\.manage', false\)/);
  assert.ok(userManagement.includes("settings\\\\.[a-z]+"));
  assert.match(userManagement, /permission\.startsWith\("settings\."\)/);
});

test("settings API has a strict origin allowlist and exposes only the minimal public maintenance status", () => {
  assert.match(edge, /allowedOrigins\.has\(origin\)/);
  assert.match(edge, /Access-Control-Allow-Origin/);
  assert.match(edge, /authorize\(request, permission\)/);
  assert.match(edge, /action === "public-status"/);
  assert.ok(edge.includes('"maintenance.enabled"'));
  assert.ok(edge.includes('"maintenance.message"'));
  assert.doesNotMatch(edge, /SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY/);
});


test("admin workspace exposes a permission-gated Settings page for the existing site-settings API", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  assert.match(adminHtml, /id="settings-nav-link"[^>]*data-permission="settings.view"/);
  assert.match(adminHtml, /id="settings"/);
  assert.match(adminHtml, /setting-maintenance-enabled/);
  assert.match(adminHtml, /settings-audit-body/);
  assert.match(adminJs, /"settings"]/);
  assert.ok(adminJs.includes('settingsNavLink.hidden = !currentPermissions.has("settings.view")'));
  assert.ok(adminJs.includes('settingsRequest("update", { method: "POST"'));
  assert.ok(adminJs.includes('settingsRequest("audit")'));
});

test("public homepage knowledge is admin-managed, allow-listed, and safely exposed", () => {
  const migration = read("supabase/phase-6-homepage-content.sql");
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const publicScript = read("script.js");
  assert.match(edge, /action === "public-content"/);
  assert.match(edge, /"home\.knowledge\.enabled", "home\.knowledge\.items"/);
  assert.match(edge, /key === "home\.knowledge\.items"/);
  assert.match(edge, /item\.text\.length <= 240/);
  assert.match(migration, /home\.knowledge\.items/);
  assert.match(migration, /jsonb_array_length\(p_value\) <= 50/);
  assert.match(adminHtml, /setting-knowledge-enabled/);
  assert.match(adminHtml, /setting-knowledge-items/);
  assert.match(adminJs, /saveSetting\("home\.knowledge\.items"/);
  assert.match(adminJs, /saveSetting\("home\.knowledge\.enabled"/);
  assert.match(publicScript, /action=public-content/);
  assert.match(publicScript, /textContent = facts\[next\]\.text/);
  assert.doesNotMatch(publicScript, /innerHTML\s*=\s*facts/);
});
