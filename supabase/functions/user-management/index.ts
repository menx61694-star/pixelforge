import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OWNER_UID = "5PcOkyDEcNc1puSeB2lQ6dLFVOF2";
const FIREBASE_PROJECT_ID = "pixelforge-66f0c";
const allowedOrigins = new Set([
  "https://pixelforge.jo3.org",
  "https://pixelforge-z2in.onrender.com",
  Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ?? "",
  "http://localhost:8000",
].filter(Boolean));

function cors(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
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
  const payload = await response.json();
  const user = payload.users?.[0];
  if (!user || user.disabled === true) return null;
  const tokenPayload = idToken.split(".")[1];
  if (!tokenPayload) return null;
  const normalized = tokenPayload.replace(/-/g, "+").replace(/_/g, "/");
  const claims = JSON.parse(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)));
  if (claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
      claims.aud !== FIREBASE_PROJECT_ID || claims.sub !== user.localId) return null;
  return { uid: user.localId as string, email: user.email as string, emailVerified: user.emailVerified === true, displayName: user.displayName as string | undefined };
}
async function authenticate(request: Request) {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const identity = await lookupFirebaseUser(token);
  if (!identity) return null;
  const { data, error } = await dbAdmin().from("pixel_forge_users")
    .select("role,status").eq("uid", identity.uid).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "active") return null;
  if (identity.uid === OWNER_UID && identity.email) {
    await dbAdmin().from("pixel_forge_users").update({ email: identity.email })
      .eq("uid", OWNER_UID).is("email", null);
  }
  return { ...identity, role: data.role as string };
}
async function requireAdmin(request: Request) {
  const identity = await authenticate(request);
  return identity?.role === "admin" ? identity : null;
}
const validRoles = new Set(["admin", "editor", "viewer"]);
const validPermissions = new Set([
  "activity.view", "analytics.view", "dashboard.view",
  "drive.delete", "drive.read", "drive.write",
  "roles.manage", "security.logs.delete", "security.logs.view",
  "mock_tests.manage", "settings.manage", "settings.view", "users.manage",
  "vault.delete", "vault.publish", "vault.read", "vault.write",
]);
const validStatuses = new Set(["active", "suspended"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedOrigins.has(origin)) return json({ error: "Origin is not allowed." }, 403, request);
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed." }, 405, request);
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "";

    // Student self-service identity is intentionally independent of pixel_forge_users.
    if (action === "student-register" || (request.method === "GET" && action === "student-session")) {
      const token = request.headers.get("Authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1];
      if (!token) return json({ error: "Sign in to continue." }, 401, request);
      const identity = await lookupFirebaseUser(token);
      if (!identity) return json({ error: "Your Firebase session is invalid or expired." }, 401, request);
      const studentDb = dbAdmin();
      if (action === "student-register" && request.method === "POST") {
        if (!identity.emailVerified) return json({ error: "Verify your email address before activating your student account." }, 403, request);
        const studentInput = await request.json();
        if (typeof studentInput.website === "string" && studentInput.website.trim()) return json({ error: "Registration could not be completed." }, 400, request);
        const fullName = String(identity.displayName || studentInput.full_name || "").trim();
        if (fullName.length < 2 || fullName.length > 120) return json({ error: "Name must be 2–120 characters." }, 400, request);
        const email = String(identity.email || "").trim().toLowerCase();
        if (!email) return json({ error: "A verified email address is required." }, 400, request);
        const { data: existing, error: existingError } = await studentDb.from("pixel_forge_students")
          .select("uid,email,full_name,status,created_at").eq("uid", identity.uid).maybeSingle();
        if (existingError) throw existingError;
        if (existing) {
          if (existing.status !== "active") return json({ error: "This student account is suspended. Contact the website administrator." }, 403, request);
          return json({ student: existing }, 200, request);
        }
        const turnstileToken = typeof studentInput.turnstile_token === "string" ? studentInput.turnstile_token : "";
        if (!turnstileToken) return json({ error: "Complete the anti-bot verification and try again." }, 400, request);
        const turnstileSecret = required("TURNSTILE_SECRET_KEY");
        const verificationBody = new URLSearchParams({ secret: turnstileSecret, response: turnstileToken });
        const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
        if (clientIp) verificationBody.set("remoteip", clientIp);
        const turnstileResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: verificationBody,
        });
        const turnstileResult = await turnstileResponse.json();
        if (!turnstileResponse.ok || turnstileResult.success !== true) return json({ error: "Anti-bot verification failed. Please try again." }, 403, request);
        const hashSecret = required("STUDENT_RATE_LIMIT_HASH_SECRET");
        const hash = async (value: string) => {
          const bytes = new TextEncoder().encode(hashSecret + ":" + value);
          const digest = await crypto.subtle.digest("SHA-256", bytes);
          return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        };
        const ipHash = await hash(clientIp || identity.uid);
        const emailHash = await hash(email);
        const { data: limit, error: limitError } = await studentDb.rpc("pixel_forge_check_student_signup_limit", { p_ip_hash: ipHash, p_email_hash: emailHash });
        if (limitError) throw limitError;
        if (!limit?.allowed) return json({ error: "Too many signup attempts. Please try again later." }, 429, request);
        const { data, error } = await studentDb.from("pixel_forge_students")
          .insert({ uid: identity.uid, email, full_name: fullName })
          .select("uid,email,full_name,status,created_at").single();
        if (error) throw error;
        if (data.status !== "active") return json({ error: "This student account is suspended. Contact the website administrator." }, 403, request);
        return json({ student: data }, 201, request);
      }
      if (action === "student-session" && request.method === "GET") {
        if (!identity.emailVerified) return json({ error: "Verify your email address before signing in." }, 403, request);
        const { data, error } = await studentDb.from("pixel_forge_students")
          .select("uid,email,full_name,status,created_at").eq("uid", identity.uid).maybeSingle();
        if (error) throw error;
        if (!data || data.status !== "active") return json({ error: "No active student profile was found." }, 403, request);
        return json({ student: data }, 200, request);
      }
      return json({ error: "Method not allowed." }, 405, request);
    }

    if (request.method === "GET" && action === "session") {
      const identity = await authenticate(request);
      if (!identity) return json({ error: "This account has no active PixelForge access." }, 403, request);
      const db = dbAdmin();
      const { data: permissions, error } = await db.from("pixel_forge_role_permissions")
        .select("permission").eq("role", identity.role).eq("allowed", true);
      if (error) throw error;
      return json({ uid: identity.uid, email: identity.email, role: identity.role, permissions: (permissions ?? []).map((item) => item.permission) }, 200, request);
    }
    const actor = await requireAdmin(request);
    if (!actor) return json({ error: "Active administrator access is required." }, 403, request);
    const db = dbAdmin();
    const input = request.method === "POST" ? await request.json() : {};

    if (request.method === "GET" && action === "list-students") {
      const { data: students, error } = await db.from("pixel_forge_students")
        .select("uid,email,full_name,status,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ students: students ?? [] }, 200, request);
    }

    if (action === "set-student-status") {
      const uid = typeof input.uid === "string" ? input.uid.trim() : "";
      const status = typeof input.status === "string" ? input.status : "";
      if (!uid || !["active", "suspended"].includes(status)) return json({ error: "Valid student and status are required." }, 400, request);
      const { data: student, error: lookupError } = await db.from("pixel_forge_students").select("uid").eq("uid", uid).maybeSingle();
      if (lookupError) throw lookupError;
      if (!student) return json({ error: "Student account was not found." }, 404, request);
      const { error } = await db.from("pixel_forge_students").update({ status, updated_at: new Date().toISOString() }).eq("uid", uid);
      if (error) throw error;
      return json({ updated: true }, 200, request);
    }

    if (request.method === "GET" && action === "list") {
      const [{ data: users, error: usersError }, { data: permissions, error: permissionsError }] = await Promise.all([
        db.from("pixel_forge_users").select("uid,email,role,status,created_at,updated_at,created_by").order("created_at", { ascending: true }),
        db.from("pixel_forge_role_permissions").select("role,permission,allowed").order("permission"),
      ]);
      if (usersError) throw usersError;
      if (permissionsError) throw permissionsError;
      return json({ users: users ?? [], permissions: permissions ?? [] }, 200, request);
    }

    if (action === "assign") {
      const uid = typeof input.uid === "string" ? input.uid.trim() : "";
      const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
      const role = typeof input.role === "string" ? input.role : "";
      if (!uid || uid.length > 128 || !/^\S+@\S+\.\S+$/.test(email) || !validRoles.has(role)) {
        return json({ error: "Valid Firebase UID, email and role are required." }, 400, request);
      }
      if (uid === OWNER_UID) return json({ error: "The owner account is protected." }, 403, request);
      const targetIdToken = typeof input.idToken === "string" ? input.idToken.trim() : "";
      if (!targetIdToken || targetIdToken.length > 8192) {
        return json({ error: "The new Firebase account ID token is missing. Retry user creation." }, 400, request);
      }
      const targetIdentity = await lookupFirebaseUser(targetIdToken);
      if (!targetIdentity || targetIdentity.uid !== uid ||
          String(targetIdentity.email ?? "").toLowerCase() !== email) {
        return json({ error: "The newly created Firebase account could not be verified. Check that the Admin Firebase project configuration matches the website, then retry." }, 400, request);
      }
      const { error } = await db.from("pixel_forge_users").upsert({
        uid, email, role, status: "active", created_by: actor.uid, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ assigned: true }, 200, request);
    }

    if (action === "set-status") {
      const uid = typeof input.uid === "string" ? input.uid.trim() : "";
      const status = typeof input.status === "string" ? input.status : "";
      if (!uid || !validStatuses.has(status)) return json({ error: "Valid user and status are required." }, 400, request);
      if (uid === OWNER_UID) return json({ error: "The owner account cannot be suspended." }, 403, request);
      const { data: target, error: targetError } = await db.from("pixel_forge_users")
        .select("role,status").eq("uid", uid).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return json({ error: "User role record was not found." }, 404, request);
      if (status === "suspended" && target.role === "admin") {
        const { count, error } = await db.from("pixel_forge_users")
          .select("uid", { count: "exact", head: true }).eq("role", "admin").eq("status", "active");
        if (error) throw error;
        if ((count ?? 0) <= 1) return json({ error: "The last active administrator cannot be suspended." }, 409, request);
      }
      const { error } = await db.from("pixel_forge_users")
        .update({ status, updated_at: new Date().toISOString() }).eq("uid", uid);
      if (error) throw error;
      return json({ updated: true }, 200, request);
    }

    if (action === "set-role") {
      const uid = typeof input.uid === "string" ? input.uid.trim() : "";
      const role = typeof input.role === "string" ? input.role : "";
      if (!uid || !validRoles.has(role)) return json({ error: "Valid user and role are required." }, 400, request);
      if (uid === OWNER_UID) return json({ error: "The owner role cannot be changed." }, 403, request);
      const { data: target, error: targetError } = await db.from("pixel_forge_users")
        .select("role,status").eq("uid", uid).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return json({ error: "User role record was not found." }, 404, request);
      if (target.role === "admin" && role !== "admin" && target.status === "active") {
        const { count, error } = await db.from("pixel_forge_users")
          .select("uid", { count: "exact", head: true }).eq("role", "admin").eq("status", "active");
        if (error) throw error;
        if ((count ?? 0) <= 1) return json({ error: "The last active administrator cannot be demoted." }, 409, request);
      }
      const { error } = await db.from("pixel_forge_users")
        .update({ role, updated_at: new Date().toISOString() }).eq("uid", uid);
      if (error) throw error;
      return json({ updated: true }, 200, request);
    }

    if (action === "set-permission") {
      const role = typeof input.role === "string" ? input.role : "";
      const permission = typeof input.permission === "string" ? input.permission : "";
      const allowed = input.allowed === true;
      if (!validRoles.has(role) || !validPermissions.has(permission)) {
        return json({ error: "Invalid role or permission." }, 400, request);
      }
      if (role === "admin" && ["users.manage", "roles.manage", "dashboard.view"].includes(permission) && !allowed) {
        return json({ error: "Critical administrator permissions cannot be disabled." }, 409, request);
      }
      if (role !== "admin" && ["users.manage", "roles.manage"].includes(permission) && allowed) {
        return json({ error: "User and role management are reserved for Admin accounts." }, 409, request);
      }
      if (role !== "admin" && permission.startsWith("security.logs.") && allowed) {
        return json({ error: "Security log access is reserved for Admin accounts." }, 409, request);
      }
      if (role !== "admin" && permission.startsWith("settings.") && allowed) {
        return json({ error: "Site settings access is reserved for Admin accounts." }, 409, request);
      }
      if (role !== "admin" && permission === "mock_tests.manage" && allowed) {
        return json({ error: "Mock Test management is reserved for Admin accounts." }, 409, request);
      }
      const { error } = await db.from("pixel_forge_role_permissions").upsert({ role, permission, allowed });
      if (error) throw error;
      return json({ updated: true }, 200, request);
    }

    return json({ error: "Unsupported user-management action." }, 404, request);
  } catch (error) {
    console.error("PixelForge user management error:", error);
    return json({ error: "User management request failed. Check the Edge Function logs." }, 500, request);
  }
});
