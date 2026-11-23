const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const rolesSql = read("supabase/phase-2-users-roles.sql");
const userManagement = read("supabase/functions/user-management/index.ts");
const driveFunction = read("supabase/functions/google-drive-files/index.ts");
const analyticsFunction = read("supabase/functions/analytics/index.ts");
const securitySql = read("supabase/phase-4-security-logs.sql");
const adminJs = read("admin.js");

test("default editor and viewer permissions follow the least-privilege role matrix", () => {
  const expected = {
    editor: {
      "dashboard.view": true,
      "activity.view": true,
      "vault.read": true,
      "vault.write": true,
      "vault.delete": false,
      "vault.publish": true,
      "drive.read": true,
      "drive.write": true,
      "drive.delete": false,
      "users.manage": false,
      "roles.manage": false,
    },
    viewer: {
      "dashboard.view": true,
      "activity.view": true,
      "vault.read": true,
      "vault.write": false,
      "vault.delete": false,
      "vault.publish": false,
      "drive.read": true,
      "drive.write": false,
      "drive.delete": false,
      "users.manage": false,
      "roles.manage": false,
    },
  };

  for (const [role, permissions] of Object.entries(expected)) {
    for (const [permission, allowed] of Object.entries(permissions)) {
      const escaped = permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp("\\('" + role + "',\\s*'" + escaped + "',\\s*" + allowed + "\\)");
      assert.match(rolesSql, pattern, role + " permission " + permission + " must default to " + allowed);
    }
  }
});

test("session endpoint returns only permissions for an authenticated active role", () => {
  assert.match(userManagement, /if \(request\.method === "GET" && action === "session"\)/);
  assert.match(userManagement, /const identity = await authenticate\(request\)/);
  assert.match(userManagement, /identity\.role\)\.eq\("allowed", true\)/);
  assert.match(userManagement, /permissions: \(permissions \?\? \[\]\)\.map\(\(item\) => item\.permission\)/);
  assert.match(userManagement, /async function requireAdmin\(request: Request\)[\s\S]*?identity\?\.role === "admin"/);
});

test("user and role mutations are restricted to active administrators", () => {
  const guard = userManagement.indexOf("const actor = await requireAdmin(request)");
  const mutation = userManagement.indexOf('if (action === "assign")');
  assert.ok(guard >= 0 && mutation > guard, "admin guard must run before user-management mutations");
  assert.match(userManagement, /if \(role !== "admin" && \["users\.manage", "roles\.manage"\]\.includes\(permission\) && allowed\)/);
  assert.match(userManagement, /User and role management are reserved for Admin accounts/);
});

test("Google Drive endpoints enforce server-side permissions for read, upload, publish and delete", () => {
  assert.match(driveFunction, /const uid = await verifyFirebaseUser\(request\)/);
  assert.match(driveFunction, /action === "delete" \? "drive\.delete"/);
  assert.match(driveFunction, /\["create-upload-session", "upload-chunk"\]\.includes\(action \?\? ""\) \? "drive\.write"/);
  assert.match(driveFunction, /\["publish", "unpublish"\]\.includes\(action \?\? ""\) \? "vault\.publish"/);
  assert.match(driveFunction, /hasDrivePermission\(uid, requiredPermission\)/);
  assert.match(driveFunction, /if \(!user \|\| user\.status !== "active"\) return false/);
});

test("Analytics and Security Logs endpoints enforce active-user role permissions", () => {
  assert.match(analyticsFunction, /async function hasAnalyticsPermission/);
  assert.match(analyticsFunction, /\.eq\("permission", "analytics\.view"\)/);
  assert.match(analyticsFunction, /async function hasSecurityPermission/);
  assert.match(analyticsFunction, /security\.logs\.view/);
  assert.match(analyticsFunction, /security\.logs\.delete/);
  assert.match(analyticsFunction, /if \(!\(await hasAnalyticsPermission\(uid\)\)\)/);
  assert.match(analyticsFunction, /if \(!\(await hasSecurityPermission\(uid, permission\)\)\)/);
});

test("Storage RLS enforces per-user private-vault access and publish permissions", () => {
  assert.match(rolesSql, /pixel_forge_has_permission\('vault\.read'\)/);
  assert.match(rolesSql, /pixel_forge_has_permission\('vault\.write'\)/);
  assert.match(rolesSql, /pixel_forge_has_permission\('vault\.delete'\)/);
  assert.match(rolesSql, /pixel_forge_has_permission\('vault\.publish'\)/);
  assert.match(rolesSql, /storage\.foldername\(name\)\)\[1\] = \(select auth\.jwt\(\) ->> 'sub'\)/);
  assert.match(securitySql, /\('admin', 'security\.logs\.view', true\)/);
  assert.match(securitySql, /\('editor', 'security\.logs\.view', false\)/);
  assert.match(securitySql, /\('viewer', 'security\.logs\.view', false\)/);
});

test("Admin UI hides controls that are not included in the signed-in role permissions", () => {
  assert.match(adminJs, /currentPermissions = new Set\(session\.permissions \|\| \[\]\)/);
  assert.ok(adminJs.includes('document.querySelectorAll("[data-permission]")'));
  assert.match(adminJs, /element\.hidden = !currentPermissions\.has\(element\.getAttribute\("data-permission"\)\)/);
  assert.match(adminJs, /uploadPanel\.hidden = !currentPermissions\.has\("vault\.write"\)/);
});

test("permission mutations accept only the known permission allowlist", () => {
  assert.ok(userManagement.includes("const validPermissions = new Set(["));
  assert.ok(userManagement.includes("!validPermissions.has(permission)"));
  assert.ok(userManagement.includes('"security.logs.view"'));
  assert.ok(userManagement.includes('"settings.manage"'));
  assert.ok(userManagement.includes('"vault.publish"'));
});
