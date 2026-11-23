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
  assert.match(edge, /contentLength > 20000/);
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
  assert.ok(sql.includes("('admin', 'settings.view', true)"));
  assert.ok(sql.includes("('admin', 'settings.manage', true)"));
  assert.ok(sql.includes("('editor', 'settings.view', false)"));
  assert.ok(sql.includes("('viewer', 'settings.manage', false)"));
  assert.ok(userManagement.includes('"settings.view"'));
  assert.ok(userManagement.includes('"settings.manage"'));
  assert.ok(userManagement.includes('permission.startsWith("settings.")'));
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

test("public settings expose admin-managed branding without leaking private settings", () => {
  assert.ok(edge.includes('"site.name", "site.description", "site.contact_email"'));
  assert.match(edge, /name: typeof values\["site\.name"\]/);
  assert.match(edge, /description: typeof values\["site\.description"\]/);
  const publicScript = read("script.js");
  assert.match(publicScript, /document\.title = payload\.site\.name/);
  assert.match(publicScript, /description\.setAttribute\("content", payload\.site\.description\)/);
});


test("Daily Quiz is validated server-side and never exposes the answer key publicly", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-7-daily-quiz.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  assert.match(adminJs, /Number\.isInteger\(item\.correctIndex\)/);
  assert.match(edge, /action === "quiz-answer"/);
  assert.match(edge, /item\.correctIndex/);
  assert.match(edge, /timeZone: "Asia\/Kolkata"/);
  assert.match(edge, /home\.quiz\.enabled/);
  assert.match(edge, /home\.quiz\.items/);
  assert.match(migration, /home\.quiz\.items/);
  assert.match(migration, /jsonb_array_length\(p_value\) <= 100/);
  assert.match(homepage, /id="daily-quiz"/);
  assert.match(publicScript, /action=quiz-answer/);
  assert.doesNotMatch(edge.match(/quiz: \{[\s\S]*?\n        \},/)?.[0] || "", /correctIndex/);
});

