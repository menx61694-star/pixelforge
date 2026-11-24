(() => {
  const SUPABASE_URL = "https://zeueivmdzhkhonkyllij.supabase.co";
  const SUPABASE_KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  const grid = document.getElementById("mock-test-grid");
  const status = document.getElementById("mock-list-status");
  const refresh = document.getElementById("mock-refresh");
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function makeMeta(label, value) {
    return el("span", "mock-test-meta-item", label + ": " + value);
  }
  async function startTest(test, button) {
    const name = prompt("Enter your name (optional):") || "";
    button.disabled = true;
    button.textContent = "Preparing your exam…";
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/mock-test-management?action=start-attempt", {
        method: "POST",
        headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ test_id: test.id, candidate_name: name }),
        credentials: "omit"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not start this test.");
      const attempt = payload.attempt;
      const key = "pixelforge_mock_attempt_" + attempt.id;
      sessionStorage.setItem(key, payload.attempt_token);
      sessionStorage.setItem(key + "_meta", JSON.stringify({
        id: attempt.id,
        test_title: test.title,
        expires_at: attempt.expires_at,
        duration_seconds: attempt.duration_seconds,
        total_questions: attempt.total_questions
      }));
      window.location.href = "mock-test-exam.html?attempt=" + encodeURIComponent(attempt.id);
    } catch (error) {
      alert(error.message || "Could not start this test.");
      button.disabled = false;
      button.textContent = "Start Test";
    }
  }
  function renderTests(tests) {
    grid.replaceChildren();
    if (!tests.length) {
      const empty = el("div", "mock-empty-state");
      empty.append(el("h3", "", "No tests published yet"), el("p", "", "New mock tests will appear here after they are published by the PixelForge team."));
      grid.append(empty);
      return;
    }
    tests.forEach(test => {
      const card = el("article", "mock-test-card");
      const top = el("div", "mock-test-card-top");
      top.append(el("span", "mock-published-tag", "PUBLISHED"));
      card.append(top, el("h3", "", test.title), el("p", "mock-test-description", test.description || "Read the instructions before starting."));
      const meta = el("div", "mock-test-meta");
      meta.append(
        makeMeta("Duration", Math.round(test.duration_seconds / 60) + " min"),
        makeMeta("Questions", test.question_count ?? "—"),
        makeMeta("Marks / question", String(test.marks_per_question)),
        makeMeta("Negative marks", String(test.negative_marks))
      );
      const instructions = el("details", "mock-instructions");
      instructions.append(el("summary", "", "Read test instructions"), el("p", "", test.instructions || "No additional instructions provided."));
      const start = el("button", "mock-start-button", "Start Test");
      start.type = "button";
      start.addEventListener("click", () => startTest(test, start));
      card.append(meta, instructions, start);
      grid.append(card);
    });
  }
  async function loadTests() {
    refresh.disabled = true;
    status.textContent = "Loading published tests…";
    status.classList.remove("is-error");
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/mock-test-management?action=public-list", {
        method: "GET",
        headers: { "apikey": SUPABASE_KEY, "Accept": "application/json" },
        credentials: "omit"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load published tests.");
      const tests = Array.isArray(payload.tests) ? payload.tests : [];
      renderTests(tests);
      status.textContent = tests.length + " published test(s) available.";
    } catch (error) {
      grid.replaceChildren();
      status.textContent = error.message || "Could not load published tests. Please try again.";
      status.classList.add("is-error");
    } finally {
      refresh.disabled = false;
    }
  }
  refresh.addEventListener("click", loadTests);
  loadTests();
})();