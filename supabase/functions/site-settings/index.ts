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
  "home.knowledge.enabled",
  "home.knowledge.items",
  "home.quiz.enabled",
  "home.quiz.items",
  "home.tools.enabled",
  "home.tools.items",
  "home.featured.enabled",
  "home.featured.items",
  "home.announcements.enabled",
  "home.announcements.items",
  "home.search.enabled",
  "home.search.smart_enabled",
  "home.search.filters_enabled",
  "home.search.max_results",
  "home.search.placeholder",
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
function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch (_) {
    return false;
  }
}
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validSettingValue(key: string, value: unknown): boolean {
  if (!settingKeys.has(key)) return false;
  if (key === "maintenance.enabled" || key.startsWith("sync.") || key === "home.knowledge.enabled" || key === "home.quiz.enabled" || key === "home.tools.enabled" || key === "home.featured.enabled" || key === "home.announcements.enabled" || key === "home.search.enabled" || key === "home.search.smart_enabled" || key === "home.search.filters_enabled") return typeof value === "boolean";
  if (key === "home.knowledge.items") {
    return Array.isArray(value) && value.length <= 50 && value.every((item) =>
      item && typeof item === "object" && !Array.isArray(item) &&
      Object.keys(item).every((field) => field === "category" || field === "text") &&
      typeof item.category === "string" && item.category.length <= 32 &&
      typeof item.text === "string" && item.text.trim().length >= 8 && item.text.length <= 240
    );
  }
  if (key === "home.quiz.items") {
    return Array.isArray(value) && value.length <= 100 && value.every((item) =>
      item && typeof item === "object" && !Array.isArray(item) &&
      Object.keys(item).every((field) => ["id","category","publishDate","published","question","options","correctIndex","explanation"].includes(field)) &&
      typeof item.id === "string" && item.id.trim().length > 0 && item.id.length <= 80 &&
      typeof item.category === "string" && item.category.trim().length > 0 && item.category.length <= 32 &&
      typeof item.publishDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.publishDate) &&
      !Number.isNaN(Date.parse(item.publishDate + "T00:00:00.000Z")) &&
      new Date(item.publishDate + "T00:00:00.000Z").toISOString().slice(0, 10) === item.publishDate &&
      typeof item.published === "boolean" &&
      typeof item.question === "string" && item.question.trim().length >= 10 && item.question.length <= 500 &&
      Array.isArray(item.options) && item.options.length === 4 &&
      item.options.every((option: unknown) => typeof option === "string" && option.trim().length > 0 && option.length <= 160) &&
      Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex <= 3 &&
      typeof item.explanation === "string" && item.explanation.length <= 1000
    );
  }
  if (key === "home.tools.items") {
    const allowed = new Set(["calculator","percentage","word-counter","unit-converter"]);
    return Array.isArray(value) && value.length <= 4 &&
      value.every((item: unknown) => typeof item === "string" && allowed.has(item)) &&
      new Set(value).size === value.length;
  }
  if (key === "home.featured.items") {
    return Array.isArray(value) && value.length <= 12 && value.every((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const resource = item as Record<string, unknown>;
      return Object.keys(resource).every(field => ["id","title","description","category","url","label","published"].includes(field)) &&
        typeof resource.id === "string" && resource.id.trim().length > 0 && resource.id.length <= 64 &&
        typeof resource.title === "string" && resource.title.trim().length > 0 && resource.title.length <= 100 &&
        typeof resource.description === "string" && resource.description.length <= 240 &&
        typeof resource.category === "string" && resource.category.trim().length > 0 && resource.category.length <= 40 &&
        typeof resource.url === "string" && resource.url.length <= 1200 && isSafeHttpsUrl(resource.url) &&
        typeof resource.label === "string" && resource.label.trim().length > 0 && resource.label.length <= 32 &&
        typeof resource.published === "boolean";
    }) && new Set(value.map((item: { id?: unknown }) => item.id)).size === value.length;
  }
  if (key === "home.search.max_results") return Number.isInteger(value) && value >= 6 && value <= 100;
  if (key === "home.search.placeholder") return typeof value === "string" && value.trim().length >= 5 && value.length <= 100;
  if (key === "home.announcements.items") {
    return Array.isArray(value) && value.length <= 20 && value.every((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const notice = item as Record<string, unknown>;
      const url = typeof notice.url === "string" ? notice.url : "";
      const label = typeof notice.label === "string" ? notice.label : "";
      return Object.keys(notice).every(field => ["id","title","message","type","startDate","endDate","published","url","label"].includes(field)) &&
        typeof notice.id === "string" && notice.id.trim().length > 0 && notice.id.length <= 64 &&
        typeof notice.title === "string" && notice.title.trim().length > 0 && notice.title.length <= 120 &&
        typeof notice.message === "string" && notice.message.trim().length > 0 && notice.message.length <= 500 &&
        ["info","update","important"].includes(String(notice.type)) &&
        typeof notice.startDate === "string" && isValidIsoDate(notice.startDate) &&
        typeof notice.endDate === "string" && isValidIsoDate(notice.endDate) && notice.startDate <= notice.endDate &&
        typeof notice.published === "boolean" &&
        url.length <= 1200 && (url === "" || isSafeHttpsUrl(url)) &&
        label.length <= 32 && (url === "" ? label === "" : label.trim().length > 0);
    }) && new Set(value.map((item: { id?: unknown }) => item.id)).size === value.length;
  }
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
    if (request.method === "GET" && action === "public-content") {
      const db = dbAdmin();
      const { data, error } = await db.from("pixel_forge_site_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["site.name", "site.description", "home.knowledge.enabled", "home.knowledge.items", "home.quiz.enabled", "home.quiz.items", "home.tools.enabled", "home.tools.items", "home.featured.enabled", "home.featured.items", "home.announcements.enabled", "home.announcements.items", "home.search.enabled", "home.search.smart_enabled", "home.search.filters_enabled", "home.search.max_results", "home.search.placeholder"]);
      if (error) throw error;
      const values = Object.fromEntries((data ?? []).map((row) => [row.setting_key, row.setting_value]));
      const items = Array.isArray(values["home.knowledge.items"]) ? values["home.knowledge.items"] : [];
      return json({
        site: {
          name: typeof values["site.name"] === "string" ? values["site.name"] : "PixelForge",
          description: typeof values["site.description"] === "string" ? values["site.description"] : "",
        },
        knowledge: {
          enabled: values["home.knowledge.enabled"] !== false,
          items: items.filter((item: unknown) =>
            item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
          ).slice(0, 50),
        },
        quickTools: {
          enabled: values["home.tools.enabled"] === true,
          items: Array.isArray(values["home.tools.items"]) ? values["home.tools.items"] : [],
        },
        featuredResources: {
          enabled: values["home.featured.enabled"] === true,
          items: Array.isArray(values["home.featured.items"])
            ? (values["home.featured.items"] as Array<Record<string, unknown>>)
                .filter(item => item.published === true && typeof item.url === "string" && isSafeHttpsUrl(item.url))
                .slice(0, 12)
            : [],
        },
        search: {
          enabled: values["home.search.enabled"] === true,
          smartEnabled: values["home.search.smart_enabled"] !== false,
          filtersEnabled: values["home.search.filters_enabled"] !== false,
          maxResults: Number.isInteger(values["home.search.max_results"]) ? values["home.search.max_results"] : 30,
          placeholder: typeof values["home.search.placeholder"] === "string" ? values["home.search.placeholder"] : "Search documents, notes and guides…",
        },
        announcements: {
          enabled: values["home.announcements.enabled"] === true,
          items: Array.isArray(values["home.announcements.items"])
            ? (values["home.announcements.items"] as Array<Record<string, unknown>>).filter(item =>
                item.published === true &&
                typeof item.startDate === "string" && typeof item.endDate === "string" &&
                isValidIsoDate(item.startDate) && isValidIsoDate(item.endDate) &&
                item.startDate <= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) &&
                item.endDate >= new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
              ).slice(0, 20)
            : [],
        },
        quiz: {
          enabled: values["home.quiz.enabled"] === true,
          question: values["home.quiz.enabled"] === true && Array.isArray(values["home.quiz.items"])
            ? (values["home.quiz.items"] as Array<Record<string, unknown>>).find((item) =>
                item.published === true && item.publishDate === new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
                }).format(new Date())
              ) ? (() => {
                const item = (values["home.quiz.items"] as Array<Record<string, unknown>>).find((entry) =>
                  entry.published === true && entry.publishDate === new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
                  }).format(new Date())
                )!;
                return { id: item.id, category: item.category, question: item.question, options: item.options };
              })() : null
            : null,
        },
      }, 200, request);
    }

    if (request.method === "POST" && action === "quiz-answer") {
      const length = Number(request.headers.get("Content-Length") ?? "0");
      if (length > 2000) return json({ error: "Quiz answer request is too large." }, 413, request);
      const input = await request.json().catch(() => null);
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).length !== 2 || typeof input.questionId !== "string" ||
          !Number.isInteger(input.selectedIndex) || input.selectedIndex < 0 || input.selectedIndex > 3) {
        return json({ error: "Invalid quiz answer." }, 400, request);
      }
      const db = dbAdmin();
      const { data, error } = await db.from("pixel_forge_site_settings")
        .select("setting_key,setting_value").in("setting_key", ["home.quiz.enabled", "home.quiz.items"]);
      if (error) throw error;
      const values = Object.fromEntries((data ?? []).map((row) => [row.setting_key, row.setting_value]));
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date());
      const item = Array.isArray(values["home.quiz.items"])
        ? (values["home.quiz.items"] as Array<Record<string, unknown>>).find((entry) =>
            entry.id === input.questionId && entry.publishDate === today && entry.published === true
          )
        : null;
      if (values["home.quiz.enabled"] !== true || !item) return json({ error: "Today's quiz is not available." }, 404, request);
      return json({
        correct: input.selectedIndex === item.correctIndex,
        explanation: typeof item.explanation === "string" ? item.explanation : "",
      }, 200, request);
    }

    if (request.method === "GET" && action === "public-status") {
      const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await db.from("pixel_forge_site_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["maintenance.enabled", "maintenance.message"]);
      if (error) throw error;
      const values = Object.fromEntries((data ?? []).map((row) => [row.setting_key, row.setting_value]));
      return json({
        maintenance: values["maintenance.enabled"] === true,
        message: typeof values["maintenance.message"] === "string"
          ? values["maintenance.message"]
          : "We are performing scheduled maintenance. Please check back soon.",
      }, 200, request);
    }

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
      if (contentLength > 20000) return json({ error: "Settings request is too large." }, 413, request);
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
