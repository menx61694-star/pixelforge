import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = "pixelforge-66f0c";
const allowedOrigins = new Set([
  Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ?? "https://pixelforge.jo3.org",
  "http://localhost:8000",
]);
const settingKeys = new Set([
  "site.name",
  "site.description",
  "site.contact_email",
  "maintenance.enabled",
  "maintenance.message",
  "sync.drive.auto_enabled",
  "sync.vault.auto_enabled",
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
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return null;
  const user = (await response.json()).users?.[0];
  if (!user || user.disabled === true) return null;
  const tokenPayload = idToken.split(".")[1];
  if (!tokenPayload) return null;
  const normalized = tokenPayload.replace(/-/g, "+").replace(/_/g, "/");
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)));
  } catch (_) {
    return null;
  }
  if (
    claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
    claims.aud !== FIREBASE_PROJECT_ID ||
    claims.sub !== user.localId
  ) return null;
  return user.localId as string;
}
async function authorize(request: Request, permission: "settings.view" | "settings.manage") {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const uid = await lookupFirebaseUser(token);
  if (!uid) return null;
  const db = dbAdmin();
  const { data: user, error: userError } = await db.from("pixel_forge_users")
    .select("role,status").eq("uid", uid).maybeSingle();
  if (userError) throw userError;
  // Settings are intentionally restricted to active administrators, even if a
  // permission row is accidentally enabled for another role.
  if (!user || user.role !== "admin" || user.status !== "active") return null;
  const { data: access, error: permissionError } = await db.from("pixel_forge_role_permissions")
    .select("allowed").eq("role", user.role).eq("permission", permission).maybeSingle();
  if (permissionError) throw permissionError;
  return access?.allowed === true ? { uid, db } : null;
}
function validSettingValue(key: string, value: unknown): boolean {
  if (!settingKeys.has(key)) return false;
  if (key === "maintenance.enabled" || key.startsWith("sync.")) return typeof value === "boolean";
  if (typeof value !== "string") return false;
  if (key === "site.name") return value.trim().length > 0 && value.length <= 80;
  if (key === "site.description") return value.length <= 300;
  if (key === "site.contact_email") return value.length <= 254 && (value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  if (key === "maintenance.message") return value.length <= 500;
  return false;
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
    const permission = request.method === "GET" ? "settings.view" : "settings.manage";
    const actor = await authorize(request, permission);
    if (!actor) return json({ error: "Active administrator permission is required." }, 403, request);

    if (request.method === "GET" && action === "list") {
      const { data, error } = await actor.db.from("pixel_forge_site_settings")
        .select("setting_key,setting_value,updated_by,updated_at").order("setting_key");
      if (error) throw error;
      return json({ settings: data ?? [] }, 200, request);
    }

    if (request.method === "GET" && action === "audit") {
      const { data, error } = await actor.db.from("pixel_forge_site_settings_audit")
        .select("id,setting_key,old_value,new_value,actor_uid,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ audit: data ?? [] }, 200, request);
    }

    if (request.method === "POST" && action === "update") {
      const contentLength = Number(request.headers.get("Content-Length") ?? "0");
      if (contentLength > 4096) return json({ error: "Settings request is too large." }, 413, request);
      const input = await request.json().catch(() => null);
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).length !== 2 || !Object.hasOwn(input, "key") || !Object.hasOwn(input, "value") ||
          typeof input.key !== "string" || !validSettingValue(input.key, input.value)) {
        return json({ error: "Invalid setting key or value." }, 400, request);
      }
      const { data, error } = await actor.db.rpc("pixel_forge_update_site_setting", {
        p_key: input.key,
        p_value: input.value,
        p_actor_uid: actor.uid,
      });
      if (error) {
        if (String(error.message ?? "").includes("Invalid site setting")) {
          return json({ error: "Invalid setting key or value." }, 400, request);
        }
        throw error;
      }
      return json({ updated: true, updatedAt: data }, 200, request);
    }

    return json({ error: "Unsupported site settings action." }, 404, request);
  } catch (error) {
    console.error("PixelForge site settings error:", error);
    return json({ error: "Site settings request failed. Check the Edge Function logs." }, 500, request);
  }
});
