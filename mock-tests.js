(() => {
  const SUPABASE_URL = "https://zeueivmdzhkhonkyllij.supabase.co";
  const SUPABASE_KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  const grid = document.getElementById("mock-test-grid");
  const status = document.getElementById("mock-list-status");
  const refresh = document.getElementById("mock-refresh");
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  function makeMeta(label, value) {
    const item = document.createElement("span");
    item.className = "mock-test-meta-item";
    item.textContent = label + ": " + value;
    return item;
  }
  function renderTests(tests) {
    grid.replaceChildren();
    if (!tests.length) {
      const empty = document.createElement("div");
      empty.className = "mock-empty-state";
      const heading = document.createElement("h3");
      heading.textContent = "No tests published yet";
      const copy = document.createElement("p");
      copy.textContent = "New mock tests will appear here after they are published by the PixelForge team.";
      empty.append(heading, copy);
      grid.append(empty);
      return;
    }
    tests.forEach(test => {
      const card = document.createElement("article");
      card.className = "mock-test-card";
      const top = document.createElement("div");
      top.className = "mock-test-card-top";
      const tag = document.createElement("span");
      tag.className = "mock-published-tag";
      tag.textContent = "PUBLISHED";
      top.append(tag);
      const title = document.createElement("h3");
      title.textContent = test.title;
      const description = document.createElement("p");
      description.className = "mock-test-description";
      description.textContent = test.description || "Open the instructions before starting this assessment.";
      const meta = document.createElement("div");
      meta.className = "mock-test-meta";
      meta.append(
        makeMeta("Duration", Math.round(test.duration_seconds / 60) + " min"),
        makeMeta("Marks / question", String(test.marks_per_question)),
        makeMeta("Negative marks", String(test.negative_marks))
      );
      const instructions = document.createElement("details");
      instructions.className = "mock-instructions";
      const summary = document.createElement("summary");
      summary.textContent = "Read test instructions";
      const instructionText = document.createElement("p");
      instructionText.textContent = test.instructions || "No additional instructions provided.";
      instructions.append(summary, instructionText);
      const action = document.createElement("p");
      action.className = "mock-test-coming-soon";
      action.textContent = "Online test-taking will be enabled in the next release.";
      card.append(top, title, description, meta, instructions, action);
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
