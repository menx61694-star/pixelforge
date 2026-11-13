import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = "pixelforge-66f0c";
const allowedOrigins = new Set([
  Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ?? "https://pixelforge.jo3.org",
  "http://localhost:8000",
]);
const allowedPaths = new Set([
  "/", "/index.html", "/library.html", "/pdf-documents.html",
  "/study-notes.html", "/books-resources.html", "/other-documents.html",
  "/exam-materials.html", "/technology-guides.html",
]);

function cors(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(body: unknown, status = 200, request?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(request ? cors(request) : {}), "Content-Type": "application/json" },
  });
}
function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}
function dbAdmin() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function lookupFirebaseUser(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(required("FIREBASE_WEB_API_KEY"))}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) },
  );
  if (!response.ok) return null;
  const user = (await response.json()).users?.[0];
  if (!user || user.disabled === true) return null;
  const tokenPayload = idToken.split(".")[1];
  if (!tokenPayload) return null;
  const normalized = tokenPayload.replace(/-/g, "+").replace(/_/g, "/");
  const claims = JSON.parse(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)));
  if (claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
      claims.aud !== FIREBASE_PROJECT_ID || claims.sub !== user.localId) return null;
  return user.localId as string;
}
async function hasAnalyticsPermission(uid: string): Promise<boolean> {
  const db = dbAdmin();
  const { data: user, error: userError } = await db.from("pixel_forge_users")
    .select("role,status").eq("uid", uid).maybeSingle();
  if (userError) throw userError;
  if (!user || user.status !== "active") return false;
  const { data, error } = await db.from("pixel_forge_role_permissions")
    .select("allowed").eq("role", user.role).eq("permission", "analytics.view").maybeSingle();
  if (error) throw error;
  return data?.allowed === true;
}
async function hmacHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(required("SUPABASE_SERVICE_ROLE_KEY")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function rateLimitKey(request: Request): Promise<string | null> {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  return forwarded ? await hmacHash("rate:" + forwarded) : null;
}
function getTrustedLocation(request: Request) {
  const rawCountry = request.headers.get("cf-ipcountry") ?? "";
  const countryCode = /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : null;
  const rawRegion = request.headers.get("cf-region") ?? "";
  const regionName = rawRegion.trim().slice(0, 80) || null;
  return { countryCode, regionName };
}

function getClientIp(request: Request): { address: string; source: "cf-connecting-ip" } | null {
  // Only trust the hosting edge client-IP header; never use client-supplied fallback headers.
  const candidate = request.headers.get("cf-connecting-ip");
  if (!candidate || candidate.length > 64 || candidate.includes(",")) return null;
  const ip = candidate.trim();
  const parts = ip.split(".");
  const ipv4 = parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  const ipv6 = ip.includes(":") && /^[0-9a-f:]+$/i.test(ip) && ip.split(":").length >= 3;
  if (!ipv4 && !ipv6) return null;
  if (ipv4) {
    const [a, b] = parts.map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))) return null;
  } else {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb") || lower.startsWith("ff")) return null;
  }
  return { address: ip, source: "cf-connecting-ip" };
}
function isPrivateLocalIp(ip: string): boolean {
  if (ip.length > 64) return false;
  const parts = ip.split(".");
  const ipv4 = parts.length === 4 && parts.every((part) => /^\\d{1,3}$/.test(part) && Number(part) <= 255);
  if (ipv4) {
    const [a, b] = parts.map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (!ip.includes(":") || !/^[0-9a-f:]+$/i.test(ip)) return false;
  const lower = ip.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") ||
    lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb");
}

function ipEncryptionKey(): Promise<CryptoKey> {
  const raw = required("ANALYTICS_IP_ENCRYPTION_KEY");
  let bytes: Uint8Array;
  try {
    const binary = atob(raw);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch (_) {
    throw new Error("ANALYTICS_IP_ENCRYPTION_KEY must be base64 encoded.");
  }
  if (bytes.length !== 32) throw new Error("ANALYTICS_IP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  const keyBuffer = new ArrayBuffer(32);
  new Uint8Array(keyBuffer).set(bytes);
  return crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptIp(ip: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await ipEncryptionKey(), new TextEncoder().encode(ip));
  const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  return { ip_ciphertext: toBase64(new Uint8Array(encrypted)), ip_iv: toBase64(iv) };
}
async function decryptIp(ciphertext: string, ivText: string): Promise<string> {
  const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivText) }, await ipEncryptionKey(), fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
async function hasSecurityPermission(uid: string, permission: "security.logs.view" | "security.logs.delete"): Promise<boolean> {
  const db = dbAdmin();
  const { data: user, error: userError } = await db.from("pixel_forge_users")
    .select("role,status").eq("uid", uid).maybeSingle();
  if (userError) throw userError;
  if (!user || user.status !== "active") return false;
  const { data, error } = await db.from("pixel_forge_role_permissions")
    .select("allowed").eq("role", user.role).eq("permission", permission).maybeSingle();
  if (error) throw error;
  return data?.allowed === true;
}
async function authenticatedUid(request: Request): Promise<string | null> {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return token ? await lookupFirebaseUser(token) : null;
}
async function storeSecurityLog(request: Request, pagePath: string, db: ReturnType<typeof dbAdmin>) {
  const observedIp = getClientIp(request);
  if (!observedIp) return;
  try {
    const encrypted = await encryptIp(observedIp.address);
    const { error } = await db.from("pixel_forge_security_logs").insert({
      ...encrypted, ip_source: observedIp.source, event_type: "page_view", page_path: pagePath,
    });
    if (error) throw error;
  } catch (error) {
    console.error("PixelForge security log write failed:", error);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, request);
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, request);
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "";

    if (request.method === "POST" && action === "collect") {
      const input = await request.json().catch(() => null);
      const pagePath = input && typeof input.pagePath === "string" ? input.pagePath : "";
      const visitorSessionId = input && typeof input.visitorSessionId === "string" ? input.visitorSessionId : "";
      const validSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorSessionId);
      if (!allowedPaths.has(pagePath) ||
          Object.keys(input ?? {}).some((key) => key !== "pagePath" && key !== "visitorSessionId") ||
          (visitorSessionId !== "" && !validSessionId)) {
        return json({ error: "Invalid analytics event." }, 400, request);
      }
      const keyHash = await rateLimitKey(request);
      if (!keyHash) return json({ error: "Unable to apply request rate limit." }, 400, request);
      const now = new Date();
      const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
      const db = dbAdmin();
      const { data: permitted, error: rateError } = await db.rpc("pixel_forge_analytics_consume_rate_limit", {
        p_key_hash: keyHash, p_window_start: windowStart, p_max_requests: 60,
      });
      if (rateError) throw rateError;
      if (permitted !== true) return json({ error: "Rate limit exceeded." }, 429, request);
      const visitorHash = validSessionId ? await hmacHash("visitor:" + visitorSessionId) : null;
      const location = getTrustedLocation(request);
      const { error } = await db.from("pixel_forge_analytics_events").insert({
        page_path: pagePath,
        visitor_hash: visitorHash,
        country_code: location.countryCode,
        region_name: location.regionName,
      });
      if (error) throw error;
      await storeSecurityLog(request, pagePath, db);
      return json({ recorded: true }, 202, request);
    }

    if (request.method === "POST" && action === "local-ip-diagnostic") {
      const input = await request.json().catch(() => null);
      const pagePath = input && typeof input.pagePath === "string" ? input.pagePath : "";
      const localIp = input && typeof input.localIp === "string" ? input.localIp.trim() : "";
      if (!allowedPaths.has(pagePath) || input?.consent !== true ||
          Object.keys(input ?? {}).some((key) => !["pagePath", "localIp", "consent"].includes(key)) ||
          !isPrivateLocalIp(localIp)) {
        return json({ error: "A valid private local IP and explicit consent are required." }, 400, request);
      }
      const observedIp = getClientIp(request);
      if (!observedIp) return json({ error: "Observed public IP is unavailable from the trusted hosting edge." }, 422, request);
      const keyHash = await rateLimitKey(request);
      if (!keyHash) return json({ error: "Unable to apply request rate limit." }, 400, request);
      const now = new Date();
      const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
      const db = dbAdmin();
      const { data: permitted, error: rateError } = await db.rpc("pixel_forge_analytics_consume_rate_limit", {
        p_key_hash: keyHash, p_window_start: windowStart, p_max_requests: 60,
      });
      if (rateError) throw rateError;
      if (permitted !== true) return json({ error: "Rate limit exceeded." }, 429, request);
      const publicEncrypted = await encryptIp(observedIp.address);
      const localEncrypted = await encryptIp(localIp);
      const { error } = await db.from("pixel_forge_security_logs").insert({
        ...publicEncrypted,
        local_ip_ciphertext: localEncrypted.ip_ciphertext,
        local_ip_iv: localEncrypted.ip_iv,
        local_ip_source: "browser-webrtc-explicit-consent",
        ip_source: observedIp.source,
        event_type: "local_ip_diagnostic",
        page_path: pagePath,
      });
      if (error) throw error;
      return json({ recorded: true }, 202, request);
    }

    if (request.method === "GET" && action === "summary") {
      const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token) return json({ error: "Firebase authentication required." }, 401, request);
      const uid = await lookupFirebaseUser(token);
      if (!uid) return json({ error: "Firebase authentication required." }, 401, request);
      if (!(await hasAnalyticsPermission(uid))) {
        return json({ error: "Analytics permission is required." }, 403, request);
      }
      const rawDays = Number(url.searchParams.get("days") ?? "30");
      const days = Number.isInteger(rawDays) ? Math.min(90, Math.max(1, rawDays)) : 30;
      const to = new Date();
      const from = new Date(to.getTime() - days * 86400000);
      const { data, error } = await dbAdmin().rpc("pixel_forge_analytics_summary", {
        p_from: from.toISOString(), p_to: to.toISOString(),
      });
      if (error) throw error;

      return json({ days, ...(data ?? { totalPageViews: 0, daily: [], topPages: [] }) }, 200, request);
    }

    if ((request.method === "GET" && action === "security-logs") ||
        (request.method === "POST" && action === "delete-security-logs")) {
      const uid = await authenticatedUid(request);
      if (!uid) return json({ error: "Firebase authentication required." }, 401, request);
      const permission = request.method === "GET" ? "security.logs.view" : "security.logs.delete";
      if (!(await hasSecurityPermission(uid, permission))) {
        return json({ error: "Security log permission is required." }, 403, request);
      }
      const db = dbAdmin();
      if (request.method === "GET") {
        try {
          await ipEncryptionKey();
        } catch (_) {
          return json({ error: "Security log encryption is not configured. Add ANALYTICS_IP_ENCRYPTION_KEY to Supabase Edge Function secrets." }, 503, request);
        }
      }
      if (request.method === "POST") {
        const input = await request.json().catch(() => ({}));
        if (Object.keys(input ?? {}).length !== 0) return json({ error: "Invalid deletion request." }, 400, request);
        const { data: deletedRows, error } = await db.from("pixel_forge_security_logs")
          .delete().gte("created_at", new Date(0).toISOString()).select("id");
        if (error) throw error;
        const deletedCount = deletedRows?.length ?? 0;
        const { error: auditError } = await db.from("pixel_forge_security_log_admin_actions").insert({
          actor_uid: uid, action: "manual_delete_all", deleted_count: deletedCount,
        });
        if (auditError) console.error("Security log deletion audit write failed:", auditError);
        return json({ deletedCount }, 200, request);
      }
      const { data, error } = await db.from("pixel_forge_security_logs")
        .select("id,event_type,page_path,ip_ciphertext,ip_iv,ip_source,local_ip_ciphertext,local_ip_iv,local_ip_source,created_at")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const logs = await Promise.all((data ?? []).map(async (row) => ({
        id: row.id, eventType: row.event_type, pagePath: row.page_path,
        ipAddress: await decryptIp(row.ip_ciphertext, row.ip_iv), ipSource: row.ip_source ?? "unknown (legacy log)", localIpAddress: row.local_ip_ciphertext && row.local_ip_iv ? await decryptIp(row.local_ip_ciphertext, row.local_ip_iv) : null, localIpSource: row.local_ip_source ?? null, createdAt: row.created_at,
      })));
      return json({ logs, retentionDays: 90 }, 200, request);
    }

    return json({ error: "Unsupported analytics action." }, 404, request);
  } catch (error) {
    console.error("PixelForge analytics error:", error);
    return json({ error: "Analytics request failed." }, 500, request);
  }
});
