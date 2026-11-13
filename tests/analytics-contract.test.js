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
  assert.match(edge, /key !== "pagePath" && key !== "visitorSessionId"/);
  assert.match(edge, /visitor_hash: visitorHash/);
  assert.match(edge, /insert\(\{[\s\S]*page_path: pagePath/);
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

test("public homepage and library send allowlisted page paths without visitor credentials", () => {
  const homepage = read("script.js");
  const library = read("library.js");
  assert.match(homepage, /trackPixelForgePageView\(\);/);
  assert.match(homepage, /sessionStorage\.getItem\(key\)/);
  assert.match(homepage, /visitorSessionId/);
  assert.match(homepage, /credentials: "omit"/);
  assert.match(library, /analytics\?action=collect/);
  assert.match(library, /credentials: "omit"/);
});

test("analytics page is gated by the dedicated role permission", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  assert.match(adminHtml, /id="analytics" hidden/);
  assert.match(adminHtml, /data-permission="analytics\.view"/);
  assert.match(adminJs, /analytics: "analytics\.view"/);
  assert.match(adminJs, /analytics\?action=summary/);
});

test("admin overview includes vault, Drive, publishing, members, traffic and activity summaries", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  for (const id of ["stat-doc-count", "stat-storage", "stat-drive-count", "stat-drive-status", "stat-published-count", "stat-user-count", "stat-overview-page-views", "overview-activity-list"]) {
    assert.ok(adminHtml.includes('id="' + id + '"'), "overview element missing: " + id);
  }
  assert.match(adminHtml, /Workspace modules/);
  assert.match(adminHtml, /Recent workspace activity/);
  assert.match(adminJs, /publishedCountStat\.textContent = String\(publishedFiles\.size\)/);
  assert.match(adminJs, /userCountStat\.textContent = String\(totalUsers\)/);
  assert.match(adminJs, /loadOverviewAnalytics\(\)/);
  assert.match(adminJs, /overviewActivityList\.append\(item\)/);
});

test("overview shortcuts and optional metrics respect existing role permissions", () => {
  const adminHtml = read("admin.html");
  assert.match(adminHtml, /data-permission="vault.read"/);
  assert.match(adminHtml, /data-permission="drive.read"/);
  assert.match(adminHtml, /data-permission="analytics.view"/);
  assert.match(adminHtml, /data-permission="users.manage"/);
  assert.match(read("admin.js"), /querySelectorAll\("\[data-permission\]"\)/);
});

test("refreshes reuse the same tab session ID and summary reports unique visitors separately", () => {
  const homepage = read("script.js");
  const library = read("library.js");
  assert.match(homepage, /sessionStorage\.getItem\(key\)/);
  assert.match(homepage, /sessionStorage\.setItem\(key, id\)/);
  assert.match(library, /sessionStorage\.getItem\(key\)/);
  assert.match(edge, /hmacHash\("visitor:" \+ visitorSessionId\)/);
  assert.match(sql, /count\(distinct e\.visitor_hash\)/i);
  assert.match(sql, /'uniqueVisitors'/);
});

test("location reporting accepts only edge-provided country and region headers and stores aggregates", () => {
  assert.match(edge, /cf-ipcountry/);
  assert.match(edge, /cf-region/);
  assert.match(edge, /country_code: location\.countryCode/);
  assert.match(sql, /add column if not exists country_code text/i);
  assert.match(sql, /add column if not exists region_name text/i);
  assert.match(sql, /'locations'/);
  assert.doesNotMatch(sql.match(/create table if not exists public\.pixel_forge_analytics_events \(([\s\S]*?)\n\);/i)?.[1] ?? "", /ip_address/i);
});

test("admin analytics separates page views, unique visitors, and location reports", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  assert.match(adminHtml, /id="analytics-total-visitors"/);
  assert.match(adminHtml, /id="analytics-locations"/);
  assert.match(adminHtml, /Unique visitors/);
  assert.match(adminJs, /payload\.uniqueVisitors/);
  assert.match(adminJs, /renderAnalyticsLocations/);
});
