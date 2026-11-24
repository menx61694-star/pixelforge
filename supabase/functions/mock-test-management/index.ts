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
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-mock-attempt-token",
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
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "";

    // Candidate endpoints use opaque, high-entropy bearer tokens. Only token hashes are stored.
    const attemptToken = request.headers.get("X-Mock-Attempt-Token") ?? "";
    const tokenHash = async (value: string) => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    };
    if (request.method === "POST" && action === "start-attempt") {
      const input = await request.json() as Record<string, unknown>;
      if (!validId(input.test_id)) return reply(request, { error: "Valid test id is required." }, 400);
      const db = dbAdmin();
      const now = new Date();
      const { data: test, error: testError } = await db.from("pixel_forge_mock_tests")
        .select("id,title,duration_seconds,marks_per_question,negative_marks,starts_at,ends_at,shuffle_questions,shuffle_options")
        .eq("id", input.test_id).eq("status", "published").maybeSingle();
      if (testError) throw testError;
      if (!test) return reply(request, { error: "This test is not available." }, 404);
      if ((test.starts_at && Date.parse(test.starts_at) > now.getTime()) || (test.ends_at && Date.parse(test.ends_at) <= now.getTime()))
        return reply(request, { error: "This test is outside its availability window." }, 403);
      const { data: questions, error: questionError } = await db.from("pixel_forge_mock_questions")
        .select("id,question_order").eq("test_id", test.id).order("question_order");
      if (questionError) throw questionError;
      if (!questions?.length) return reply(request, { error: "This test has no questions yet." }, 409);
      const rawToken = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(now.getTime() + test.duration_seconds * 1000);
      const { data: attempt, error: attemptError } = await db.from("pixel_forge_mock_attempts").insert({
        test_id: test.id, attempt_token_hash: await tokenHash(rawToken),
        candidate_name: typeof input.candidate_name === "string" ? input.candidate_name.trim().slice(0,120) : "",
        status: "in_progress", expires_at: expiresAt.toISOString(), total_questions: questions.length,
        max_score: questions.length * Number(test.marks_per_question)
      }).select("id,started_at,expires_at,total_questions").single();
      if (attemptError) throw attemptError;
      const order = questions.map(q => q.id);
      if (test.shuffle_questions) {
        for (let i=order.length-1;i>0;i--) { const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1); [order[i],order[j]]=[order[j],order[i]]; }
      }
      const maps = order.map((questionId, index) => {
        const optionOrder = [0,1,2,3];
        if (test.shuffle_options) for (let i=3;i>0;i--) { const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1); [optionOrder[i],optionOrder[j]]=[optionOrder[j],optionOrder[i]]; }
        return { attempt_id: attempt.id, question_id: questionId, display_order: index+1, option_order: optionOrder };
      });
      const { error: mapError } = await db.from("pixel_forge_mock_attempt_question_map").insert(maps);
      if (mapError) { await db.from("pixel_forge_mock_attempts").delete().eq("id", attempt.id); throw mapError; }
      return reply(request, { attempt: { ...attempt, test_title: test.title, duration_seconds: test.duration_seconds, marks_per_question: test.marks_per_question, negative_marks: test.negative_marks }, attempt_token: rawToken }, 201);
    }
    if (["attempt-state","save-answer","submit-attempt"].includes(action)) {
      if (!attemptToken || attemptToken.length > 200) return reply(request, { error: "Attempt session is missing. Reopen the test." }, 401);
      const db = dbAdmin();
      const { data: attempt, error: attemptError } = await db.from("pixel_forge_mock_attempts")
        .select("*").eq("attempt_token_hash", await tokenHash(attemptToken)).maybeSingle();
      if (attemptError) throw attemptError;
      if (!attempt) return reply(request, { error: "Attempt session is invalid." }, 401);
      if (action === "attempt-state") {
        const { data: maps, error: mapError } = await db.from("pixel_forge_mock_attempt_question_map")
          .select("question_id,display_order,option_order").eq("attempt_id", attempt.id).order("display_order");
        if (mapError) throw mapError;
        const ids = (maps ?? []).map(m => m.question_id);
        const { data: questions, error: qError } = await db.from("pixel_forge_mock_questions")
          .select("id,question_text,options").in("id", ids);
        if (qError) throw qError;
        const { data: answers, error: answerError } = await db.from("pixel_forge_mock_attempt_answers")
          .select("question_id,selected_option_index,marked_for_review").eq("attempt_id", attempt.id);
        if (answerError) throw answerError;
        const answerMap = new Map((answers ?? []).map(a => [a.question_id,a.selected_option_index]));
        const qMap = new Map((questions ?? []).map(q => [q.id,q]));
        return reply(request, { attempt: { id: attempt.id, status: attempt.status, started_at: attempt.started_at, expires_at: attempt.expires_at, total_questions: attempt.total_questions }, questions: (maps ?? []).map(m => { const q=qMap.get(m.question_id); return { id:m.question_id, question_text:q?.question_text ?? "", options:m.option_order.map(i=>q?.options?.[i] ?? ""), selected_option_index: answerMap.has(m.question_id) && answerMap.get(m.question_id)!==null ? m.option_order.indexOf(answerMap.get(m.question_id)) : null, marked_for_review: (answers ?? []).some(a=>a.question_id===m.question_id && a.marked_for_review===true), display_order:m.display_order }; }) });
      }
      if (attempt.status !== "in_progress") return reply(request, { error: "This attempt has already been submitted.", status: attempt.status }, 409);
      if (Date.now() >= Date.parse(attempt.expires_at) && action === "save-answer") return reply(request, { error: "Time is over. Submit your test now." }, 409);
      if (action === "save-answer") {
        const input = await request.json() as Record<string, unknown>;
        if (!validId(input.question_id) || !(input.selected_option_index === null || Number.isInteger(input.selected_option_index) && Number(input.selected_option_index)>=0 && Number(input.selected_option_index)<=3) || (input.marked_for_review !== undefined && typeof input.marked_for_review !== "boolean"))
          return reply(request, { error: "Invalid answer selection." }, 400);
        const { data: map, error: mapError } = await db.from("pixel_forge_mock_attempt_question_map").select("option_order").eq("attempt_id",attempt.id).eq("question_id",input.question_id).maybeSingle();
        if (mapError) throw mapError;
        if (!map) return reply(request, { error: "Question does not belong to this attempt." }, 403);
        const selected = input.selected_option_index === null ? null : map.option_order[Number(input.selected_option_index)];
        const { error } = await db.from("pixel_forge_mock_attempt_answers").upsert({ attempt_id:attempt.id, question_id:input.question_id, selected_option_index:selected, marked_for_review:input.marked_for_review===true, is_correct:null, awarded_marks:null, answered_at:new Date().toISOString() }, { onConflict:"attempt_id,question_id" });
        if (error) throw error;
        return reply(request, { saved:true });
      }
      const now = new Date();
      const expired = now.getTime() >= Date.parse(attempt.expires_at);
      const { data: maps, error: mapError } = await db.from("pixel_forge_mock_attempt_question_map").select("question_id,display_order,option_order").eq("attempt_id",attempt.id).order("display_order");
      if (mapError) throw mapError;
      const ids = (maps ?? []).map(m=>m.question_id);
      const { data: questions, error: qError } = await db.from("pixel_forge_mock_questions").select("id,question_text,options,correct_option_index,explanation").in("id",ids);
      if (qError) throw qError;
      const { data: answers, error: aError } = await db.from("pixel_forge_mock_attempt_answers").select("question_id,selected_option_index").eq("attempt_id",attempt.id);
      if (aError) throw aError;
      const answerMap = new Map((answers ?? []).map(a=>[a.question_id,a.selected_option_index]));
      const questionMap = new Map((questions ?? []).map(q=>[q.id,q]));
      let correct=0, incorrect=0, unanswered=0;
      const review = (maps ?? []).map(m=>{
        const q=questionMap.get(m.question_id); const selected=answerMap.get(m.question_id) ?? null;
        const isCorrect=selected !== null && selected === q.correct_option_index;
        if(selected===null) unanswered++; else if(isCorrect) correct++; else incorrect++;
        const awarded=selected===null?0:(isCorrect?Number((awaitMarks=>awaitMarks)(1)):0);
        return { question_id:q.id, question_text:q.question_text, options:m.option_order.map(i=>q.options[i]), selected_option_index:selected===null?null:m.option_order.indexOf(selected), correct_option_index:m.option_order.indexOf(q.correct_option_index), explanation:q.explanation, is_correct:isCorrect };
      });
      const { data: test, error: testError } = await db.from("pixel_forge_mock_tests").select("marks_per_question,negative_marks").eq("id",attempt.test_id).single();
      if(testError) throw testError;
      const score=correct*Number(test.marks_per_question)-incorrect*Number(test.negative_marks);
      const { error: updateAnswersError } = await db.from("pixel_forge_mock_attempt_answers").upsert((maps ?? []).map(m=>({attempt_id:attempt.id,question_id:m.question_id,selected_option_index:answerMap.get(m.question_id) ?? null,is_correct:answerMap.get(m.question_id)!==null && answerMap.get(m.question_id)===questionMap.get(m.question_id).correct_option_index,awarded_marks:answerMap.get(m.question_id)===null || answerMap.get(m.question_id)===undefined?0:(answerMap.get(m.question_id)===questionMap.get(m.question_id).correct_option_index?Number(test.marks_per_question):-Number(test.negative_marks))})),{onConflict:"attempt_id,question_id"});
      if(updateAnswersError) throw updateAnswersError;
      const { data: finalized, error: finalizeError } = await db.from("pixel_forge_mock_attempts").update({status:expired?"expired":"submitted",submitted_at:now.toISOString(),correct_count:correct,incorrect_count:incorrect,unanswered_count:unanswered,score}).eq("id",attempt.id).eq("status","in_progress").select("id").maybeSingle();
      if(finalizeError) throw finalizeError;
      if(!finalized) return reply(request,{error:"This attempt was already submitted."},409);
      return reply(request,{result:{status:expired?"expired":"submitted",correct_count:correct,incorrect_count:incorrect,unanswered_count:unanswered,score,max_score:attempt.max_score,review}});
    }
    // Public listing exposes only published test metadata. Question answer keys
    // and attempt records remain inaccessible to anonymous visitors.
    if (request.method === "GET" && action === "public-list") {
      const db = dbAdmin();
      const now = Date.now();
      const { data, error } = await db.from("pixel_forge_mock_tests")
        .select("id,title,description,instructions,duration_seconds,marks_per_question,negative_marks,starts_at,ends_at,created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const tests = (data ?? []).filter((test) =>
        (!test.starts_at || Date.parse(test.starts_at) <= now) &&
        (!test.ends_at || Date.parse(test.ends_at) > now)
      );
      return reply(request, { tests });
    }

    const actor = await requireMockAdmin(request);
    if (!actor) return reply(request, { error: "Active administrator permission mock_tests.manage is required." }, 403);
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
    if (action === "bulk-import") {
      const tests = input.tests;
      if (!Array.isArray(tests) || tests.length !== 5) return reply(request, { error: "Exactly five mock tests are required." }, 400);
      const expected = [25,5,30,8,16,8,8,8,4,8];
      const created: string[] = [];
      for (const [testIndex, test] of tests.entries()) {
        if (!test || typeof test.title !== "string" || !Array.isArray(test.questions) || test.questions.length !== 120) {
          return reply(request, { error: "Each mock must contain exactly 120 questions." }, 400);
        }
        const counts = expected.map((count, sectionIndex) => test.questions.filter((q: any) => q.section_index === sectionIndex).length);
        if (counts.some((count, i) => count !== expected[i])) return reply(request, { error: "Mock " + (testIndex + 1) + " does not match the official section-wise question distribution." }, 400);
        for (const [questionIndex, q] of test.questions.entries()) {
          if (!q || typeof q.question_text !== "string" || !q.question_text.trim() || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some((v: unknown) => typeof v !== "string" || !v.trim()) || !Number.isInteger(q.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3 || typeof q.explanation !== "string") {
            return reply(request, { error: "Invalid MCQ at mock " + (testIndex + 1) + ", question " + (questionIndex + 1) + "." }, 400);
          }
        }
      }
      for (const test of tests) {
        const { data: createdTest, error: testError } = await db.from("pixel_forge_mock_tests").insert({
          title: test.title, description: test.description ?? "", instructions: test.instructions ?? "",
          duration_seconds: 7200, marks_per_question: 3, negative_marks: 1, status: "draft",
          shuffle_questions: false, shuffle_options: false, created_by: actor.uid
        }).select("id").single();
        if (testError) throw testError;
        created.push(createdTest.id);
        const rows = test.questions.map((q: any, index: number) => ({
          test_id: createdTest.id, question_order: index + 1, question_text: q.question_text,
          options: q.options, correct_option_index: q.correct_option_index, explanation: q.explanation
        }));
        const { error: questionError } = await db.from("pixel_forge_mock_questions").insert(rows);
        if (questionError) {
          await db.from("pixel_forge_mock_tests").delete().eq("id", createdTest.id);
          throw questionError;
        }
      }
      return reply(request, { imported: true, test_ids: created, test_count: created.length, question_count: 600 }, 201);
    }
    if (action === "bulk-add-questions") {
      const testId = input.test_id;
      const questions = input.questions;
      if (!validId(testId)) return reply(request, { error: "Valid test_id is required." }, 400);
      if (!Array.isArray(questions) || questions.length < 1 || questions.length > 500) return reply(request, { error: "Upload between 1 and 500 questions per batch." }, 400);
      const { data: testExists, error: testLookupError } = await db.from("pixel_forge_mock_tests").select("id").eq("id", testId).maybeSingle();
      if (testLookupError) throw testLookupError;
      if (!testExists) return reply(request, { error: "Mock test was not found." }, 404);
      const rows = [];
      for (const [index, q] of questions.entries()) {
        if (!q || typeof q.question_text !== "string" || !q.question_text.trim() || q.question_text.length > 3000 ||
            !Array.isArray(q.options) || q.options.length !== 4 || q.options.some((v: unknown) => typeof v !== "string" || !v.trim() || v.length > 500) ||
            !Number.isInteger(q.correct_option_index) || q.correct_option_index < 0 || q.correct_option_index > 3 ||
            (q.explanation !== undefined && (typeof q.explanation !== "string" || q.explanation.length > 3000))) {
          return reply(request, { error: "Invalid question at row " + (index + 1) + ". Each row needs question_text, four options, correct_option_index (0–3), and optional explanation." }, 400);
        }
        const order = q.question_order === undefined ? index + 1 : Number(q.question_order);
        if (!Number.isInteger(order) || order < 1 || order > 1000) return reply(request, { error: "Invalid question_order at row " + (index + 1) + "." }, 400);
        rows.push({ test_id: testId, question_order: order, question_text: q.question_text.trim(), options: q.options.map((v: string) => v.trim()), correct_option_index: q.correct_option_index, explanation: q.explanation ?? "" });
      }
      const { data, error } = await db.from("pixel_forge_mock_questions").upsert(rows, { onConflict: "test_id,question_order" }).select("id");
      if (error) throw error;
      return reply(request, { imported: true, question_count: data?.length ?? rows.length }, 201);
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
