function getPixelForgeVisitorSessionId() {
  const key = "pixelforge_analytics_session_v1";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch (_) {
    return null;
  }
}
function trackPixelForgePageView() {
  const endpoint = "https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/analytics?action=collect";
  const pagePath = window.location.pathname || "/";
  const visitorSessionId = getPixelForgeVisitorSessionId();
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pagePath, visitorSessionId }),
    keepalive: true,
    credentials: "omit"
  }).catch(() => {});
}
trackPixelForgePageView();
const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.nav');if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));}const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();

async function getPixelForgePrivateLocalIp() {
  if (!window.RTCPeerConnection) return null;
  const pc = new RTCPeerConnection({ iceServers: [] });
  return await new Promise(async resolve => {
    let settled = false;
    let timer;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.onicecandidate = null;
      pc.close();
      resolve(value);
    };
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const tokens = event.candidate.candidate.split(/\s+/);
      const candidateIp = tokens.find(token =>
        /^(?:\d{1,3}\.){3}\d{1,3}$/.test(token) ||
        /^[0-9a-f:]{3,}$/i.test(token)
      );
      if (candidateIp && isPixelForgePrivateIp(candidateIp)) finish(candidateIp);
    };
    timer = setTimeout(() => finish(null), 3000);
    try {
      pc.createDataChannel("pixelforge-local-ip-check");
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.iceGatheringState === "complete") finish(null);
    } catch (_) {
      finish(null);
    }
  });
}
function isPixelForgePrivateIp(ip) {
  const parts = ip.split(".");
  if (parts.length === 4 && parts.every(part => /^\\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [a,b] = parts.map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  const lower = ip.toLowerCase();
  return ip.includes(":") && /^[0-9a-f:]+$/i.test(ip) &&
    (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") ||
     lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb"));
}
const localIpDiagnosticButton = document.getElementById("local-ip-diagnostic-button");
const localIpDiagnosticStatus = document.getElementById("local-ip-diagnostic-status");
if (localIpDiagnosticButton && localIpDiagnosticStatus) {
  localIpDiagnosticButton.addEventListener("click", async () => {
    if (!window.confirm("Consent to check whether this browser exposes a private LAN IP through WebRTC and send any detected address to PixelForge Security Logs? It will be encrypted and retained for up to 90 days. Browsers may hide it; no address is sent if none is exposed.")) return;
    localIpDiagnosticButton.disabled = true;
    localIpDiagnosticStatus.textContent = "Checking browser network candidates…";
    const localIp = await getPixelForgePrivateLocalIp();
    if (!localIp) {
      localIpDiagnosticStatus.textContent = "No private LAN IP was exposed by this browser. Nothing was sent.";
      localIpDiagnosticButton.disabled = false;
      return;
    }
    try {
      const response = await fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/analytics?action=local-ip-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagePath: window.location.pathname || "/", localIp, consent: true }),
        credentials: "omit"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit the diagnostic.");
      localIpDiagnosticStatus.textContent = "Browser-reported local IP was sent over HTTPS and encrypted for the restricted Security Logs.";
    } catch (error) {
      localIpDiagnosticStatus.textContent = error.message || "Local IP diagnostic failed.";
    } finally {
      localIpDiagnosticButton.disabled = false;
    }
  });
}

/* Admin-managed public knowledge cards. The browser only receives the
   explicitly public allow-listed settings from the site-settings endpoint. */
(() => {
  const factText = document.getElementById("fact-text");
  const refresh = document.getElementById("refresh-fact");
  if (!factText || !refresh) return;
  const defaults = [
    { category: "SPACE", text: "A day on Venus is longer than its year: Venus takes about 243 Earth days to rotate once, but only about 225 Earth days to orbit the Sun." },
    { category: "HUMAN BODY", text: "Your brain uses roughly 20% of your body's energy, even though it makes up only about 2% of your body weight." },
    { category: "OCEANS", text: "The ocean contains underwater mountains and volcanoes; the global mid-ocean ridge system stretches for around 65,000 kilometres." },
    { category: "COMPUTING", text: "The first computer mouse, built in the 1960s, was made of wood and had just one button." },
    { category: "NATURE", text: "Octopuses have three hearts: two pump blood to the gills, while one pumps it to the rest of the body." },
    { category: "MATHEMATICS", text: "A googol is the number 1 followed by 100 zeroes. It is much larger than the number of atoms estimated in the observable universe." },
    { category: "SPACE", text: "Light from the Sun takes about 8 minutes and 20 seconds to reach Earth." },
    { category: "ANIMALS", text: "A group of flamingos is called a flamboyance." },
    { category: "TECHNOLOGY", text: "The word 'robot' comes from the Czech word 'robota', which refers to forced labour." },
    { category: "EARTH", text: "Earth is not a perfect sphere; its rotation makes it slightly wider around the equator than from pole to pole." },
    { category: "BIOLOGY", text: "A single human cell contains about two metres of DNA when stretched out." },
    { category: "INVENTION", text: "The microwave oven was developed after an engineer noticed that a chocolate bar had melted near radar equipment." }
  ];
  let facts = defaults.slice();
  let lastIndex = -1;
  let shown = 0;
  const category = document.getElementById("fact-category");
  const count = document.getElementById("knowledge-count");
  function showNext() {
    if (!facts.length) return;
    let next = 0;
    if (facts.length > 1) {
      do { next = Math.floor(Math.random() * facts.length); } while (next === lastIndex);
    }
    lastIndex = next;
    shown += 1;
    factText.textContent = facts[next].text;
    if (category) category.textContent = String(facts[next].category || "QUICK KNOWLEDGE").slice(0, 32).toUpperCase();
    if (count) count.textContent = "Discovery " + shown.toString().padStart(2, "0");
  }
  refresh.addEventListener("click", showNext);
  showNext();
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET", headers: { "Accept": "application/json" }, credentials: "omit"
  }).then(response => {
    if (!response.ok) throw new Error("Public content unavailable");
    return response.json();
  }).then(payload => {
    if (payload.site && typeof payload.site.name === "string" && payload.site.name.trim()) {
      document.querySelectorAll(".brand span:last-child").forEach(node => { node.textContent = payload.site.name; });
      document.title = payload.site.name + " — Explore. Learn. Create.";
    }
    if (payload.site && typeof payload.site.description === "string") {
      const description = document.querySelector('meta[name="description"]');
      if (description && payload.site.description.trim()) description.setAttribute("content", payload.site.description);
    }
    if (payload.knowledge && payload.knowledge.enabled === true &&
        Array.isArray(payload.knowledge.items) && payload.knowledge.items.length) {
      facts = payload.knowledge.items.filter(item => item && typeof item.text === "string" && item.text.trim())
        .map(item => ({ category: String(item.category || "QUICK KNOWLEDGE"), text: item.text }));
      lastIndex = -1;
      showNext();
    } else if (payload.knowledge && payload.knowledge.enabled === false) {
      const section = document.getElementById("knowledge");
      if (section) section.hidden = true;
    }
  }).catch(() => {
    // Keep the built-in fact collection available if the settings service is offline.
  });
})();


