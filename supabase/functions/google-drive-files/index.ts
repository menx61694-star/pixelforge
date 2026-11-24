import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://pixelforge.jo3.org",
  ...(Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ? [Deno.env.get("PIXELFORGE_ADMIN_ORIGIN")!] : []),
  "http://localhost:8000",
]);
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_CHUNK_SIZE = 5 * 1024 * 1024;
const FIREBASE_PROJECT_ID = "pixelforge-66f0c";

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, content-range, range, x-drive-upload-url",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition, Content-Length, Content-Range, Accept-Ranges",
    "Vary": "Origin",
  };
}
const json = (body: unknown, status = 200, request?: Request) =>
  new Response(JSON.stringify(body), { status, headers: { ...(request ? corsHeaders(request) : {}), "Content-Type": "application/json" } });
function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}
function fromBase64(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
async function verifyFirebaseUser(request: Request): Promise<string | null> {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(required("FIREBASE_WEB_API_KEY"))}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: match[1] }),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const account = payload.users?.[0];
  if (!account || account.disabled === true) return null;
  const tokenPayload = match[1].split(".")[1];
  if (!tokenPayload) return null;
  const normalized = tokenPayload.replace(/-/g, "+").replace(/_/g, "/");
  const claims = JSON.parse(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)));
  if (claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
      claims.aud !== FIREBASE_PROJECT_ID || claims.sub !== account.localId) return null;
  return account.localId as string;
}
function supabaseAdmin() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function getAccessToken(accountId = "pixelForge-owner") {
  const db = supabaseAdmin();
  const { data, error } = await db.from("google_drive_oauth_tokens")
    .select("refresh_token_encrypted").eq("id", accountId).maybeSingle();
  if (error) throw error;
  if (!data?.refresh_token_encrypted) throw new Error("Google Drive is not connected. Connect the owner account first.");
  const [ivPart, cipherPart] = data.refresh_token_encrypted.split(".");
  if (!ivPart || !cipherPart) throw new Error("Stored Google Drive token has an invalid format.");
  const rawKey = fromBase64(required("GOOGLE_TOKEN_ENCRYPTION_KEY"));
  if (rawKey.length !== 32) throw new Error("Google token encryption key must contain 32 bytes.");
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, ["decrypt"]);
  const refreshBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(ivPart)) },
    key,
    toArrayBuffer(fromBase64(cipherPart)),
  );
  const refreshToken = new TextDecoder().decode(refreshBytes);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    console.error("Google refresh failed:", payload.error ?? "unknown");
    throw new Error("Google Drive authorization expired or was revoked. Reconnect Google Drive.");
  }
  return payload.access_token as string;
}
async function hasDrivePermission(uid: string, permission: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data: user, error: userError } = await db.from("pixel_forge_users")
    .select("role,status").eq("uid", uid).maybeSingle();
  if (userError) throw userError;
  if (!user || user.status !== "active") return false;
  const { data, error } = await db.from("pixel_forge_role_permissions")
    .select("allowed").eq("role", user.role).eq("permission", permission).maybeSingle();
  if (error) throw error;
  return data?.allowed === true;
}
function normalizeTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 10) return null;
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") return null;
    const tag = item.trim().replace(/\s+/g, " ");
    if (!tag || tag.length > 32 || !/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(tag)) return null;
    const key = tag.toLocaleLowerCase();
    if (!seen.has(key)) { seen.add(key); tags.push(tag); }
  }
  return tags;
}
function safeUploadUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" ||
      url.pathname !== "/upload/drive/v3/files" || !url.searchParams.has("upload_id")) {
    throw new Error("Invalid Google Drive upload session URL.");
  }
  return url;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  try {
    const origin = request.headers.get("Origin") ?? "";
    if (origin && !allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const selectedAccountId = url.searchParams.get("accountId") || "pixelForge-owner";

    // Public listing exposes metadata only; public-download verifies the published record.
    if (request.method === "GET" && action === "public-list") {
      const { data, error } = await supabaseAdmin().from("pixel_forge_published_documents")
        .select("drive_file_id,category,title,mime_type,size_bytes,tags,updated_at")
        .eq("source", "google_drive").eq("published", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return json({ documents: data ?? [] }, 200, request);
    }
    if (request.method === "GET" && action === "public-download") {
      const fileId = url.searchParams.get("id") ?? "";
      if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) return json({ error: "Invalid Drive file ID." }, 400, request);
      const db = supabaseAdmin();
      const { data: published, error: publishedError } = await db.from("pixel_forge_published_documents")
        .select("drive_file_id,title,mime_type,tags,account_id")
        .eq("source", "google_drive").eq("drive_file_id", fileId).eq("published", true).maybeSingle();
      if (publishedError) throw publishedError;
      if (!published) return json({ error: "This document is not published." }, 404, request);
      const accessToken = await getAccessToken(published.account_id || "pixelForge-owner");
      const range = request.headers.get("Range");
      const response = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media", {
        headers: { Authorization: "Bearer " + accessToken, ...(range ? { Range: range } : {}) }
      });
      if (!response.ok && response.status !== 206) {
        if (response.status === 404) {
          await supabaseAdmin().from("pixel_forge_published_documents")
            .delete().eq("source", "google_drive").eq("drive_file_id", fileId).eq("account_id", published.account_id || "pixelForge-owner");
          return json({ error: "The original Drive file is no longer available; its public listing was removed." }, 404, request);
        }
        return json({ error: "Published document could not be retrieved." }, 502, request);
      }
      const headers = new Headers(corsHeaders(request));
      headers.set("Content-Type", published.mime_type || response.headers.get("Content-Type") || "application/octet-stream");
      headers.set("Content-Disposition", "inline; filename*=UTF-8''" + encodeURIComponent(published.title || "document"));
      headers.set("Cache-Control", "public, max-age=60");
      headers.set("Accept-Ranges", response.headers.get("Accept-Ranges") || "bytes");
      for (const name of ["Content-Length", "Content-Range"]) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(response.body, { status: response.status, headers });
    }

    const uid = await verifyFirebaseUser(request);
    if (!uid) return json({ error: "Firebase authentication required." }, 401, request);
    const requiredPermission = ["publish", "unpublish"].includes(action ?? "") ? "vault.publish"
      : action === "delete" ? "drive.delete"
      : action === "rename" ? "drive.write"
      : action === "private-tags-save" ? "vault.write"
      : action === "private-tags-delete" ? "vault.delete"
      : action === "private-tags-list" ? "vault.read"
      : ["create-upload-session", "upload-chunk"].includes(action ?? "") ? "drive.write" : "drive.read";
    if (!(await hasDrivePermission(uid, requiredPermission))) {
      return json({ error: "Your role does not allow this Google Drive action." }, 403, request);
    }
    if (request.method === "GET" && action === "private-tags-list") {
      const { data, error } = await supabaseAdmin().from("pixel_forge_private_document_tags")
        .select("storage_path,tags").eq("owner_uid", uid);
      if (error) throw error;
      return json({ documents: data ?? [] }, 200, request);
    }
    if (request.method === "POST" && action === "private-tags-delete") {
      const input = await request.json();
      const storagePaths = Array.isArray(input.storagePaths) ? input.storagePaths : [];
      if (!storagePaths.length || storagePaths.length > 100 ||
          storagePaths.some((path: unknown) => typeof path !== "string" ||
            path.length > 512 || !path.startsWith(uid + "/") ||
            path.split("/").some((part: string) => !part || part === "." || part === ".."))) {
        return json({ error: "A valid list of up to 100 owned private document paths is required." }, 400, request);
      }
      const { error } = await supabaseAdmin().from("pixel_forge_private_document_tags")
        .delete().eq("owner_uid", uid).in("storage_path", storagePaths);
      if (error) throw error;
      return json({ deleted: true, count: storagePaths.length }, 200, request);
    }
    if (request.method === "POST" && action === "private-tags-save") {
      const input = await request.json();
      const storagePath = typeof input.storagePath === "string" ? input.storagePath.trim() : "";
      const tags = normalizeTags(input.tags);
      if (!storagePath || storagePath.length > 512 || !storagePath.startsWith(uid + "/") ||
          storagePath.split("/").some((part: string) => !part || part === "." || part === "..") || !tags) {
        return json({ error: "A valid private document path and up to 10 valid tags are required." }, 400, request);
      }
      const fileName = storagePath.slice(uid.length + 1);
      const db = supabaseAdmin();
      const { data: files, error: listError } = await db.storage.from("private-documents").list(uid, {
        limit: 1000, search: fileName
      });
      if (listError) throw listError;
      if (!(files ?? []).some((file) => file.name === fileName && Boolean(file.id))) {
        return json({ error: "The private document was not found. Refresh the vault and try again." }, 404, request);
      }
      if (tags.length === 0) {
        const { error } = await db.from("pixel_forge_private_document_tags").delete()
          .eq("owner_uid", uid).eq("storage_path", storagePath);
        if (error) throw error;
        return json({ saved: true, tags: [] }, 200, request);
      }
      const { error } = await db.from("pixel_forge_private_document_tags").upsert({
        owner_uid: uid, storage_path: storagePath, tags, updated_at: new Date().toISOString()
      }, { onConflict: "owner_uid,storage_path" });
      if (error) throw error;
      return json({ saved: true, tags }, 200, request);
    }
    if (request.method === "GET" && action === "status") {
      const db = supabaseAdmin();
      const { data: accounts, error } = await db.from("google_drive_oauth_tokens")
        .select("id,account_email,display_name,connected_at").order("connected_at", { ascending: false });
      if (error) throw error;
      const accountDetails = await Promise.all((accounts ?? []).map(async (account) => {
        try {
          const token = await getAccessToken(account.id);
          const aboutResponse = await fetch("https://www.googleapis.com/drive/v3/about?fields=user,storageQuota", { headers: { Authorization: "Bearer " + token } });
          const about = aboutResponse.ok ? await aboutResponse.json().catch(() => ({})) : {};
          const quota = about.storageQuota ?? {};
          return { id: account.id, email: account.account_email, name: account.display_name, connected: Boolean(account.connected_at), storageAvailable: aboutResponse.ok && Boolean(quota.limit), connectedAt: account.connected_at,
            storageTotal: quota.limit ? Number(quota.limit) : null, storageUsed: quota.usage ? Number(quota.usage) : null, storageRemaining: quota.limit && quota.usage ? Math.max(0, Number(quota.limit) - Number(quota.usage)) : null };
        } catch (_) {
          return { id: account.id, email: account.account_email, name: account.display_name, connected: false, connectedAt: account.connected_at, storageTotal: 0, storageUsed: 0, storageRemaining: 0 };
        }
      }));
      const selectedId = url.searchParams.get("accountId") || "pixelForge-owner";
      const selected = accountDetails.find((account) => account.id === selectedId);
      return json({ accounts: accountDetails, accountCount: accountDetails.length, accountId: selectedId, connected: selected?.connected === true, connectedAt: selected?.connectedAt ?? null }, 200, request);
    }
    if (request.method === "GET" && action === "published-list") {
      const { data, error } = await supabaseAdmin().from("pixel_forge_published_documents")
        .select("drive_file_id,category,title,tags")
        .eq("source", "google_drive").eq("owner_uid", uid).eq("published", true);
      if (error) throw error;
      return json({ documents: data ?? [] }, 200, request);
    }
    if (request.method === "POST" && ["publish", "unpublish"].includes(action ?? "")) {
      const input = await request.json();
      const fileId = typeof input.fileId === "string" ? input.fileId : "";
      if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) return json({ error: "Invalid Drive file ID." }, 400, request);
      const db = supabaseAdmin();
      if (action === "unpublish") {
        const { error } = await db.from("pixel_forge_published_documents").delete()
          .eq("source", "google_drive").eq("drive_file_id", fileId).eq("owner_uid", uid).eq("account_id", selectedAccountId);
        if (error) throw error;
        return json({ unpublished: true }, 200, request);
      }
      const category = typeof input.category === "string" ? input.category : "";
      const allowedCategories = ["pdf-documents", "study-notes", "books-resources", "other-documents", "exam-materials", "technology-guides"];
      const title = typeof input.title === "string" ? input.title.trim().slice(0, 240) : "";
      const mimeType = typeof input.mimeType === "string" ? input.mimeType.slice(0, 160) : "application/octet-stream";
      const sizeBytes = Number(input.sizeBytes);
      const tags = normalizeTags(input.tags);
      if (!allowedCategories.includes(category) || !title || !tags) return json({ error: "A valid category, title and up to 10 valid tags are required." }, 400, request);
      const { error } = await db.from("pixel_forge_published_documents").upsert({
        source: "google_drive", owner_uid: uid, drive_file_id: fileId, storage_path: null, account_id: selectedAccountId,
        category, title, mime_type: mimeType, size_bytes: Number.isSafeInteger(sizeBytes) && sizeBytes > 0 ? sizeBytes : null,
        tags, published: true, updated_at: new Date().toISOString()
      }, { onConflict: "source,drive_file_id" });
      if (error) throw error;
      return json({ published: true }, 200, request);
    }
    if (!/^[a-zA-Z0-9_-]{3,80}$/.test(selectedAccountId)) return json({ error: "Invalid Drive account selection." }, 400, request);
    const accessToken = await getAccessToken(selectedAccountId);
    const googleHeaders = { Authorization: "Bearer " + accessToken };

    if (request.method === "GET" && action === "folders") {
      const query = new URLSearchParams({
        q: "trashed = false and mimeType = 'application/vnd.google-apps.folder'",
        pageSize: "1000",
        orderBy: "name",
        fields: "files(id,name,mimeType,parents),nextPageToken",
        spaces: "drive",
        ...(url.searchParams.get("pageToken") ? { pageToken: url.searchParams.get("pageToken")! } : {}),
        
      });
      const response = await fetch("https://www.googleapis.com/drive/v3/files?" + query, { headers: googleHeaders });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return json({ error: "Google Drive folder listing failed.", details: payload.error?.message }, 502, request);
      }
      return json({ folders: payload.files ?? [], nextPageToken: payload.nextPageToken ?? null }, 200, request);
    }

    if (request.method === "GET" && action === "list") {
      const scope = url.searchParams.get("scope");
      const query = new URLSearchParams({
        q: scope === "pyq"
          ? "trashed = false and (appProperties has { key='pixelForgeUploadType' and value='pyq' } or name contains 'PYQ-')"
          : "trashed = false",
        pageSize: "100",
        orderBy: "modifiedTime desc",
        fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,appProperties),nextPageToken",
      });
      const response = await fetch("https://www.googleapis.com/drive/v3/files?" + query, { headers: googleHeaders });
      const payload = await response.json();
      if (!response.ok) return json({ error: "Google Drive file listing failed.", details: payload.error?.message }, 502, request);
      return json({ files: payload.files ?? [], nextPageToken: payload.nextPageToken ?? null }, 200, request);
    }

    if (request.method === "POST" && action === "create-upload-session") {
      const input = await request.json();
      const name = typeof input.name === "string" ? input.name.trim().slice(0, 180) : "";
      const mimeType = typeof input.mimeType === "string" ? input.mimeType : "";
      const size = Number(input.size);
      const parentFolderId = typeof input.parentFolderId === "string" ? input.parentFolderId.trim() : "";
      if (!name || !["application/pdf", "image/jpeg", "image/png"].includes(mimeType) ||
          !Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_SIZE ||
          (parentFolderId && !/^[a-zA-Z0-9_-]{10,200}$/.test(parentFolderId))) {
        return json({ error: "Choose a non-empty PDF, JPEG or PNG file up to 2 GB and a valid destination folder." }, 400, request);
      }
      if (parentFolderId) {
        const folderResponse = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(parentFolderId) + "?fields=id,mimeType,trashed", { headers: googleHeaders });
        const folder = await folderResponse.json().catch(() => ({}));
        if (!folderResponse.ok || folder.mimeType !== "application/vnd.google-apps.folder" || folder.trashed === true) {
          return json({ error: "The selected upload destination is not a valid folder in this Google Drive account." }, 400, request);
        }
      }
      // Refuse same-name uploads instead of creating a confusing duplicate or replacing a document.
      const escapedName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const duplicateParentQuery = parentFolderId ? "'" + parentFolderId + "' in parents" : "'root' in parents";
      const duplicateQuery = new URLSearchParams({
        q: "trashed = false and " + duplicateParentQuery + " and name = '" + escapedName + "'",
        pageSize: "1",
        fields: "files(id,name)",
        spaces: "drive"
      });
      const duplicateResponse = await fetch("https://www.googleapis.com/drive/v3/files?" + duplicateQuery, {
        headers: googleHeaders
      });
      const duplicatePayload = await duplicateResponse.json().catch(() => ({}));
      if (!duplicateResponse.ok) {
        return json({ error: "Could not check existing Google Drive filenames. Upload was stopped to protect existing documents." }, 502, request);
      }
      if (Array.isArray(duplicatePayload.files) && duplicatePayload.files.length) {
        return json({
          error: "A Google Drive document with this exact name already exists. Rename the new file or manage the existing document first.",
          code: "DUPLICATE_FILE_NAME"
        }, 409, request);
      }
      const isPyq = input.isPyq === true;
      const metadata = { name, mimeType, ...(parentFolderId ? { parents: [parentFolderId] } : {}), ...(isPyq ? { appProperties: { pixelForgeUploadType: "pyq" } } : {}) };
      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,modifiedTime,webViewLink", {
        method: "POST",
        headers: {
          ...googleHeaders,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(size),
        },
        body: JSON.stringify(metadata),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return json({ error: "Could not create Google Drive upload session.", details: payload.error?.message }, 502, request);
      }
      const uploadUrl = response.headers.get("Location");
      if (!uploadUrl) throw new Error("Google Drive did not return an upload session.");
      safeUploadUrl(uploadUrl);
      return json({ uploadUrl, chunkSize: MAX_CHUNK_SIZE }, 200, request);
    }

    if (request.method === "POST" && action === "upload-chunk") {
      const uploadUrlHeader = request.headers.get("X-Drive-Upload-Url") ?? "";
      const uploadUrl = safeUploadUrl(uploadUrlHeader);
      const contentRange = request.headers.get("Content-Range") ?? "";
      const rangeMatch = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
      if (!rangeMatch) return json({ error: "Invalid upload Content-Range." }, 400, request);
      const rangeStart = Number(rangeMatch[1]);
      const rangeEnd = Number(rangeMatch[2]);
      const totalSize = Number(rangeMatch[3]);
      const body = await request.arrayBuffer();
      if (!Number.isSafeInteger(totalSize) || totalSize <= 0 || totalSize > MAX_FILE_SIZE ||
          rangeEnd < rangeStart || rangeEnd >= totalSize ||
          rangeEnd - rangeStart + 1 !== body.byteLength ||
          !body.byteLength || body.byteLength > MAX_CHUNK_SIZE) {
        return json({ error: "Upload chunk size or byte range is invalid." }, 400, request);
      }
      const response = await fetch(uploadUrl.toString(), {
        method: "PUT",
        headers: { ...googleHeaders, "Content-Length": String(body.byteLength), "Content-Range": contentRange },
        body,
      });
      if (response.status === 308) {
        return json({ complete: false, range: response.headers.get("Range") }, 308, request);
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return json({ error: "Google Drive upload chunk failed.", details: payload.error?.message }, 502, request);
      return json({ complete: true, file: payload }, 200, request);
    }

    if (request.method === "GET" && action === "download") {
      const fileId = url.searchParams.get("id") ?? "";
      if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) return json({ error: "Invalid Drive file ID." }, 400, request);
      const response = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media", { headers: googleHeaders });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return json({ error: "Google Drive download failed.", details: payload.error?.message }, 502, request);
      }
      const headers = new Headers(corsHeaders(request));
      headers.set("Content-Type", response.headers.get("Content-Type") ?? "application/octet-stream");
      headers.set("Content-Disposition", 'attachment; filename="drive-file"');
      const length = response.headers.get("Content-Length");
      if (length) headers.set("Content-Length", length);
      return new Response(response.body, { status: 200, headers });
    }

    if (request.method === "POST" && action === "rename") {
      const input = await request.json();
      const fileId = typeof input.id === "string" ? input.id : "";
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId) || !name || name.length > 180) {
        return json({ error: "A valid Drive file ID and filename (1–180 characters) are required." }, 400, request);
      }
      const response = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId), {
        method: "PATCH", headers: { ...googleHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return json({ error: "Google Drive rename failed.", details: payload.error?.message }, 502, request);
      return json({ renamed: true, file: payload }, 200, request);
    }

    if (request.method === "POST" && action === "delete") {
      const input = await request.json();
      const fileId = typeof input.id === "string" ? input.id : "";
      if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) return json({ error: "Invalid Drive file ID." }, 400, request);
      const response = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId), {
        method: "DELETE", headers: googleHeaders,
      });
      if (!response.ok && response.status !== 404) {
        const payload = await response.json().catch(() => ({}));
        return json({ error: "Google Drive delete failed.", details: payload.error?.message }, 502, request);
      }
      const { error: unpublishError } = await supabaseAdmin().from("pixel_forge_published_documents")
        .delete().eq("source", "google_drive").eq("drive_file_id", fileId);
      if (unpublishError) throw unpublishError;
      return json({ deleted: true }, 200, request);
    }

    return json({ error: "Unsupported Drive action or HTTP method." }, 405, request);
  } catch (error) {
    console.error("Google Drive files error:", error);
    return json({ error: error instanceof Error ? error.message : "Google Drive request failed." }, 500, request);
  }
});
