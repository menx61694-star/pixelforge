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
  assert.ok(userManagement.includes("analytics|security)"));
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

test("location reporting accepts only HMAC-authenticated Cloudflare edge metadata and stores aggregates", () => {
  const worker = read("cloudflare/analytics-geo/worker.js");
  assert.match(worker, /request\\.cf/);
  assert.match(worker, /x-pf-geo-country/);
  assert.match(worker, /x-pf-geo-region/);
  assert.match(edge, /verifyGeoProxy\\(request\\)/);
  assert.match(edge, /crypto\\.subtle\\.verify\\("HMAC"/);
  assert.match(edge, /country_code: location\\.countryCode/);
  assert.match(sql, /add column if not exists country_code text/i);
  assert.match(sql, /add column if not exists region_name text/i);
  assert.match(sql, /'locations'/);
  assert.doesNotMatch(sql.match(/create table if not exists public\\.pixel_forge_analytics_events \\(([\\s\\S]*?)\\n\\);/i)?.[1] ?? "", /ip_address/i);
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

test("security logs encrypt raw IP addresses with AES-GCM before persistence", () => {
  assert.match(edge, /ANALYTICS_IP_ENCRYPTION_KEY/);
  assert.match(edge, /name: "AES-GCM"/);
  assert.match(edge, /ip_ciphertext/);
  assert.match(edge, /ip_iv/);
  assert.match(edge, /storeSecurityLog\(request, pagePath, db\)/);
  assert.match(edge, /decryptIp\(row\.ip_ciphertext, row\.ip_iv\)/);
});

test("security logs table denies public and authenticated direct access and has 90-day scheduled retention", () => {
  const securitySql = read("supabase/phase-4-security-logs.sql");
  assert.match(securitySql, /create table if not exists public\.pixel_forge_security_logs/i);
  assert.match(securitySql, /enable row level security/i);
  assert.match(securitySql, /revoke all on public\.pixel_forge_security_logs from public, anon, authenticated/i);
  assert.match(securitySql, /grant all on public\.pixel_forge_security_logs to service_role/i);
  assert.match(securitySql, /interval '90 days'/i);
  assert.match(securitySql, /cron\.schedule/i);
  assert.match(securitySql, /17 3 \* \* \*/);
});

test("security log endpoints enforce dedicated Firebase role permissions and audit manual deletion", () => {
  assert.match(edge, /security\.logs\.view/);
  assert.match(edge, /security\.logs\.delete/);
  assert.match(edge, /hasSecurityPermission\(uid, permission\)/);
  assert.match(edge, /manual_delete_all/);
  assert.match(edge, /actor_uid: uid/);
  const userManagement = read("supabase/functions/user-management/index.ts");
  assert.ok(userManagement.includes("analytics|security)"));
  assert.ok(userManagement.includes('permission.startsWith("security.logs.") && allowed'));
  const securitySql = read("supabase/phase-4-security-logs.sql");
  assert.match(securitySql, /\('admin', 'security\.logs\.view', true\)/);
  assert.match(securitySql, /\('admin', 'security\.logs\.delete', true\)/);
  assert.match(securitySql, /\('viewer', 'security\.logs\.delete', false\)/);
});

test("admin Security Logs page is permission-gated and manual deletion requires confirmation", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  assert.match(adminHtml, /id="security-logs-nav-link" data-permission="security\.logs\.view"/);
  assert.match(adminHtml, /id="security-logs" hidden/);
  assert.match(adminHtml, /id="delete-security-logs" data-permission="security\.logs\.delete"/);
  assert.match(adminJs, /securityLogsRequest\("security-logs"\)/);
  assert.match(adminJs, /window\.confirm\("Delete ALL currently stored visitor security logs/);
  assert.match(adminJs, /securityLogsRequest\("delete-security-logs"/);
});

test("security logs trust only edge client IP and reject private address ranges", () => {
  const ipFn = edge.match(/function getClientIp[\s\S]*?\n}/)?.[0] ?? "";
  assert.match(ipFn, /cf-connecting-ip/);
  assert.doesNotMatch(ipFn, /x-real-ip|x-forwarded-for/);
  assert.match(edge, /ip_source: observedIp.source/);
  assert.match(ipFn, /a === 10/);
  assert.match(ipFn, /a === 127/);
  assert.match(ipFn, /a === 192 && b === 168/);
});

test("security logs explain local LAN IP is unavailable and show IP source", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const securitySql = read("supabase/phase-4-security-logs.sql");
  assert.match(adminHtml, /Observed public IP/);
  assert.match(adminHtml, /Local\/private LAN IPs are not available/);
  assert.match(adminJs, /Cloudflare edge/);
  assert.match(adminJs, /Not shared/);
  assert.match(securitySql, /ip_source text/);
});

test("local IP diagnostic requires explicit consent, accepts only private addresses, and encrypts before persistence", () => {
  assert.match(edge, /action === "local-ip-diagnostic"/);
  assert.match(edge, /input\?\.consent !== true/);
  assert.match(edge, /isPrivateLocalIp\(localIp\)/);
  assert.match(edge, /local_ip_ciphertext: localEncrypted\.ip_ciphertext/);
  assert.match(edge, /local_ip_source: "browser-webrtc-explicit-consent"/);
  assert.match(edge, /local_ip_ciphertext,local_ip_iv,local_ip_source/);
  assert.match(edge, /localIpAddress: row\.local_ip_ciphertext/);
  assert.match(read("supabase/phase-4-security-logs.sql"), /local_ip_ciphertext text/);
  assert.match(read("supabase/phase-4-security-logs.sql"), /'local_ip_diagnostic'/);
});

test("public local IP diagnostic is user-initiated, disclosed and does not auto-run", () => {
  const script = read("script.js");
  const index = read("index.html");
  assert.match(index, /Check &amp; share local IP \(optional\)/);
  assert.match(index, /Nothing is checked or shared unless you choose/);
  assert.match(script, /window\.confirm\("Consent to check/);
  assert.match(script, /RTCPeerConnection/);
  assert.match(script, /action=local-ip-diagnostic/);
  assert.doesNotMatch(script.slice(0, script.indexOf("async function getPixelForgePrivateLocalIp")), /getPixelForgePrivateLocalIp\(\)/);
  assert.match(read("admin.js"), /browser-reported/);
});

 
test("security log timestamps are displayed in India Standard Time", () => {
  const adminJs = read("admin.js");
  assert.match(adminJs, /toLocaleString\("en-IN", \{ timeZone: "Asia\/Kolkata"/);
  assert.match(adminJs, /\+ " IST"/);
  assert.doesNotMatch(adminJs, /new Date\(log\.createdAt\)\.toISOString\(\)/);
});

test("public analytics uses the Cloudflare geo proxy and backend verifies signed edge metadata", () => {
  const worker = read("cloudflare/analytics-geo/worker.js");
  const wrangler = read("cloudflare/analytics-geo/wrangler.toml");
  assert.match(read("script.js"), /const endpoint = "\/api\/analytics"/);
  assert.match(read("library.js"), /\/api\/analytics/);
  assert.match(worker, /request\.cf/);
  assert.match(worker, /CF-Connecting-IP/);
  assert.match(worker, /x-pf-geo-signature/);
  assert.match(wrangler, /pixelforge\.jo3\.org\/api\/analytics/);
  assert.match(edge, /verifyGeoProxy\(request\)/);
  assert.match(edge, /crypto\.subtle\.verify\("HMAC"/);
  assert.match(edge, /Trusted analytics proxy verification failed/);
});
