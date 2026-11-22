import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = "pixelforge-66f0c";
const allowedOrigins = new Set([
  "https://pixelforge.jo3.org",
  ...(Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ? [Deno.env.get("PIXELFORGE_ADMIN_ORIGIN")!] : []),
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
  "home.learning.enabled",
  "home.learning.items",
  "home.feedback.enabled",
  "home.feedback.categories",
  "home.feedback.allow_anonymous",
  "home.feedback.display_approved",
  "home.feedback.max_display",
  "home.seo.enabled",
  "home.seo.default_title",
  "home.seo.default_description",
  "home.seo.default_keywords",
  "home.seo.canonical_base",
  "home.seo.og_image",
  "home.seo.page_overrides",
  "home.layout.enabled",
  "home.layout.sections",
  "home.popular.enabled",
  "home.popular.max_items",
  "home.popular.min_views",
  "home.popular.show_views",
  "home.library.pdf_preview_enabled",
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
  if (key === "maintenance.enabled" || key.startsWith("sync.") || key === "home.knowledge.enabled" || key === "home.quiz.enabled" || key === "home.tools.enabled" || key === "home.featured.enabled" || key === "home.announcements.enabled" || key === "home.search.enabled" || key === "home.search.smart_enabled" || key === "home.search.filters_enabled" || key === "home.learning.enabled" || key === "home.feedback.enabled" || key === "home.feedback.allow_anonymous" || key === "home.feedback.display_approved" || key === "home.seo.enabled" || key === "home.layout.enabled" || key === "home.popular.enabled" || key === "home.popular.show_views" || key === "home.library.pdf_preview_enabled") return typeof value === "boolean";
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
  if (key === "home.popular.max_items") return typeof value === "number" && Number.isInteger(value) && value >= 3 && value <= 12;
  if (key === "home.popular.min_views") return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1000000;
  if (key === "home.layout.sections") {
    const allowed = new Set(["smart-document-search","discover","user-feedback","learning-corner","announcements","featured-resources","popular-resources","quick-tools","knowledge","daily-quiz","about","contact"]);
    return Array.isArray(value) && value.length === 12 && value.every((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const section = item as Record<string, unknown>;
      return Object.keys(section).every(field => ["id","enabled","title","subtitle"].includes(field)) &&
        typeof section.id === "string" && allowed.has(section.id) &&
        typeof section.enabled === "boolean" &&
        typeof section.title === "string" && section.title.length <= 80 &&
        typeof section.subtitle === "string" && section.subtitle.length <= 160;
    }) && new Set(value.map((item: { id?: unknown }) => item.id)).size === 12;
  }
  if (key === "home.seo.default_title") return typeof value === "string" && value.trim().length >= 5 && value.length <= 70;
  if (key === "home.seo.default_description") return typeof value === "string" && value.trim().length >= 50 && value.length <= 160;
  if (key === "home.seo.default_keywords") return typeof value === "string" && value.length <= 250;
  if (key === "home.seo.canonical_base") return typeof value === "string" && value.length <= 300 && (value === "" || isSafeHttpsUrl(value));
  if (key === "home.seo.og_image") return typeof value === "string" && value.length <= 1200 && (value === "" || isSafeHttpsUrl(value));
  if (key === "home.seo.page_overrides") {
    return Array.isArray(value) && value.length <= 20 && value.every((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const page = item as Record<string, unknown>;
      return Object.keys(page).every(field => ["page","title","description","keywords","robots","canonical"].includes(field)) &&
        typeof page.page === "string" && /^\/[a-z0-9/._-]*$/i.test(page.page) && !page.page.includes("..") &&
        typeof page.title === "string" && page.title.trim().length >= 5 && page.title.length <= 70 &&
        typeof page.description === "string" && page.description.trim().length >= 50 && page.description.length <= 160 &&
        typeof page.keywords === "string" && page.keywords.length <= 250 &&
        ["index,follow","noindex,follow","noindex,nofollow"].includes(String(page.robots)) &&
        typeof page.canonical === "string" && page.canonical.length <= 1200 && (page.canonical === "" || isSafeHttpsUrl(page.canonical));
    }) && new Set(value.map((item: { page?: unknown }) => item.page)).size === value.length;
  }
  if (key === "home.feedback.categories") {
    return Array.isArray(value) && value.length >= 1 && value.length <= 8 &&
      value.every((item: unknown) => typeof item === "string" && item.trim().length >= 2 && item.length <= 32) &&
      new Set(value.map((item: string) => item.toLowerCase())).size === value.length;
  }
  if (key === "home.feedback.max_display") return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12;
  if (key === "home.learning.items") {
    return Array.isArray(value) && value.length <= 12 && value.every((item: unknown) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return false;
      const path = item as Record<string, unknown>;
      if (!Object.keys(path).every(field => ["id","title","description","topic","level","duration","published","steps"].includes(field)) ||
          typeof path.id !== "string" || path.id.trim().length < 1 || path.id.length > 64 ||
          typeof path.title !== "string" || path.title.trim().length < 1 || path.title.length > 100 ||
          typeof path.description !== "string" || path.description.trim().length < 1 || path.description.length > 240 ||
          typeof path.topic !== "string" || path.topic.trim().length < 1 || path.topic.length > 40 ||
          !["beginner","intermediate","advanced"].includes(String(path.level)) ||
          typeof path.duration !== "string" || path.duration.length > 32 ||
          typeof path.published !== "boolean" || !Array.isArray(path.steps) || path.steps.length < 1 || path.steps.length > 8) return false;
      return path.steps.every((step: unknown) => {
        if (!step || typeof step !== "object" || Array.isArray(step)) return false;
        const entry = step as Record<string, unknown>;
        return Object.keys(entry).every(field => ["title","url"].includes(field)) &&
          typeof entry.title === "string" && entry.title.trim().length > 0 && entry.title.length <= 100 &&
          typeof entry.url === "string" && entry.url.length <= 1200 && isSafeHttpsUrl(entry.url);
      });
    }) && new Set(value.map((item: { id?: unknown }) => item.id)).size === value.length;
  }
  if (key === "home.search.max_results") return typeof value === "number" && Number.isInteger(value) && value >= 6 && value <= 100;
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
        .in("setting_key", ["site.name", "site.description", "site.contact_email", "home.knowledge.enabled", "home.knowledge.items", "home.quiz.enabled", "home.quiz.items", "home.tools.enabled", "home.tools.items", "home.featured.enabled", "home.featured.items", "home.announcements.enabled", "home.announcements.items", "home.search.enabled", "home.search.smart_enabled", "home.search.filters_enabled", "home.search.max_results", "home.search.placeholder", "home.learning.enabled", "home.learning.items", "home.feedback.enabled", "home.feedback.categories", "home.feedback.allow_anonymous", "home.feedback.display_approved", "home.feedback.max_display", "home.seo.enabled", "home.seo.default_title", "home.seo.default_description", "home.seo.default_keywords", "home.seo.canonical_base", "home.seo.og_image", "home.seo.page_overrides", "home.layout.enabled", "home.layout.sections", "home.popular.enabled", "home.popular.max_items", "home.popular.min_views", "home.popular.show_views", "home.library.pdf_preview_enabled"]);
      if (error) throw error;
      const values = Object.fromEntries((data ?? []).map((row) => [row.setting_key, row.setting_value]));
      const items = Array.isArray(values["home.knowledge.items"]) ? values["home.knowledge.items"] : [];
      const feedbackSettings = {
        enabled: values["home.feedback.enabled"] === true,
        displayApproved: values["home.feedback.display_approved"] === true,
        maxDisplay: Number.isInteger(values["home.feedback.max_display"]) ? values["home.feedback.max_display"] as number : 6,
      };
      let approvedFeedback: Array<Record<string, unknown>> = [];
      if (feedbackSettings.displayApproved) {
        const { data: feedbackRows, error: feedbackError } = await db.from("pixel_forge_public_feedback")
          .select("name,category,rating,message").eq("status", "approved").eq("consent", true)
          .order("created_at", { ascending: false }).limit(feedbackSettings.maxDisplay);
        if (feedbackError) throw feedbackError;
        approvedFeedback = feedbackRows ?? [];
      }
      const popularConfig = {
        enabled: values["home.popular.enabled"] === true,
        maxItems: Number.isInteger(values["home.popular.max_items"]) ? values["home.popular.max_items"] as number : 6,
        minViews: Number.isInteger(values["home.popular.min_views"]) ? values["home.popular.min_views"] as number : 1,
        showViews: values["home.popular.show_views"] !== false,
      };
      let popularItems: Array<Record<string, unknown>> = [];
      if (popularConfig.enabled) {
        const { data: metrics, error: metricsError } = await db.from("pixel_forge_resource_metrics")
          .select("source,resource_id,view_count").gte("view_count", popularConfig.minViews)
          .order("view_count", { ascending: false }).limit(popularConfig.maxItems * 5);
        if (metricsError) throw metricsError;
        const storagePaths = (metrics ?? []).filter(item => item.source === "supabase").map(item => String(item.resource_id));
        const driveIds = (metrics ?? []).filter(item => item.source === "google_drive").map(item => String(item.resource_id));
        const docs = new Map<string, Record<string, unknown>>();
        const resourceCategories = ["pdf-documents","study-notes","books-resources","other-documents","exam-materials","technology-guides"];
        const categoryNames: Record<string, string> = {
          "pdf-documents":"PDF Documents","study-notes":"Study Notes","books-resources":"Books & Resources",
          "other-documents":"Other Documents","exam-materials":"Exam Materials","technology-guides":"Technology Guides",
        };
        for (const category of resourceCategories) {
          const wanted = new Set(storagePaths.filter(path => path.startsWith(category + "/")));
          if (!wanted.size) continue;
          const { data, error } = await db.storage.from("public-documents").list(category, { limit: 1000 });
          if (error) throw error;
          for (const file of data ?? []) {
            const path = category + "/" + file.name;
            if (!wanted.has(path) || !file.name || file.name.endsWith("/")) continue;
            const ext = file.name.split(".").pop() || "FILE";
            const { data: publicUrl } = db.storage.from("public-documents").getPublicUrl(path);
            docs.set("supabase:" + path, {
              source: "supabase", storage_path: path,
              title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
              category: categoryNames[category], size_bytes: Number(file.metadata?.size || 0),
              url: publicUrl.publicUrl, ext,
            });
          }
        }
        if (driveIds.length) {
          const { data, error } = await db.from("pixel_forge_published_documents")
            .select("source,drive_file_id,title,category,size_bytes").eq("source","google_drive")
            .eq("published",true).in("drive_file_id",driveIds);
          if (error) throw error;
          for (const item of data ?? []) docs.set("google_drive:" + item.drive_file_id, item);
        }
        for (const metric of metrics ?? []) {
          const doc = docs.get(metric.source + ":" + metric.resource_id);
          if (!doc) continue;
          const url = metric.source === "google_drive"
            ? required("SUPABASE_URL") + "/functions/v1/google-drive-files?action=public-download&id=" + encodeURIComponent(String(doc.drive_file_id))
            : String(doc.url);
          popularItems.push({
            title: doc.title, category: doc.category, source: metric.source, url,
            viewCount: popularConfig.showViews ? metric.view_count : null,
          });
          if (popularItems.length >= popularConfig.maxItems) break;
        }
      }
      return json({
        site: {
          name: typeof values["site.name"] === "string" ? values["site.name"] : "PixelForge",
          description: typeof values["site.description"] === "string" ? values["site.description"] : "",
          contactEmail: typeof values["site.contact_email"] === "string" ? values["site.contact_email"] : "",
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
        library: {
          pdfPreviewEnabled: values["home.library.pdf_preview_enabled"] !== false,
        },
        popularResources: {
          enabled: popularConfig.enabled,
          showViews: popularConfig.showViews,
          items: popularItems,
        },
        layout: {
          enabled: values["home.layout.enabled"] === true,
          sections: Array.isArray(values["home.layout.sections"]) ? values["home.layout.sections"] : [],
        },
        seo: {
          enabled: values["home.seo.enabled"] === true,
          defaultTitle: typeof values["home.seo.default_title"] === "string" ? values["home.seo.default_title"] : "PixelForge — Digital resources and learning tools",
          defaultDescription: typeof values["home.seo.default_description"] === "string" ? values["home.seo.default_description"] : "Discover curated documents, study notes, digital tools and guided learning resources on PixelForge.",
          defaultKeywords: typeof values["home.seo.default_keywords"] === "string" ? values["home.seo.default_keywords"] : "",
          canonicalBase: typeof values["home.seo.canonical_base"] === "string" ? values["home.seo.canonical_base"] : "",
          ogImage: typeof values["home.seo.og_image"] === "string" ? values["home.seo.og_image"] : "",
          pageOverrides: Array.isArray(values["home.seo.page_overrides"]) ? values["home.seo.page_overrides"] : [],
        },
        feedback: {
          enabled: values["home.feedback.enabled"] === true,
          categories: Array.isArray(values["home.feedback.categories"]) ? values["home.feedback.categories"] : ["General","Website","Resources","Suggestion"],
          allowAnonymous: values["home.feedback.allow_anonymous"] !== false,
          displayApproved: values["home.feedback.display_approved"] === true,
          approvedFeedback,
        },
        learningCorner: {
          enabled: values["home.learning.enabled"] === true,
          items: Array.isArray(values["home.learning.items"])
            ? (values["home.learning.items"] as Array<Record<string, unknown>>).filter(path =>
                path.published === true && Array.isArray(path.steps) &&
                path.steps.every((step: unknown) => {
                  if (!step || typeof step !== "object") return false;
                  const entry = step as Record<string, unknown>;
                  return typeof entry.title === "string" && typeof entry.url === "string" && isSafeHttpsUrl(entry.url);
                })
              ).slice(0, 12)
            : [],
        },
        search: {
          enabled: values["home.search.enabled"] !== false,
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

    if (request.method === "POST" && action === "submit-feedback") {
      const raw = await request.text();
      if (raw.length > 4000) return json({ error: "Feedback submission is too large." }, 413, request);
      const input = (() => { try { return JSON.parse(raw); } catch (_) { return null; } })();
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).length !== 6 ||
          typeof input.name !== "string" || input.name.length > 60 ||
          typeof input.category !== "string" ||
          !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5 ||
          typeof input.message !== "string" || input.message.trim().length < 20 || input.message.length > 1000 ||
          typeof input.website !== "string" || input.website.length > 200 || input.consent !== true) {
        return json({ error: "Please check your feedback details and try again." }, 400, request);
      }
      if (input.website.trim()) return json({ ok: true, message: "Thank you. Your feedback has been sent for review." }, 200, request);
      const db = dbAdmin();
      const { data: settingsRows, error: settingsError } = await db.from("pixel_forge_site_settings")
        .select("setting_key,setting_value").in("setting_key", [
          "home.feedback.enabled","home.feedback.categories","home.feedback.allow_anonymous"
        ]);
      if (settingsError) throw settingsError;
      const settings = Object.fromEntries((settingsRows ?? []).map(row => [row.setting_key, row.setting_value]));
      const categories = Array.isArray(settings["home.feedback.categories"]) ? settings["home.feedback.categories"] : [];
      if (settings["home.feedback.enabled"] !== true) return json({ error: "Feedback is currently disabled." }, 403, request);
      if (settings["home.feedback.allow_anonymous"] === false && !input.name.trim()) {
        return json({ error: "Please enter your name to submit feedback." }, 400, request);
      }
      if (!categories.includes(input.category)) return json({ error: "Choose a valid feedback category." }, 400, request);
      const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "";
      let submissionHash: string | null = null;
      if (ip) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(required("SUPABASE_SERVICE_ROLE_KEY") + "|" + ip));
        submissionHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
        const { count, error: rateError } = await db.from("pixel_forge_public_feedback")
          .select("id", { count: "exact", head: true }).eq("submission_hash", submissionHash)
          .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
        if (rateError) throw rateError;
        if ((count ?? 0) >= 5) return json({ error: "Too many feedback submissions. Please try again later." }, 429, request);
      }
      const { error: insertError } = await db.from("pixel_forge_public_feedback").insert({
        name: input.name.trim() || null, category: input.category, rating: input.rating,
        message: input.message.trim(), status: "pending", consent: true, submission_hash: submissionHash,
      });
      if (insertError) throw insertError;
      return json({ ok: true, message: "Thank you. Your feedback has been sent for review." }, 200, request);
    }

    if (request.method === "POST" && action === "submit-contact") {
      const raw = await request.text();
      if (raw.length > 5000) return json({ error: "Contact message is too large." }, 413, request);
      const input = (() => { try { return JSON.parse(raw); } catch (_) { return null; } })();
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 4 ||
          typeof input.name !== "string" || input.name.trim().length < 1 || input.name.length > 80 ||
          typeof input.email !== "string" || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
          typeof input.subject !== "string" || input.subject.trim().length < 3 || input.subject.length > 120 ||
          typeof input.message !== "string" || input.message.trim().length < 10 || input.message.length > 3000) {
        return json({ error: "Please check your name, email, subject and message." }, 400, request);
      }
      const db = dbAdmin();
      const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "";
      let submissionHash: string | null = null;
      if (ip) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(required("SUPABASE_SERVICE_ROLE_KEY") + "|contact|" + ip));
        submissionHash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
        const { count, error: rateError } = await db.from("pixel_forge_contact_messages").select("id", { count: "exact", head: true }).eq("submission_hash", submissionHash).gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
        if (rateError) throw rateError;
        if ((count ?? 0) >= 5) return json({ error: "Too many messages. Please try again later." }, 429, request);
      }
      const { error } = await db.from("pixel_forge_contact_messages").insert({ name: input.name.trim(), email: input.email.trim().toLowerCase(), subject: input.subject.trim(), message: input.message.trim(), status: "new", submission_hash: submissionHash });
      if (error) throw error;
      return json({ ok: true, message: "Your message has been sent to the PixelForge team." }, 200, request);
    }
    if (request.method === "POST" && action === "track-resource") {
      const raw = await request.text();
      if (raw.length > 2000) return json({ error: "Resource tracking request is too large." }, 413, request);
      const input = (() => { try { return JSON.parse(raw); } catch (_) { return null; } })();
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 3 ||
          !["supabase","google_drive"].includes(input.source) ||
          typeof input.resourceId !== "string" || !input.resourceId.trim() || input.resourceId.length > 512 ||
          typeof input.visitorId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.visitorId)) {
        return json({ error: "Invalid resource tracking request." }, 400, request);
      }
      const db = dbAdmin();
      if (input.source === "google_drive") {
        const { data: published, error: publishedError } = await db.from("pixel_forge_published_documents")
          .select("id").eq("source", "google_drive").eq("published", true)
          .eq("drive_file_id", input.resourceId).maybeSingle();
        if (publishedError) throw publishedError;
        if (!published) return json({ error: "Resource is not publicly published." }, 404, request);
      } else {
        const parts = input.resourceId.split("/");
        const allowedCategories = ["pdf-documents","study-notes","books-resources","other-documents","exam-materials","technology-guides"];
        const category = parts[0];
        const fileName = parts[1];
        if (parts.length !== 2 || !allowedCategories.includes(category) || !fileName || fileName.length > 255 || fileName.includes("..")) {
          return json({ error: "Resource is not publicly published." }, 404, request);
        }
        const { data: files, error: storageError } = await db.storage.from("public-documents").list(category, { search: fileName, limit: 100 });
        if (storageError) throw storageError;
        if (!(files ?? []).some(file => file.name === fileName && !file.name.endsWith("/"))) {
          return json({ error: "Resource is not publicly published." }, 404, request);
        }
      }
      const hmacKey = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(required("SUPABASE_SERVICE_ROLE_KEY")),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const signature = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(input.visitorId));
      const visitorHash = Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, "0")).join("");
      const { data: recorded, error: trackError } = await db.rpc("pixel_forge_track_resource_view", {
        p_source: input.source, p_resource_id: input.resourceId, p_visitor_hash: visitorHash,
      });
      if (trackError) throw trackError;
      return json({ ok: true, recorded: recorded === true }, 200, request);
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

    if (request.method === "GET" && action === "contact-list") {
      const { data, error } = await actor.db.from("pixel_forge_contact_messages").select("id,name,email,subject,message,status,created_at,read_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ messages: data ?? [] }, 200, request);
    }

    if (request.method === "POST" && action === "contact-status") {
      const raw = await request.text();
      if (raw.length > 1000) return json({ error: "Contact update is too large." }, 413, request);
      const input = (() => { try { return JSON.parse(raw); } catch (_) { return null; } })();
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 2 || typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id) || !["read","archived"].includes(input.status)) return json({ error: "Invalid contact message update." }, 400, request);
      const { error } = await actor.db.from("pixel_forge_contact_messages").update({ status: input.status, read_at: input.status === "read" ? new Date().toISOString() : null }).eq("id", input.id);
      if (error) throw error;
      return json({ ok: true }, 200, request);
    }
    if (request.method === "GET" && action === "feedback-list") {
      const { data, error } = await actor.db.from("pixel_forge_public_feedback")
        .select("id,name,category,rating,message,status,created_at,reviewed_at,reviewed_by")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ feedback: data ?? [] }, 200, request);
    }

    if (request.method === "POST" && action === "feedback-moderate") {
      const raw = await request.text();
      if (raw.length > 1000) return json({ error: "Moderation request is too large." }, 413, request);
      const input = (() => { try { return JSON.parse(raw); } catch (_) { return null; } })();
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 2 ||
          typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id) ||
          !["approved","rejected"].includes(input.status)) {
        return json({ error: "Invalid feedback moderation request." }, 400, request);
      }
      const { error } = await actor.db.rpc("pixel_forge_moderate_feedback", {
        p_feedback_id: input.id, p_status: input.status, p_actor_uid: actor.uid,
      });
      if (error) throw error;
      return json({ ok: true }, 200, request);
    }

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