test("Daily Quiz homepage markup closes its form and preserves hidden/accessibility behavior", () => {
  const homepage = read("index.html");
  const css = read("styles.css");
  assert.match(homepage, /<form id="daily-quiz-form">[\s\S]*?<\/form>\s*<p id="daily-quiz-result"/);
  assert.match(css, /\.daily-quiz-section\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /\.sr-only\s*\{/);
});


test("Quick Digital Tools are admin-managed, ordered, allow-listed and exposed without privileged settings", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-8-quick-tools.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  const toolsPage = read("tools.html");
  const toolsScript = read("tools.js");
  assert.match(adminJs, /setting-tools-enabled/);
  assert.match(adminHtml, /setting-tools-items/);
  assert.match(adminJs, /saveSetting\("home\.tools\.items"/);
  assert.match(adminJs, /saveSetting\("home\.tools\.enabled"/);
  assert.match(edge, /home\.tools\.enabled/);
  assert.match(edge, /home\.tools\.items/);
  assert.match(edge, /unit-converter/);
  assert.match(migration, /home\.tools\.items/);
  assert.match(migration, /jsonb_array_length\(p_value\) <= 4/);
  assert.match(homepage, /id="quick-tools"/);
  assert.match(publicScript, /payload\.quickTools/);
  assert.match(toolsPage, /id="tool-calculator"/);
  assert.match(toolsPage, /id="tool-percentage"/);
  assert.match(toolsPage, /id="tool-word-counter"/);
  assert.match(toolsPage, /id="tool-unit-converter"/);
  assert.match(toolsScript, /action=public-content/);
  assert.match(toolsScript, /unit-converter-form/);
});


test("Featured Resources are published-only and restricted to safe HTTPS URLs", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-9-featured-resources.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  assert.match(edge, /isSafeHttpsUrl/);
  assert.match(edge, /home\.featured\.items/);
  assert.match(migration, /home\.featured\.items/);
  assert.match(migration, /jsonb_array_length\(p_value\) <= 12/);
  assert.match(homepage, /id="featured-resources"/);
  assert.match(publicScript, /payload\.featuredResources/);
  assert.match(publicScript, /item\.published === true/);
  assert.match(publicScript, /noopener noreferrer/);
});


test("Announcements are admin-managed, date-validated, scheduled in India time and safely published", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-10-announcements.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  assert.match(adminHtml, /setting-announcements-enabled/);
  assert.match(adminHtml, /id="announcement-manager-list"/);
  assert.match(adminHtml, /id="announcement-add"/);
  assert.match(adminHtml, /id="save-announcements-settings"/);
  assert.match(adminJs, /saveSettingStrict\("home\.announcements\.items"/);
  assert.match(adminJs, /saveSettingStrict\("home\.announcements\.enabled"/);
  assert.match(edge, /isValidIsoDate/);
  assert.match(edge, /home\.announcements\.items/);
  assert.match(edge, /Asia\/Kolkata/);
  assert.match(migration, /home\.announcements\.items/);
  assert.match(migration, /jsonb_array_length\(p_value\) <= 20/);
  assert.match(homepage, /id="announcements"/);
  assert.match(publicScript, /payload\.announcements/);
  assert.match(publicScript, /noopener noreferrer/);
});


test("Smart Document Search is admin-configurable and exposes only validated public search settings", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-11-smart-search.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  const library = read("library.js");
  const libraryHtml = read("library.html");
  assert.match(adminJs, /setting-search-enabled/);
  assert.match(adminHtml, /setting-search-smart/);
  assert.match(adminHtml, /setting-search-filters/);
  assert.match(adminJs, /saveSetting\("home\.search\.max_results"/);
  assert.match(edge, /home\.search\.smart_enabled/);
  assert.match(edge, /home\.search\.max_results/);
  assert.match(migration, /home\.search\.placeholder/);
  assert.match(migration, /between 6 and 100/);
  assert.match(homepage, /id="smart-document-search"/);
  assert.match(publicScript, /payload\.search/);
  assert.match(library, /editDistanceAtMostOne/);
  assert.match(library, /selectedCategory/);
  assert.match(library, /selectedType/);
  assert.match(library, /library-load-more/);
  assert.match(libraryHtml, /library-category-filter/);
  assert.match(libraryHtml, /library-type-filter/);
});

test("All library category pages receive the same Smart Search controls and pagination", () => {
  for (const page of ["pdf-documents.html","study-notes.html","books-resources.html","other-documents.html","exam-materials.html","technology-guides.html"]) {
    const html = read(page);
    assert.match(html, /id="library-category-filter"/, page + " category filter");
    assert.match(html, /id="library-type-filter"/, page + " file type filter");
    assert.match(html, /id="library-load-more"/, page + " load more");
  }
  assert.match(read("library.js"), /query\.split\(\/\\s\+\//);
});


test("Learning Corner paths are admin-managed and expose only published steps with HTTPS links", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-12-learning-corner.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  assert.match(adminHtml, /setting-learning-enabled/);
  assert.match(adminHtml, /id="learning-path-list"/);
  assert.match(adminHtml, /id="learning-add-path"/);
  assert.match(adminHtml, /id="save-learning-settings"/);
  assert.match(adminJs, /saveSettingStrict\("home\.learning\.items"/);
  assert.match(edge, /home\.learning\.items/);
  assert.match(edge, /learningCorner:/);
  assert.match(migration, /home\.learning\.items/);
  assert.match(migration, /jsonb_array_length\(p_value\) <= 12/);
  assert.match(homepage, /id="learning-corner"/);
  assert.match(publicScript, /payload\.learningCorner/);
  assert.match(publicScript, /noopener noreferrer/);
});


test("User Feedback is moderated, privacy-conscious and controlled from Admin Settings", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const driveFiles = read("supabase/functions/google-drive-files/index.ts");
  const migration = read("supabase/phase-13-user-feedback.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  assert.match(adminJs, /setting-feedback-enabled/);
  assert.match(adminHtml, /feedback-inbox-list/);
  assert.match(adminJs, /feedback-moderate/);
  assert.match(adminHtml, /publish-approved-feedback/);
  assert.match(adminJs, /inbox-action-status/);
  assert.match(adminJs, /displayToggle\.checked=true/);
  assert.match(edge, /action === "submit-feedback"/);
  assert.match(edge, /action === "feedback-list"/);
  assert.match(edge, /action === "feedback-moderate"/);
  assert.match(edge, /submission_hash/);
  assert.match(edge, /consent: true/);
  assert.match(edge, /Object.keys\(input\).length !== 6/);
  assert.match(adminJs, /loadFeedbackInbox/);
  assert.match(migration, /pixel_forge_public_feedback/);
  assert.match(migration, /pixel_forge_feedback_audit/);
  assert.match(migration, /pixel_forge_moderate_feedback/);
  assert.match(migration, /consent boolean not null check \(consent = true\)/);
  assert.match(migration, /enable row level security/);
  assert.match(homepage, /id="public-feedback-form"/);
  assert.match(publicScript, /action=submit-feedback/);
  assert.match(publicScript, /approvedFeedback/);
});


test("SEO Management validates default metadata and retains page-specific override safeguards", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-14-seo-management.sql");
  const seoScript = read("seo.js");
  assert.match(adminHtml, /setting-seo-enabled/);
  assert.match(adminHtml, /id="setting-seo-title"/);
  assert.match(adminHtml, /id="setting-seo-description"/);
  assert.match(adminHtml, /data-setting-save="home\.seo"/);
  assert.match(edge, /home\.seo\.page_overrides/);
  assert.match(edge, /isSafeHttpsUrl/);
  assert.match(migration, /home\.seo\.default_description/);
  assert.match(migration, /home\.seo\.page_overrides/);
  assert.match(migration, /noindex,nofollow/);
  assert.match(seoScript, /og:title/);
  assert.match(seoScript, /canonical/);
  assert.match(seoScript, /robots/);
});

test("All public pages load the SEO metadata runtime", () => {
  for (const page of ["index.html","library.html","tools.html","pdf-documents.html","study-notes.html","books-resources.html","other-documents.html","exam-materials.html","technology-guides.html"]) {
    assert.match(read(page), /src="seo\.js"/, page + " SEO runtime");
  }
});


test("Homepage Layout Manager validates a complete section order and applies visibility and text overrides", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-15-homepage-layout.sql");
  const layoutScript = read("layout.js");
  assert.match(adminJs, /setting-layout-sections/);
  assert.match(adminJs, /saveSetting\("home\.layout\.sections"/);
  assert.match(edge, /home\.layout\.sections/);
  assert.match(migration, /home\.layout\.sections/);
  assert.match(migration, /jsonb_array_length\(p_value\) = 12/);
  assert.match(layoutScript, /layout-hidden/);
  assert.match(layoutScript, /main\.append\(section\)/);
});


test("Popular Resources rank published documents using privacy-preserving unique daily opens", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-16-popular-resources.sql");
  const homepage = read("index.html");
  const publicScript = read("script.js");
  const library = read("library.js");
  assert.match(adminHtml, /setting-popular-enabled/);
  assert.match(adminJs, /saveSetting\("home\.popular\.max_items"/);
  assert.match(edge, /action === "track-resource"/);
  assert.match(edge, /pixel_forge_track_resource_view/);
  assert.match(edge, /pixel_forge_resource_metrics/);
  assert.match(edge, /pixel_forge_published_documents/);
  assert.match(migration, /pixel_forge_resource_views/);
  assert.match(migration, /pixel_forge_resource_metrics/);
  assert.match(migration, /pixel_forge_track_resource_view/);
  assert.match(migration, /primary key \(source, resource_id, visitor_hash, view_day\)/);
  assert.match(homepage, /id="popular-resources"/);
  assert.match(publicScript, /payload\.popularResources/);
  assert.match(library, /action=track-resource/);
  assert.match(library, /resourceId: doc\.drive_file_id/);
});


test("PDF preview is a public-library-only feature controlled by an audited admin setting", () => {
  const library = read("library.js");
  const libraryHtml = read("library.html");
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-17-library-pdf-preview.sql");
  assert.ok(library.includes("pdfPreviewEnabled"));
  assert.ok(library.includes('doc.ext.toLowerCase() === "pdf"'));
  assert.ok(library.includes('previewFrame.src = "about:blank"'));
  assert.ok(library.includes("Open document"));
  assert.ok(libraryHtml.includes('id="pdf-preview-dialog"'));
  assert.ok(libraryHtml.includes('id="pdf-preview-fullscreen"'));
  assert.ok(adminHtml.includes("setting-library-pdf-preview-enabled"));
  assert.ok(adminJs.includes('saveSetting("home.library.pdf_preview_enabled"'));
  assert.ok(edge.includes("home.library.pdf_preview_enabled"));
  assert.ok(edge.includes('pdfPreviewEnabled: values["home.library.pdf_preview_enabled"] !== false'));
  assert.ok(migration.includes("home.library.pdf_preview_enabled"));
  assert.ok(migration.includes("when 'home.library.pdf_preview_enabled' then jsonb_typeof(p_value) = 'boolean'"));
  assert.ok(migration.includes("revoke all on function public.pixel_forge_update_site_setting(text, jsonb, text) from public, anon, authenticated"));
  assert.ok(migration.includes("grant execute on function public.pixel_forge_update_site_setting(text, jsonb, text) to service_role"));
});

test("Google Drive and Private Vault support sequential multi-file uploads", () => {
  const html = read("admin.html");
  const js = read("admin.js");
  assert.match(html, /id="document-file"[^>]*multiple/);
  assert.match(html, /id="google-drive-file"[^>]*multiple/);
  assert.ok(js.includes("Array.from(fileInput.files || [])"));
  assert.ok(js.includes("Array.from(googleDriveFileInput ? googleDriveFileInput.files : [])"));
  assert.ok(js.includes("uploadLargeFile(BUCKET, currentUserUid + \"/\" + objectName, file, index + 1, uploadable.length)"));
  assert.ok(js.includes("uploadGoogleDriveSingleFile(files[index], index + 1, files.length, targetAccountId, targetFolderId)"));
  assert.ok(js.includes('currentPermissions.has("vault.write")'));
  assert.ok(js.includes('currentPermissions.has("drive.write")'));
  assert.ok(js.includes("Uploaded \" + succeeded + \" of \" + files.length"));
});


test("Published documents support safe admin-managed tags and public tag search", () => {
  const admin = read("admin.js");
  const library = read("library.js");
  const drive = read("supabase/functions/google-drive-files/index.ts");
  const migration = read("supabase/phase-18-document-tags.sql");
  assert.match(admin, /normalizeDocumentTags/);
  assert.match(admin, /metadata: \{ tags \}/);
  assert.match(admin, /tagsInput\.value/);
  assert.match(admin, /tags\s*$/m);
  assert.match(library, /doc\.tags/);
  assert.match(library, /file\.metadata\?\.tags/);
  assert.match(library, /tagButton\.addEventListener/);
  assert.match(drive, /normalizeTags/);
  assert.match(drive, /tags, published: true/);
  assert.ok(migration.includes("add column if not exists tags text[]"));
  assert.match(migration, /using gin \(tags\)/);
});


test("Document uploads protect existing names in Private Vault and Google Drive", () => {
  const admin = read("admin.js");
  const drive = read("supabase/functions/google-drive-files/index.ts");
  assert.ok(admin.includes("Overwrite protection: skipped existing/duplicate name(s)"));
  assert.ok(admin.includes("const latestFiles = await listAllStorageFiles(BUCKET, currentUserUid)"));
  assert.ok(admin.includes("safeFileName(displayFileName(item.name)).toLocaleLowerCase()"));
  assert.ok(admin.includes("No existing documents were overwritten."));
  assert.ok(drive.includes("DUPLICATE_FILE_NAME"));
  assert.ok(drive.includes("Could not check existing Google Drive filenames. Upload was stopped"));
  assert.ok(drive.includes("duplicatePayload.files.length"));
});


test("Private Vault documents support independently saved private tags", () => {
  const admin = read("admin.js");
  const drive = read("supabase/functions/google-drive-files/index.ts");
  const migration = read("supabase/phase-19-private-document-tags.sql");
  assert.ok(admin.includes('privateVaultTagsRequest("private-tags-list")'));
  assert.ok(admin.includes('privateVaultTagsRequest("private-tags-save"'));
  assert.ok(admin.includes("savePrivateDocumentTags(path, tagsInput.value, saveTags)"));
  assert.ok(admin.includes('saveTags.textContent = "Save tags"'));
  assert.ok(admin.includes("tagsInput.value = (privateTags.get(path)"));
  const driveList = admin.slice(admin.indexOf("async function loadGoogleDriveFiles"), admin.indexOf("async function publishGoogleDriveFile"));
  const vaultList = admin.slice(admin.indexOf("async function loadFiles()"), admin.indexOf("async function privateVaultTagsRequest"));
  assert.ok(!driveList.includes("saveTags"));
  assert.ok(vaultList.includes("actions.append(selectionLabel, download, category, tagsInput, saveTags, publish, unpublish, remove)"));
  assert.ok(drive.includes('action === "private-tags-list"'));
  assert.ok(drive.includes('action === "private-tags-save"'));
  assert.ok(drive.includes('eq("owner_uid", uid).eq("storage_path", storagePath)'));
  assert.ok(drive.includes('action === "private-tags-save" ? "vault.write"'));
  assert.ok(migration.includes("pixel_forge_private_document_tags"));
  assert.ok(migration.includes("enable row level security"));
  assert.ok(migration.includes("revoke all"));
});


test("Private Vault supports bulk publish, unpublish, delete and shared private tags", () => {
  const html = read("admin.html");
  const admin = read("admin.js");
  const drive = read("supabase/functions/google-drive-files/index.ts");
  const css = read("admin.css");
  assert.ok(html.includes('id="bulk-actions-toolbar"'));
  assert.ok(html.includes('id="select-all-vault-files"'));
  assert.ok(html.includes('id="bulk-publish-category"'));
  assert.ok(html.includes('id="bulk-tags-input"'));
  assert.ok(html.includes('id="bulk-apply-tags"'));
  assert.ok(html.includes('id="bulk-publish"'));
  assert.ok(html.includes('id="bulk-unpublish"'));
  assert.ok(html.includes('id="bulk-delete"'));
  assert.ok(admin.includes('selection.className = "bulk-select-checkbox"'));
  assert.ok(admin.includes("async function applyBulkPrivateTags()"));
  assert.ok(admin.includes("async function publishSelectedVaultFiles()"));
  assert.ok(admin.includes("async function unpublishSelectedVaultFiles()"));
  assert.ok(admin.includes("async function deleteSelectedVaultFiles()"));
  assert.ok(admin.includes('privateVaultTagsRequest("private-tags-delete"'));
  assert.ok(drive.includes('action === "private-tags-delete" ? "vault.delete"'));
  assert.ok(drive.includes('action === "private-tags-delete"'));
  assert.ok(css.includes(".bulk-actions-toolbar"));
});


test("location sharing requires browser geolocation permission and explicit consent", () => {
  const publicScript = read("script.js");
  const analytics = read("supabase/functions/analytics/index.ts");
  const migration = read("supabase/phase-20-location-sharing.sql");
  assert.match(publicScript, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(publicScript, /window\.confirm\(/);
  assert.match(publicScript, /Share your approximate location/);
  assert.match(publicScript, /location, consent: true/);
  assert.match(analytics, /browser-geolocation-explicit-consent/);
  assert.match(analytics, /location_latitude: location\.latitude/);
  assert.match(migration, /location_latitude/);
  assert.match(migration, /location_longitude/);
});

test("public Contact form sends messages to the private admin inbox", () => {
  const homepage = read("index.html");
  const publicScript = read("script.js");
  const settings = read("supabase/functions/site-settings/index.ts");
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const migration = read("supabase/phase-21-contact-inbox.sql");
  assert.match(homepage, /id="public-contact-form"/);
  assert.match(homepage, /id="contact-message"/);
  assert.match(publicScript, /action=submit-contact/);
  assert.doesNotMatch(publicScript, /window\.location\.href\s*=\s*"mailto:/);
  assert.match(settings, /action === "submit-contact"/);
  assert.match(settings, /action === "contact-list"/);
  assert.match(settings, /action === "contact-status"/);
  assert.match(adminHtml, /id="contact-inbox-list"/);
  assert.match(adminJs, /loadContactInbox/);
  assert.match(migration, /pixel_forge_contact_messages/);
  assert.match(migration, /enable row level security/);
});

test("Google Drive combined account view scopes file actions and upload targets", () => {
  const html = read("admin.html");
  const js = read("admin.js");
  assert.match(html, /All connected Drives/);
  assert.match(js, /let selectedDriveAccountId = "__all__"/);
  assert.match(js, /selectedDriveAccountId === "__all__"[\s\S]*?googleDriveAccounts\.filter\(account => account\.connected\)/);
  assert.match(js, /driveAccountId: account\.id/);
  assert.match(js, /selectionKey: account\.id \+ "::" \+ file\.id/);
  assert.match(js, /options\.accountId \|\| selectedDriveAccountId/);
  assert.match(js, /accountId: file\.driveAccountId/);
  assert.match(js, /targetAccountId = selectedDriveAccountId/);
  assert.match(js, /targetFolderId = selectedDriveFolderId/);
  assert.match(js, /uploadGoogleDriveSingleFile\(files\[index\], index \+ 1, files\.length, targetAccountId, targetFolderId\)/);
  assert.match(js, /accountErrors = results\.filter\(result => result\.error\)/);
});

test("Google Drive file list supports multi-select and permission-gated bulk actions", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  assert.match(adminHtml, /id="drive-bulk-toolbar"/);
  assert.match(adminHtml, /id="drive-select-all"/);
  assert.match(adminHtml, /id="drive-bulk-publish"/);
  assert.match(adminHtml, /id="drive-bulk-unpublish"/);
  assert.match(adminHtml, /id="drive-bulk-delete"/);
  assert.match(adminJs, /select\.className = "drive-file-select"/);
  assert.match(adminJs, /selectedDriveFileIds/);
  assert.match(adminJs, /currentPermissions\.has\("vault\.publish"\)/);
  assert.match(adminJs, /currentPermissions\.has\("drive\.delete"\)/);
  assert.match(adminJs, /runDriveBulkAction\("publish"\)/);
  assert.match(adminJs, /runDriveBulkAction\("unpublish"\)/);
  assert.match(adminJs, /runDriveBulkAction\("delete"\)/);
});

test("Private Vault assigns publishedCategory only after it is initialized", () => {
  const adminJs = read("admin.js");
  const declaration = adminJs.indexOf("const publishedCategory = publishedInfo && publishedInfo.category;");
  const datasetAssignment = adminJs.indexOf('li.dataset.publishedCategory = publishedCategory || "";');
  assert.notEqual(declaration, -1);
  assert.notEqual(datasetAssignment, -1);
  assert.ok(datasetAssignment > declaration, "dataset assignment must follow the publishedCategory declaration");
});


test("Public Contact form delivers messages to a private admin inbox", () => {
  const homepage = read("index.html");
  const publicScript = read("script.js");
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const edge = read("supabase/functions/site-settings/index.ts");
  const migration = read("supabase/phase-21-contact-inbox.sql");
  assert.match(homepage, /id="public-contact-form"/);
  assert.match(publicScript, /action=submit-contact/);
  assert.doesNotMatch(publicScript, /window\.location\.href\s*=\s*"mailto:/);
  assert.match(edge, /action === "submit-contact"/);
  assert.match(edge, /pixel_forge_contact_messages/);
  assert.match(edge, /action === "contact-list"/);
  assert.match(edge, /action === "contact-status"/);
  assert.match(adminHtml, /id="contact-inbox-list"/);
  assert.match(adminJs, /loadContactInbox/);
  assert.match(adminJs, /Reply by email/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.pixel_forge_contact_messages from anon, authenticated/);
});

test("PYQ uploads are listed from Owner Drive with rename and delete management", () => {
  const adminHtml = read("admin.html");
  const adminJs = read("admin.js");
  const driveFiles = read("supabase/functions/google-drive-files/index.ts");
  assert.match(adminHtml, /pyq-drive-library-list/);
  assert.match(adminHtml, /href="#pyq-upload" data-permission="drive.write"/);
  assert.match(adminJs, /loadOwnerPyqDriveLibrary/);
  assert.match(adminJs, /PYQ-/);
  assert.match(adminJs, /googleDriveRequest\("rename"/);
  assert.match(adminJs, /del\.hidden=!currentPermissions\.has\("drive\.delete"\)/);
  assert.match(driveFiles, /action === "rename"/);
  assert.match(driveFiles, /method: "PATCH"/);
});