/* Daily Quiz: public question payload never includes the answer key. */
(() => {
  const section = document.getElementById("daily-quiz");
  const form = document.getElementById("daily-quiz-form");
  if (!section || !form) return;
  const questionNode = document.getElementById("daily-quiz-question");
  const optionsNode = document.getElementById("daily-quiz-options");
  const submit = document.getElementById("daily-quiz-submit");
  const result = document.getElementById("daily-quiz-result");
  const category = document.getElementById("daily-quiz-category");
  const dateNode = document.getElementById("daily-quiz-date");
  let question = null;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET", headers: { "Accept": "application/json" }, credentials: "omit"
  }).then(response => {
    if (!response.ok) throw new Error("Quiz unavailable");
    return response.json();
  }).then(payload => {
    question = payload.quiz && payload.quiz.enabled === true ? payload.quiz.question : null;
    if (!question) return;
    section.hidden = false;
    questionNode.textContent = question.question;
    category.textContent = String(question.category || "DAILY QUIZ").toUpperCase();
    dateNode.textContent = today;
    optionsNode.replaceChildren();
    question.options.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "daily-quiz-option";
      const input = document.createElement("input");
      input.type = "radio"; input.name = "daily-quiz-answer"; input.value = String(index); input.required = true;
      const text = document.createElement("span"); text.textContent = option;
      label.append(input, text); optionsNode.append(label);
    });
    submit.disabled = false;
  }).catch(() => { section.hidden = true; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!question) return;
    const selected = form.querySelector('input[name="daily-quiz-answer"]:checked');
    if (!selected) { result.textContent = "Choose an option first."; return; }
    submit.disabled = true;
    result.className = "daily-quiz-result";
    result.textContent = "Checking your answer…";
    try {
      const response = await fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=quiz-answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ questionId: question.id, selectedIndex: Number(selected.value) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not check your answer.");
      result.className = "daily-quiz-result " + (payload.correct ? "is-correct" : "is-wrong");
      result.textContent = (payload.correct ? "Correct! Score: 1/1. " : "Not quite. Score: 0/1. ") + (payload.explanation || "");
      optionsNode.querySelectorAll("input").forEach(input => { input.disabled = true; });
      submit.textContent = "Answer submitted";
    } catch (error) {
      result.textContent = error.message || "Could not check your answer.";
      submit.disabled = false;
    }
  });
})();

