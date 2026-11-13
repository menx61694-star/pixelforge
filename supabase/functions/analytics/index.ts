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
async function rateLimitKey(request: Request): Promise<string | null> {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  if (!forwarded) return null;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(required("SUPABASE_SERVICE_ROLE_KEY")),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(forwarded));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
      if (!allowedPaths.has(pagePath) || Object.keys(input ?? {}).some((key) => key !== "pagePath")) {
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
      const { error } = await db.from("pixel_forge_analytics_events").insert({ page_path: pagePath });
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

    return json({ error: "Unsupported analytics action." }, 404, request);
  } catch (error) {
    console.error("PixelForge analytics error:", error);
    return json({ error: "Analytics request failed." }, 500, request);
  }
});
