import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ?? "https://pixelforge.jo3.org",
  "http://localhost:8000",
]);
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_CHUNK_SIZE = 5 * 1024 * 1024;

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type, content-range, x-drive-upload-url",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Disposition, Range",
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
async function verifyFirebaseAdmin(request: Request): Promise<boolean> {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(required("FIREBASE_WEB_API_KEY"))}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: match[1] }),
  });
  if (!response.ok) return false;
  const payload = await response.json();
  const account = payload.users?.[0];
  return account?.localId === required("PIXELFORGE_ADMIN_UID") && account.disabled !== true;
}
function supabaseAdmin() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function getAccessToken() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("google_drive_oauth_tokens")
    .select("refresh_token_encrypted").eq("id", "pixelForge-owner").maybeSingle();
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
    if (!allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, request);
    if (!(await verifyFirebaseAdmin(request))) return json({ error: "Administrator authentication required." }, 401, request);

    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const accessToken = await getAccessToken();
    const googleHeaders = { Authorization: "Bearer " + accessToken };

    if (request.method === "GET" && action === "list") {
      const query = new URLSearchParams({
        q: "trashed = false",
        pageSize: "100",
        orderBy: "modifiedTime desc",
        fields: "files(id,name,mimeType,size,modifiedTime,webViewLink),nextPageToken",
      });
      const response = await fetch("https://www.googleapis.com/drive/v3/files?" + query, { headers: googleHeaders });
      const payload = await response.json();
      if (!response.ok) return json({ error: "Google Drive file listing failed.", details: payload.error?.message }, 502, request);
      return json({ files: payload.files ?? [], nextPageToken: payload.nextPageToken ?? null }, 200, request);
    }

    if (request.method === "POST" && action === "create-upload-session") {
      const input = await request.json();
      const name = typeof input.name === "string" ? input.name.trim().slice(0, 180) : "";
      const mimeType = typeof input.mimeType === "string" ? input.mimeType : "application/octet-stream";
      const size = Number(input.size);
      if (!name || !Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_SIZE) {
        return json({ error: "Choose a non-empty file up to 2 GB." }, 400, request);
      }
      const metadata = { name, mimeType };
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
      if (!/^bytes \d+-\d+\/\d+$/.test(contentRange)) return json({ error: "Invalid upload Content-Range." }, 400, request);
      const body = await request.arrayBuffer();
      if (!body.byteLength || body.byteLength > MAX_CHUNK_SIZE) return json({ error: "Upload chunks must be between 1 byte and 5 MiB." }, 400, request);
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
      return json({ deleted: true }, 200, request);
    }

    return json({ error: "Unsupported Drive action or HTTP method." }, 405, request);
  } catch (error) {
    console.error("Google Drive files error:", error);
    return json({ error: error instanceof Error ? error.message : "Google Drive request failed." }, 500, request);
  }
});
