const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const edge = read("supabase/functions/analytics/index.ts");
const sql = read("supabase/phase-4-analytics.sql");
const config = read("supabase/config.toml");

test("analytics Edge Function is registered with platform JWT verification disabled for Firebase-token handling", () => {
  assert.match(config, /\[functions\.analytics\][\s\S]*?verify_jwt\s*=\s*false/);
});

test("public collection accepts only the allowlisted page_path and rejects extra event fields", () => {
  assert.match(edge, /const allowedPaths = new Set\(/);
  assert.match(edge, /!allowedPaths\.has\(pagePath\)/);
  assert.match(edge, /Object\.keys\(input \?\? \{\}\)\.some\(\(key\) => key !== "pagePath"\)/);
  assert.match(edge, /insert\(\{ page_path: pagePath \}\)/);
});

test("event and rate-limit tables deny direct client access and enable RLS", () => {
  assert.match(sql, /alter table public\.pixel_forge_analytics_events enable row level security/i);
  assert.match(sql, /revoke all on public\.pixel_forge_analytics_events from public, anon, authenticated/i);
  assert.match(sql, /alter table public\.pixel_forge_analytics_rate_limits enable row level security/i);
  assert.match(sql, /revoke all on public\.pixel_forge_analytics_rate_limits from public, anon, authenticated/i);
});

test("rate limiting uses an HMAC key and an atomic database counter", () => {
  assert.match(edge, /name: "HMAC", hash: "SHA-256"/);
  assert.match(edge, /pixel_forge_analytics_consume_rate_limit/);
  assert.match(sql, /on conflict \(key_hash, window_start\)[\s\S]*?request_count = public\.pixel_forge_analytics_rate_limits\.request_count \+ 1/i);
});

test("analytics summary requires Firebase authentication and analytics.view permission", () => {
  assert.match(edge, /lookupFirebaseUser\(token\)/);
  assert.match(edge, /hasAnalyticsPermission\(uid\)/);
  assert.match(edge, /analytics\.view/);
  assert.match(sql, /\('admin', 'analytics\.view', true\)/);
  assert.match(sql, /\('editor', 'analytics\.view', false\)/);
  assert.match(sql, /\('viewer', 'analytics\.view', false\)/);
});

test("stored page-view schema contains no raw visitor, IP, referrer, or document fields", () => {
  const eventTable = sql.match(/create table if not exists public\.pixel_forge_analytics_events \(([\s\S]*?)\n\);/i)?.[1] ?? "";
  assert.ok(eventTable, "analytics events table definition must exist");
  for (const forbidden of ["ip_address", "visitor_id", "referrer", "document_name", "email", "user_agent"]) {
    assert.doesNotMatch(eventTable, new RegExp(forbidden, "i"));
  }
});

test("analytics.view is an accepted role-permission namespace", () => {
  const userManagement = read("supabase/functions/user-management/index.ts");
  assert.ok(userManagement.includes("|analytics)"));
});
