(() => {
  "use strict";
  const API = "https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/mock-test-management";
  const KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  const params = new URLSearchParams(location.search);
  const attemptId = params.get("attempt");
  const tokenKey = attemptId ? "pixelforge_mock_attempt_" + attemptId : "";
  const token = tokenKey ? sessionStorage.getItem(tokenKey) : "";
  let meta = {};
  try { meta = JSON.parse(sessionStorage.getItem(tokenKey + "_meta") || "{}"); } catch (_) {}
  let attempt = null;
  let questions = [];
  let current = 0;
  let marked = new Set();
  let timer = null;
  let submitting = false;
  let completed = false;
  let candidateName = "Candidate";
  let questionStartedAt = Date.now();
  let paused = false;
  function elapsedForCurrent() {
    const seconds = Math.max(0, Math.floor((Date.now()-questionStartedAt)/1000));
    questionStartedAt = Date.now();
    return seconds;
  }
  function setPausedView(value) {
    paused = value;
    $("exam-workspace").hidden = value;
    $("exam-paused-panel").hidden = !value;
    $("exam-pause").textContent = value ? "Resume test" : "Pause test";
  }
  async function pauseOrResume() {
    try {
      if (!paused) {
        const savedSeconds = elapsedForCurrent();
        const q = questions[current];
        if (q && savedSeconds) await request("save-answer",{question_id:q.id,selected_option_index:q.selected_option_index ?? null,marked_for_review:marked.has(q.id),time_spent_seconds:savedSeconds});
        const payload = await request("pause-attempt");
        attempt.status = "paused";
        attempt.remaining_seconds = payload.remaining_seconds;
        clearInterval(timer);
        setPausedView(true);
        renderTimer();
      } else {
        const payload = await request("resume-attempt");
        attempt.status = "in_progress";
        attempt.expires_at = payload.expires_at;
        setPausedView(false);
        questionStartedAt = Date.now();
        renderTimer();
        timer = setInterval(renderTimer,1000);
      }
    } catch(error) { showToast(error.message || "Could not change exam state."); }
  }

  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  async function request(action, body) {
    const response = await fetch(API + "?action=" + encodeURIComponent(action), {
      method: "POST",
      headers: { "apikey": KEY, "Content-Type": "application/json", "X-Mock-Attempt-Token": token },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || ("Request failed (" + response.status + ")."));
    return payload;
  }
  function showError(message) {
    $("exam-error").hidden = false;
    $("exam-error").textContent = message;
    $("exam-workspace").hidden = true;
  }
  function answeredCount() {
    return questions.filter(q => q.selected_option_index !== null && q.selected_option_index !== undefined).length;
  }
  function renderPalette() {
    const palette = $("exam-palette");
    palette.replaceChildren();
    questions.forEach((q, index) => {
      const isAnswered = q.selected_option_index !== null && q.selected_option_index !== undefined;
      const button = el("button", "exam-palette-item" + (isAnswered ? " is-answered" : "") + (index === current ? " is-current" : "") + (marked.has(q.id) ? " is-review" : ""), String(index + 1));
      button.type = "button";
      button.setAttribute("aria-label", "Question " + (index + 1) + (isAnswered ? ", answered" : ", not answered") + (marked.has(q.id) ? ", marked for review" : ""));
      button.setAttribute("aria-current", index === current ? "step" : "false");
      button.addEventListener("click", () => { current = index; renderQuestion(); });
      palette.append(button);
    });
    const count = answeredCount();
    const percent = questions.length ? Math.round(count / questions.length * 100) : 0;
    $("exam-progress-text").textContent = percent + "%";
    $("exam-progress-fill").style.width = percent + "%";
    $("exam-progress-detail").textContent = count + " of " + questions.length + " answered";
    $("exam-palette-count").textContent = questions.length + " questions";
  }
  function renderQuestion() {
    const q = questions[current];
    if (!q) return;
    $("exam-question-count").textContent = "QUESTION " + (current + 1) + " OF " + questions.length;
    $("exam-question-number").textContent = String(current + 1).padStart(2, "0");
    $("exam-question-text").textContent = q.question_text;
    const options = $("exam-options");
    options.replaceChildren();
    q.options.forEach((value, index) => {
      const label = el("button", "exam-option" + (q.selected_option_index === index ? " is-selected" : ""));
      label.type = "button";
      label.setAttribute("aria-pressed", q.selected_option_index === index ? "true" : "false");
      const letter = el("span", "exam-option-letter", String.fromCharCode(65 + index));
      const text = el("span", "exam-option-text", value);
      const check = el("span", "exam-option-check", q.selected_option_index === index ? "✓" : "");
      label.append(letter, text, check);
      label.addEventListener("click", () => saveAnswer(q, index, marked.has(q.id)));
      options.append(label);
    });
    $("exam-prev").disabled = current === 0;
    $("exam-next").textContent = current === questions.length - 1 ? "Review & submit →" : "Save & Next →";
    $("exam-clear").disabled = q.selected_option_index === null || q.selected_option_index === undefined;
    $("exam-mark-review").textContent = marked.has(q.id) ? "★ Remove review mark" : "☆ Mark for review";
    $("exam-save-state").classList.remove("is-saving", "has-error");
    $("exam-save-state").innerHTML = "<i></i> Answers save automatically";
    $("exam-save-state").querySelector("i").setAttribute("aria-hidden", "true");
    $("exam-question-text").dir = "auto";
    renderPalette();
  }
  async function saveAnswer(q, selected, reviewFlag) {
    $("exam-save-state").classList.add("is-saving");
    $("exam-save-state").textContent = "Saving…";
    try {
      await request("save-answer", { question_id: q.id, selected_option_index: selected, marked_for_review: reviewFlag, time_spent_seconds:elapsedForCurrent() });
      q.selected_option_index = selected;
      renderQuestion();
      $("exam-save-state").textContent = "✓ Saved";
    } catch (error) {
      $("exam-save-state").classList.add("has-error");
      $("exam-save-state").textContent = "Save failed";
      showToast(error.message);
    }
  }
  function showToast(message) {
    let toast = $("exam-toast");
    if (!toast) { toast = el("div", "exam-toast"); toast.id = "exam-toast"; document.body.append(toast); }
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove("is-visible"), 4200);
  }
  function renderTimer() {
    if (!attempt) return;
    const left = attempt.status === "paused" ? Math.max(0, Number(attempt.remaining_seconds||0)*1000) : Math.max(0, Date.parse(attempt.expires_at) - Date.now());
    const minutes = Math.floor(left / 60000);
    const seconds = Math.floor(left % 60000 / 1000);
    $("exam-timer").textContent = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    $("exam-timer").classList.toggle("is-low", left <= 5 * 60000);
    $("exam-timer").classList.toggle("is-expired", left <= 0);
    if (left <= 0 && !completed && !submitting && !paused) submitTest(true);
  }
  function openSubmitDialog() {
    const count = answeredCount();
    $("exam-submit-summary").textContent = count + " answered · " + (questions.length - count) + " unanswered · " + marked.size + " marked for review. You cannot change answers after submission.";
    $("exam-submit-dialog").showModal();
  }
  async function submitTest(automatic) {
    if (completed || submitting) return;
    submitting = true;
    $("exam-confirm-submit").disabled = true;
    if (!automatic && $("exam-submit-dialog").open) $("exam-submit-dialog").close();
    $("exam-submit").disabled = true;
    $("exam-submit").textContent = automatic ? "Time ended · Submitting…" : "Submitting…";
    try {
      const payload = await request("submit-attempt");
      completed = true;
      clearInterval(timer);
      sessionStorage.removeItem(tokenKey);
      sessionStorage.removeItem(tokenKey + "_meta");
      renderResult(payload.result);
    } catch (error) {
      submitting = false;
      $("exam-submit").disabled = false;
      $("exam-submit").textContent = "Submit test →";
      $("exam-confirm-submit").disabled = false;
      showToast(error.message || "Could not submit the test. Please retry.");
    }
  }
  function renderResult(result) {
    $("exam-workspace").hidden = true;
    $("exam-result").hidden = false;
    const panel = $("exam-result");
    panel.replaceChildren();
    const head = el("div", "result-hero");
    head.append(el("span", "result-check", "✓"), el("p", "exam-kicker", "ASSESSMENT COMPLETED"), el("h2", "", "Your test has been submitted"), el("p", "", "Your responses have been evaluated successfully."));
    const score = el("div", "result-score-card");
    score.append(el("span", "result-score-label", "YOUR SCORE"), el("strong", "result-score-value", String(result.score)), el("span", "result-score-max", "out of " + result.max_score));
    const stats = el("div", "result-stats");
    [["Correct", result.correct_count, "correct"], ["Incorrect", result.incorrect_count, "incorrect"], ["Unanswered", result.unanswered_count, "unanswered"]].forEach(([label, value, cls]) => {
      const card = el("div", "result-stat " + cls); card.append(el("span", "", label), el("strong", "", String(value))); stats.append(card);
    });
    const reviewHead = el("div", "result-review-heading"); reviewHead.append(el("h3", "", "Answer review"), el("span", "", result.review.length + " questions"));
    panel.append(head, score, stats);
    const analysis = el("section","result-analysis");
    const accuracy = el("p","", "Accuracy: " + (result.accuracy ?? 0) + "% · Total tracked time: " + Math.floor((result.total_time_seconds||0)/60) + "m " + ((result.total_time_seconds||0)%60) + "s · Average/question: " + (result.average_time_per_question_seconds||0) + "s");
    analysis.append(el("h3","","Performance analysis"),accuracy);
    const table = el("div","result-analysis-groups");
    (result.analytics||[]).forEach(group => {
      const row=el("article","result-analysis-row");
      row.append(el("strong","",group.subject+" · "+group.topic),el("span","",group.correct+"/"+group.total+" correct · "+group.accuracy+"% accuracy · "+group.time_spent_seconds+"s"));
      table.append(row);
    });
    analysis.append(table);
    const weak = (result.analytics||[]).filter(x=>x.total>=2).sort((a,b)=>a.accuracy-b.accuracy).slice(0,3);
    analysis.append(el("p","result-recommendation",weak.length ? "Focus next on: "+weak.map(x=>x.subject+" / "+x.topic).join(", ") : "Attempt more tagged questions to build a reliable topic-level improvement plan."));
    const reviewHead = el("div", "result-review-heading"); reviewHead.append(el("h3", "", "Answer review"), el("span", "", result.review.length + " questions"));
    panel.append(analysis,reviewHead);
    result.review.forEach((item, index) => {
      const card = el("article", "result-question");
      card.append(el("h4", "", "Q" + (index + 1) + ". " + item.question_text));
      item.options.forEach((option, i) => {
        const row = el("p", "result-option" + (i === item.correct_option_index ? " is-correct" : "") + (i === item.selected_option_index && i !== item.correct_option_index ? " is-wrong" : ""));
        row.textContent = String.fromCharCode(65 + i) + ". " + option + (i === item.correct_option_index ? "  ✓ Correct answer" : i === item.selected_option_index ? "  · Your answer" : "");
        card.append(row);
      });
      if (item.explanation) card.append(el("p", "result-explanation", "Explanation: " + item.explanation));
      panel.append(card);
    });
    const back = el("a", "exam-primary-button result-back", "Back to mock tests →");
    back.href = "mock-tests.html";
    panel.append(back);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function bindEvents() {
    $("exam-prev").addEventListener("click", () => { if (current > 0) { current--; renderQuestion(); } });
    $("exam-next").addEventListener("click", () => { if (current < questions.length - 1) { current++; renderQuestion(); } else openSubmitDialog(); });
    $("exam-clear").addEventListener("click", () => saveAnswer(questions[current], null, marked.has(questions[current].id)));
    $("exam-mark-review").addEventListener("click", async () => { const q = questions[current]; const next = !marked.has(q.id); try { await request("save-answer", { question_id: q.id, selected_option_index: q.selected_option_index ?? null, marked_for_review: next }); next ? marked.add(q.id) : marked.delete(q.id); renderQuestion(); } catch (error) { showToast(error.message); } });
    $("exam-submit").addEventListener("click", openSubmitDialog);
    $("exam-pause").addEventListener("click", pauseOrResume);
    $("exam-resume").addEventListener("click", pauseOrResume);
    $("exam-cancel-submit").addEventListener("click", () => $("exam-submit-dialog").close());
    $("exam-confirm-submit").addEventListener("click", () => submitTest(false));
    $("exam-exit").addEventListener("click", () => $("exam-exit-dialog").showModal());
    $("exam-cancel-exit").addEventListener("click", () => $("exam-exit-dialog").close());
    $("exam-confirm-exit").addEventListener("click", () => { $("exam-exit-dialog").close(); location.href = "mock-tests.html"; });
    $("exam-fullscreen").addEventListener("click", async () => {
      try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }
      catch (_) { showToast("Fullscreen is not available in this browser."); }
    });
    $("exam-mobile-palette-toggle").addEventListener("click", () => document.querySelector(".exam-sidebar").classList.toggle("is-mobile-open"));
    document.addEventListener("keydown", event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches("input,textarea,select,button")) return;
      if (event.key === "ArrowRight" && current < questions.length - 1) { current++; renderQuestion(); }
      if (event.key === "ArrowLeft" && current > 0) { current--; renderQuestion(); }
    });
    window.addEventListener("beforeunload", event => {
      if (!completed && attempt && attempt.status === "in_progress") { event.preventDefault(); event.returnValue = ""; }
    });
  }
  async function init() {
    if (!attemptId || !token) { showError("This exam session could not be found in this browser. Return to Mock Tests and start a new attempt."); return; }
    bindEvents();
    $("exam-title").textContent = meta.test_title || "Online Mock Test";
    $("exam-candidate-name").textContent = candidateName;
    try {
      const payload = await request("attempt-state");
      attempt = payload.attempt;
      if (attempt.status !== "in_progress" && attempt.status !== "paused") { showError("This test attempt is no longer active."); return; }
      questions = (payload.questions || []).map(q => ({ ...q, selected_option_index: q.selected_option_index }));
      if (!questions.length) { showError("No questions are available in this test."); return; }
      marked = new Set(questions.filter(q => q.marked_for_review).map(q => q.id));
      $("exam-title").textContent = meta.test_title || "Online Mock Test";
      $("exam-subtitle").textContent = questions.length + " questions · Your answers are saved automatically";
      $("exam-workspace").hidden = false;
      renderQuestion();
      questionStartedAt = Date.now();
      if (attempt.status === "paused") setPausedView(true);
      renderTimer();
      if (attempt.status === "in_progress") timer = setInterval(renderTimer, 1000);
    } catch (error) {
      showError(error.message || "Could not load this exam. Please return to Mock Tests.");
    }
  }
  init();
})();