/* Admin-managed Quick Tools catalogue. */
(() => {
  const section = document.getElementById("quick-tools");
  const grid = document.getElementById("quick-tools-grid");
  if (!section || !grid) return;
  const navLinks = document.querySelectorAll("[data-quick-tools-nav]");
  const catalogue = {
    calculator: { title: "Basic Calculator", description: "Quick arithmetic for everyday calculations.", symbol: "＋", href: "tools.html#calculator", label: "Calculate" },
    percentage: { title: "Percentage Calculator", description: "Find percentages and percentage values.", symbol: "%", href: "tools.html#percentage", label: "Calculate" },
    "word-counter": { title: "Word Counter", description: "Count words, characters and reading time.", symbol: "Aa", href: "tools.html#word-counter", label: "Count words" },
    "unit-converter": { title: "Length Converter", description: "Convert metres, kilometres, centimetres and more.", symbol: "↔", href: "tools.html#unit-converter", label: "Convert" }
  };
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET", headers: { "Accept": "application/json" }, credentials: "omit"
  }).then(response => { if (!response.ok) throw new Error("Quick Tools unavailable"); return response.json(); })
    .then(payload => {
      const config = payload.quickTools;
      if (!config || config.enabled !== true || !Array.isArray(config.items)) {
        navLinks.forEach(link => { link.hidden = true; });
        return;
      }
      const enabledItems = config.items.filter(id => Object.prototype.hasOwnProperty.call(catalogue, id));
      if (!enabledItems.length) { navLinks.forEach(link => { link.hidden = true; }); return; }
      navLinks.forEach(link => { link.hidden = false; });
      enabledItems.forEach(id => {
        const item = catalogue[id], card = document.createElement("a");
        card.className = "quick-tool-card"; card.href = item.href;
        const symbol = document.createElement("span"); symbol.className = "quick-tool-symbol"; symbol.textContent = item.symbol;
        const title = document.createElement("strong"); title.textContent = item.title;
        const description = document.createElement("p"); description.textContent = item.description;
        const action = document.createElement("span"); action.className = "quick-tool-action"; action.textContent = item.label + " ↗";
        card.append(symbol, title, description, action); grid.append(card);
      });
      if (grid.children.length) section.hidden = false;
    }).catch(() => { section.hidden = true; });
})();


/* Admin-curated Featured Resources. All content is rendered as text and HTTPS links. */
(() => {
  const section = document.getElementById("featured-resources");
  const grid = document.getElementById("featured-resources-grid");
  if (!section || !grid) return;
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET", headers: { "Accept": "application/json" }, credentials: "omit"
  }).then(response => { if (!response.ok) throw new Error("Featured resources unavailable"); return response.json(); })
    .then(payload => {
      const config = payload.featuredResources;
      if (!config || config.enabled !== true || !Array.isArray(config.items)) return;
      config.items.filter(item => item && item.published === true &&
        typeof item.title === "string" && typeof item.url === "string" && item.url.startsWith("https://")
      ).slice(0, 12).forEach(item => {
        const card = document.createElement("article"); card.className = "featured-resource-card";
        const category = document.createElement("span"); category.className = "featured-resource-category"; category.textContent = String(item.category || "RESOURCE");
        const title = document.createElement("h3"); title.textContent = item.title;
        const description = document.createElement("p"); description.textContent = String(item.description || "");
        const link = document.createElement("a"); link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = String(item.label || "Explore resource") + " ↗";
        card.append(category, title, description, link); grid.append(card);
      });
      if (grid.children.length) section.hidden = false;
    }).catch(() => { section.hidden = true; });
})();


/* Admin-managed announcements; only currently active published notices are returned. */
(() => {
  const section = document.getElementById("announcements");
  const list = document.getElementById("announcements-list");
  if (!section || !list) return;
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET", headers: { "Accept": "application/json" }, credentials: "omit"
  }).then(response => { if (!response.ok) throw new Error("Announcements unavailable"); return response.json(); })
    .then(payload => {
      const config = payload.announcements;
      if (!config || config.enabled !== true || !Array.isArray(config.items)) return;
      config.items.slice(0, 20).forEach(item => {
        const card = document.createElement("article"); card.className = "announcement-card announcement-" + item.type;
        const type = document.createElement("span"); type.className = "announcement-type"; type.textContent = String(item.type || "INFO").toUpperCase();
        const title = document.createElement("h3"); title.textContent = item.title;
        const message = document.createElement("p"); message.textContent = item.message;
        const dates = document.createElement("small"); dates.className = "announcement-dates";
        dates.textContent = item.startDate === item.endDate ? item.startDate : item.startDate + " – " + item.endDate;
        card.append(type, title, message, dates);
        if (typeof item.url === "string" && item.url.startsWith("https://") && typeof item.label === "string" && item.label) {
          const link = document.createElement("a"); link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = item.label + " ↗"; card.append(link);
        }
        list.append(card);
      });
      if (list.children.length) section.hidden = false;
    }).catch(() => { section.hidden = true; });
})();
