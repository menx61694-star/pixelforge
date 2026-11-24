import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = "pixelforge-66f0c";
const ALLOWED_ORIGINS = new Set([
  "https://pixelforge.jo3.org",
  "https://pixelforge-z2in.onrender.com",
  Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ?? "",
  "http://localhost:8000",
].filter(Boolean));

function headers(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
function reply(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(request), "Content-Type": "application/json" },
  });
}
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}
function dbAdmin() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function firebaseIdentity(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(required("FIREBASE_WEB_API_KEY"))}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) },
  );
  if (!response.ok) return null;
  const payload = await response.json();
  const user = payload.users?.[0];
  if (!user || user.disabled === true) return null;
  const encoded = idToken.split(".")[1];
  if (!encoded) return null;
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const claims = JSON.parse(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)));
  if (claims.iss !== "https://securetoken.google.com/" + FIREBASE_PROJECT_ID ||
      claims.aud !== FIREBASE_PROJECT_ID || claims.sub !== user.localId) return null;
  return { uid: user.localId as string };
}
async function requireMockAdmin(request: Request) {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const identity = await firebaseIdentity(token);
  if (!identity) return null;
  const db = dbAdmin();
  const { data: user, error: userError } = await db.from("pixel_forge_users")
    .select("role,status").eq("uid", identity.uid).maybeSingle();
  if (userError) throw userError;
  if (!user || user.status !== "active" || user.role !== "admin") return null;
  const { data: permission, error: permissionError } = await db.from("pixel_forge_role_permissions")
    .select("allowed").eq("role", user.role).eq("permission", "mock_tests.manage").maybeSingle();
  if (permissionError) throw permissionError;
  return permission?.allowed === true ? { uid: identity.uid, db } : null;
}
const isText = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const validId = (value: unknown) => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
function validateTest(input: Record<string, unknown>, partial = false) {
  const errors: string[] = [];
  if (!partial || "title" in input) if (!isText(input.title, 120) || (input.title as string).trim().length < 3) errors.push("Title must be 3–120 characters.");
  if (!partial || "description" in input) if (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 1000)) errors.push("Description is too long.");
  if (!partial || "instructions" in input) if (input.instructions !== undefined && (typeof input.instructions !== "string" || input.instructions.length > 3000)) errors.push("Instructions are too long.");
  if (!partial || "duration_seconds" in input) if (!Number.isInteger(input.duration_seconds) || Number(input.duration_seconds) < 60 || Number(input.duration_seconds) > 14400) errors.push("Duration must be between 1 minute and 4 hours.");
  if (!partial || "marks_per_question" in input) if (!Number.isFinite(Number(input.marks_per_question)) || Number(input.marks_per_question) <= 0 || Number(input.marks_per_question) > 100) errors.push("Marks per question must be greater than 0 and at most 100.");
  if (!partial || "negative_marks" in input) if (!Number.isFinite(Number(input.negative_marks)) || Number(input.negative_marks) < 0 || Number(input.negative_marks) > 100) errors.push("Negative marks must be 0–100.");
  if (!partial || "status" in input) if (!["draft", "published", "archived"].includes(String(input.status))) errors.push("Choose Draft, Published or Archived.");
  for (const field of ["starts_at", "ends_at"]) if (field in input && input[field] !== null && input[field] !== "" && (typeof input[field] !== "string" || Number.isNaN(Date.parse(input[field] as string)))) errors.push("Enter valid availability dates.");
  if (input.starts_at && input.ends_at && Date.parse(String(input.ends_at)) <= Date.parse(String(input.starts_at))) errors.push("End time must be after start time.");
  if ("shuffle_questions" in input && typeof input.shuffle_questions !== "boolean") errors.push("Invalid question shuffle setting.");
  if ("shuffle_options" in input && typeof input.shuffle_options !== "boolean") errors.push("Invalid option shuffle setting.");
  return errors;
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: headers(request) });
  const origin = request.headers.get("Origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return reply(request, { error: "Origin is not allowed." }, 403);
  if (request.method !== "GET" && request.method !== "POST") return reply(request, { error: "Method not allowed." }, 405);
  try {
    const actor = await requireMockAdmin(request);
    if (!actor) return reply(request, { error: "Active administrator permission mock_tests.manage is required." }, 403);
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "";
    const db = actor.db;
    const input = request.method === "POST" ? await request.json() as Record<string, unknown> : {};

    if (request.method === "GET" && action === "list") {
      const { data, error } = await db.from("pixel_forge_mock_tests")
        .select("id,title,description,instructions,duration_seconds,marks_per_question,negative_marks,status,starts_at,ends_at,shuffle_questions,shuffle_options,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return reply(request, { tests: data ?? [] });
    }
    if (request.method === "GET" && action === "questions") {
      const testId = url.searchParams.get("test_id");
      if (!validId(testId)) return reply(request, { error: "Valid test_id is required." }, 400);
      const { data, error } = await db.from("pixel_forge_mock_questions")
        .select("id,test_id,question_order,question_text,options,correct_option_index,explanation,created_at,updated_at")
        .eq("test_id", testId).order("question_order");
      if (error) throw error;
      return reply(request, { questions: data ?? [] });
    }
    if (request.method !== "POST") return reply(request, { error: "Unsupported action." }, 400);

    if (action === "create-test" || action === "update-test") {
      const id = input.id;
      if (action === "update-test" && !validId(id)) return reply(request, { error: "Valid test id is required." }, 400);
      const errors = validateTest(input, action === "update-test");
      if (errors.length) return reply(request, { error: errors.join(" ") }, 400);
      const fields = ["title","description","instructions","duration_seconds","marks_per_question","negative_marks","status","starts_at","ends_at","shuffle_questions","shuffle_options"];
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const field of fields) if (field in input) row[field] = input[field] === "" && (field === "starts_at" || field === "ends_at") ? null : input[field];
      if (action === "create-test") {
        row.created_by = actor.uid;
        const { data, error } = await db.from("pixel_forge_mock_tests").insert(row).select("id").single();
        if (error) throw error;
        return reply(request, { saved: true, id: data.id }, 201);
      }
      const { data, error } = await db.from("pixel_forge_mock_tests").update(row).eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return reply(request, { error: "Mock test was not found." }, 404);
      return reply(request, { saved: true, id: data.id });
    }
    if (action === "delete-test") {
      if (!validId(input.id)) return reply(request, { error: "Valid test id is required." }, 400);
      const { error } = await db.from("pixel_forge_mock_tests").delete().eq("id", input.id);
      if (error) {
        if (error.code === "23503") return reply(request, { error: "This test already has attempts and cannot be deleted. Archive it instead." }, 409);
        throw error;
      }
      return reply(request, { deleted: true });
    }
    if (action === "save-question") {
      const testId = input.test_id;
      const questionId = input.id;
      if (!validId(testId)) return reply(request, { error: "Valid test id is required." }, 400);
      const text = typeof input.question_text === "string" ? input.question_text.trim() : "";
      const options = input.options;
      const order = Number(input.question_order);
      const correct = Number(input.correct_option_index);
      if (!text || text.length > 3000) return reply(request, { error: "Question text is required (maximum 3000 characters)." }, 400);
      if (!Array.isArray(options) || options.length !== 4 || options.some(v => typeof v !== "string" || !v.trim() || v.length > 500)) return reply(request, { error: "Enter exactly four non-empty options (maximum 500 characters each)." }, 400);
      if (!Number.isInteger(order) || order < 1 || order > 1000) return reply(request, { error: "Question order must be 1–1000." }, 400);
      if (!Number.isInteger(correct) || correct < 0 || correct > 3) return reply(request, { error: "Select the correct option." }, 400);
      if (typeof input.explanation !== "string" || input.explanation.length > 3000) return reply(request, { error: "Explanation is too long." }, 400);
      const row = { test_id: testId, question_order: order, question_text: text, options: options.map((v: string) => v.trim()), correct_option_index: correct, explanation: input.explanation, updated_at: new Date().toISOString() };
      let query;
      if (validId(questionId)) query = db.from("pixel_forge_mock_questions").update(row).eq("id", questionId).eq("test_id", testId);
      else query = db.from("pixel_forge_mock_questions").insert(row);
      const { data, error } = await query.select("id").single();
      if (error) {
        if (error.code === "23505") return reply(request, { error: "This question order is already used in this test." }, 409);
        throw error;
      }
      return reply(request, { saved: true, id: data.id });
    }
    if (action === "delete-question") {
      if (!validId(input.id) || !validId(input.test_id)) return reply(request, { error: "Valid question and test ids are required." }, 400);
      const { error } = await db.from("pixel_forge_mock_questions").delete().eq("id", input.id).eq("test_id", input.test_id);
      if (error) throw error;
      return reply(request, { deleted: true });
    }
    return reply(request, { error: "Unknown action." }, 400);
  } catch (error) {
    console.error("mock-test-management error:", error);
    return reply(request, { error: error instanceof Error ? error.message : "Mock Test request failed." }, 500);
  }
});
