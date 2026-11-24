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
  let activeAttempt = null;
  let activeQuestions = [];
  let currentQuestion = 0;
  let markedForReview = new Set();
  let attemptResult = null;
  let timerHandle = null;
  const attemptPanel = document.createElement("section");
  attemptPanel.className = "mock-attempt-panel";
  attemptPanel.hidden = true;
  attemptPanel.setAttribute("aria-live","polite");
  document.querySelector(".mock-list-section")?.append(attemptPanel);

  function el(tag, cls, text) {
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(text!==undefined) node.textContent=text;
    return node;
  }
  async function candidateRequest(action, body, token) {
    const response=await fetch(SUPABASE_URL+"/functions/v1/mock-test-management?action="+encodeURIComponent(action),{
      method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json","X-Mock-Attempt-Token":token},
      body:body?JSON.stringify(body):undefined,credentials:"omit"
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload.error||"Mock test request failed.");
    return payload;
  }
  function showTimer() {
    const timer=attemptPanel.querySelector("[data-timer]");
    if(!timer||!activeAttempt)return;
    const remaining=Math.max(0,Date.parse(activeAttempt.expires_at)-Date.now());
    const minutes=Math.floor(remaining/60000), seconds=Math.floor((remaining%60000)/1000);
    timer.textContent=String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
    if(remaining<=0){clearInterval(timerHandle);finishAttempt(true);}
  }
  function renderAttempt() {
    if(!activeAttempt)return;
    attemptPanel.replaceChildren();
    const header=el("div","attempt-header");
    header.append(el("div","",activeAttempt.test_title||"Online Mock Test"),el("div","attempt-timer","Time left: "));
    const timer=el("strong","", "");timer.dataset.timer="true";header.lastChild.append(timer);
    const progress=el("p","attempt-progress","Question "+(currentQuestion+1)+" of "+activeQuestions.length);
    const q=activeQuestions[currentQuestion];
    const question=el("article","attempt-question");
    question.append(el("h3","",q.question_text));
    const options=el("div","attempt-options");
    q.options.forEach((option,index)=>{
      const button=el("button","attempt-option"+(q.selected_option_index===index?" selected":""),String.fromCharCode(65+index)+". "+option);
      button.type="button";button.disabled=activeAttempt.status!=="in_progress";
      button.addEventListener("click",async()=>{
        try{
          await candidateRequest("save-answer",{question_id:q.id,selected_option_index:index,marked_for_review:markedForReview.has(q.id)},activeAttempt.token);
          q.selected_option_index=index;renderAttempt();
        }catch(error){alert(error.message);}
      });
      options.append(button);
    });
    question.append(options);
    const palette=el("div","attempt-palette");
    activeQuestions.forEach((item,index)=>{
      const button=el("button","attempt-palette-item"+(index===currentQuestion?" current":"")+(item.selected_option_index!==null?" answered":"")+(markedForReview.has(item.id)?" review":""),String(index+1));
      button.type="button";button.addEventListener("click",()=>{currentQuestion=index;renderAttempt();});palette.append(button);
    });
    const controls=el("div","attempt-controls");
    const previous=el("button","", "Previous");previous.type="button";previous.disabled=currentQuestion===0;previous.addEventListener("click",()=>{currentQuestion--;renderAttempt();});
    const mark=el("button","",markedForReview.has(q.id)?"Unmark review":"Mark for review");mark.type="button";mark.addEventListener("click",async()=>{const next=!markedForReview.has(q.id);try{await candidateRequest("save-answer",{question_id:q.id,selected_option_index:q.selected_option_index,marked_for_review:next},activeAttempt.token);next?markedForReview.add(q.id):markedForReview.delete(q.id);renderAttempt();}catch(error){alert(error.message);}});
    const next=el("button","primary",currentQuestion===activeQuestions.length-1?"Review answers":"Save & Next");next.type="button";next.addEventListener("click",()=>{if(currentQuestion<activeQuestions.length-1){currentQuestion++;renderAttempt();}else showSubmitPrompt();});
    controls.append(previous,mark,next);
    const legend=el("p","attempt-legend","Green: answered · Amber: marked for review · Blue: current");
    attemptPanel.append(header,progress,question,palette,controls,legend);
    showTimer();
  }
  function showSubmitPrompt(){
    const answered=activeQuestions.filter(q=>q.selected_option_index!==null).length;
    if(confirm("Submit this test? Answered: "+answered+" / "+activeQuestions.length+". Unanswered: "+(activeQuestions.length-answered)+"."))finishAttempt(false);
  }
  async function finishAttempt(auto){
    if(!activeAttempt||activeAttempt.status!=="in_progress")return;
    try{
      const payload=await candidateRequest("submit-attempt",null,activeAttempt.token);
      activeAttempt.status=payload.result.status;attemptResult=payload.result;
      clearInterval(timerHandle);sessionStorage.removeItem("pixelforge_mock_attempt_"+activeAttempt.id);
      renderResult();
    }catch(error){if(auto)attemptPanel.prepend(el("p","attempt-error",error.message));else alert(error.message);}
  }
  function renderResult(){
    attemptPanel.replaceChildren();
    const r=attemptResult;
    attemptPanel.append(el("h2","","Test result"),el("p","attempt-score","Score: "+r.score+" / "+r.max_score),
      el("p","","Correct: "+r.correct_count+" · Incorrect: "+r.incorrect_count+" · Unanswered: "+r.unanswered_count));
    r.review.forEach((item,index)=>{
      const card=el("article","attempt-review");
      card.append(el("h3","","Q"+(index+1)+". "+item.question_text));
      item.options.forEach((option,i)=>card.append(el("p",i===item.correct_option_index?"correct-answer":i===item.selected_option_index?"wrong-answer":"",""+String.fromCharCode(65+i)+". "+option)));
      if(item.explanation)card.append(el("p","", "Explanation: "+item.explanation));
      attemptPanel.append(card);
    });
  }
  async function startTest(test){
    const name=prompt("Enter your name (optional):")||"";
    try{
      const response=await fetch(SUPABASE_URL+"/functions/v1/mock-test-management?action=start-attempt",{
        method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({test_id:test.id,candidate_name:name}),credentials:"omit"
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"Could not start this test.");
      activeAttempt={...payload.attempt,token:payload.attempt_token,test_title:test.title,status:"in_progress"};
      sessionStorage.setItem("pixelforge_mock_attempt_"+activeAttempt.id,activeAttempt.token);
      const state=await candidateRequest("attempt-state",null,activeAttempt.token);
      activeQuestions=state.questions.map(q=>({...q,selected_option_index:q.selected_option_index}));
      currentQuestion=0;markedForReview=new Set();attemptResult=null;
      attemptPanel.hidden=false;attemptPanel.scrollIntoView({behavior:"smooth",block:"start"});
      renderAttempt();clearInterval(timerHandle);timerHandle=setInterval(showTimer,1000);
    }catch(error){alert(error.message);}
  }
  function renderTests(tests) {
    grid.replaceChildren();
    if (!tests.length) {
      const empty = el("div","mock-empty-state");
      empty.append(el("h3","","No tests published yet"),el("p","","New mock tests will appear here after they are published by the PixelForge team."));
      grid.append(empty);return;
    }
    tests.forEach(test => {
      const card=el("article","mock-test-card");
      const top=el("div","mock-test-card-top");top.append(el("span","mock-published-tag","PUBLISHED"));
      card.append(top,el("h3","",test.title),el("p","mock-test-description",test.description||"Read the instructions before starting."));
      const meta=el("div","mock-test-meta");
      meta.append(makeMeta("Duration",Math.round(test.duration_seconds/60)+" min"),makeMeta("Marks / question",String(test.marks_per_question)),makeMeta("Negative marks",String(test.negative_marks)));
      const instructions=el("details","mock-instructions");instructions.append(el("summary","","Read test instructions"),el("p","",test.instructions||"No additional instructions provided."));
      const start=el("button","mock-start-button","Start Test");start.type="button";start.addEventListener("click",()=>startTest(test));
      card.append(meta,instructions,start);grid.append(card);
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
