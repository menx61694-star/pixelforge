(() => {
  const SUPABASE_URL = "https://zeueivmdzhkhonkyllij.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  const PUBLIC_BUCKET = "public-documents";
  function getVisitorSessionId() {
    const key = "pixelforge_analytics_session_v1";
    try {
      let id = sessionStorage.getItem(key);
      if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
      return id;
    } catch (_) { return null; }
  }
  fetch(SUPABASE_URL + "/functions/v1/analytics?action=collect", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pagePath: window.location.pathname || "/", visitorSessionId: getVisitorSessionId() }),
    keepalive: true, credentials: "omit"
  }).catch(() => {});
  const categories = [{"slug":"pdf-documents","name":"PDF Documents","desc":"Published PDF files and downloadable documents."},{"slug":"study-notes","name":"Study Notes","desc":"Organized notes and learning material."},{"slug":"books-resources","name":"Books & Resources","desc":"Helpful books, references and learning resources."},{"slug":"other-documents","name":"Other Documents","desc":"Additional public documents and useful files."},{"slug":"exam-materials","name":"Exam Materials","desc":"Exam-focused notes, practice material and preparation files."},{"slug":"technology-guides","name":"Technology Guides","desc":"Practical technology guides, tutorials and references."}];
  const root = document.querySelector("[data-library]");
  if (!root) return;
  const categorySlug = root.dataset.category || "all";
  const active = categories.find(item => item.slug === categorySlug);
  const title = document.getElementById("library-title");
  const description = document.getElementById("library-description");
  const heading = document.getElementById("documents-heading");
  const search = document.getElementById("library-search-input");
  const categoryFilter = document.getElementById("library-category-filter");
  const typeFilter = document.getElementById("library-type-filter");
  const searchFilters = document.getElementById("library-search-filters");
  const searchHint = document.getElementById("library-search-hint");
  const loadMoreButton = document.getElementById("library-load-more");
  const grid = document.getElementById("document-grid");
  const count = document.getElementById("library-count");
  const cards = document.getElementById("category-grid");
  const state = { documents: [], loading: false, searchConfig: { enabled: true, smartEnabled: true, filtersEnabled: true, maxResults: 30, placeholder: "Search documents, notes and guides…" }, visibleLimit: 30 };
  const params = new URLSearchParams(window.location.search);
  search.value = params.get("q") || "";
  if (categoryFilter) categoryFilter.value = params.get("category") || categorySlug;
  if (typeFilter) typeFilter.value = params.get("type") || "all";
  if (active) {
    title.textContent = active.name;
    description.textContent = active.desc;
    heading.textContent = active.name;
  }
  categories.forEach(item => {
    const a = document.createElement("a");
    a.className = "category-card" + (item.slug === categorySlug ? " active" : "");
    a.href = item.slug + ".html";
    const strong = document.createElement("strong");
    strong.textContent = item.name;
    const span = document.createElement("span");
    span.textContent = item.desc;
    a.append(strong, span);
    cards.append(a);
  });
  function showState(message, isError = false) {
    const p = document.createElement("p");
    p.className = "library-state" + (isError ? " error" : "");
    p.textContent = message;
    grid.replaceChildren(p);
    count.textContent = "";
  }
  function niceName(name) {
    return name.replace(/^5PcOkyDEcNc1puSeB2lQ6dLFVOF2-/, "").replace(/^\d{10,}-[0-9a-f-]{36}-/i, "").replace(/[-_]+/g, " ").replace(/\.(pdf|png|jpe?g)$/i, "");
  }
  function editDistanceAtMostOne(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return edits + ((i < a.length || j < b.length) ? 1 : 0) <= 1;
  }
  function searchScore(doc, query) {
    if (!query) return 0;
    const title = doc.title.toLowerCase(), category = doc.category.toLowerCase(), ext = doc.ext.toLowerCase();
    const full = title + " " + category + " " + ext;
    if (full.includes(query)) return title.includes(query) ? 100 : 70;
    if (!state.searchConfig.smartEnabled) return -1;
    const tokens = query.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) score += 20;
      else if (category.includes(token) || ext.includes(token)) score += 12;
      else {
        const candidates = title.split(/[^a-z0-9]+/).concat(category.split(/[^a-z0-9]+/));
        if (token.length >= 4 && candidates.some(word => word && editDistanceAtMostOne(word, token))) score += 7;
        else return -1;
      }
    }
    return score;
  }
  function render() {
    const q = search.value.trim().toLowerCase();
    const selectedCategory = categoryFilter && !categoryFilter.disabled ? categoryFilter.value : (active ? active.slug : "all");
    const selectedType = typeFilter ? typeFilter.value : "all";
    const ranked = state.documents.map(doc => ({ doc, score: searchScore(doc, q) }))
      .filter(item => item.score >= 0)
      .filter(({ doc }) => selectedCategory === "all" || doc.categorySlug === selectedCategory)
      .filter(({ doc }) => {
        const ext = doc.ext.toLowerCase();
        return selectedType === "all" ||
          (selectedType === "pdf" && ext === "pdf") ||
          (selectedType === "image" && ["png","jpg","jpeg","webp","gif"].includes(ext)) ||
          (selectedType === "other" && !["pdf","png","jpg","jpeg","webp","gif"].includes(ext));
      });
    if (q && state.searchConfig.smartEnabled) ranked.sort((a, b) => b.score - a.score);
    const docs = ranked.map(item => item.doc);
    count.textContent = docs.length + (docs.length === 1 ? " result" : " results") +
      (docs.length > state.visibleLimit ? " · showing " + state.visibleLimit : "");
    if (!docs.length) {
      if (loadMoreButton) loadMoreButton.hidden = true;
      return showState(q ? "No published documents match your search and filters. Try another keyword or remove a filter." : "No documents have been published in this section yet.");
    }
    grid.replaceChildren();
    docs.slice(0, state.visibleLimit).forEach(doc => {
      const card = document.createElement("article"); card.className = "document-card";
      const icon = document.createElement("span"); icon.className = "document-icon"; icon.textContent = doc.ext.toUpperCase();
      const h3 = document.createElement("h3"); h3.textContent = doc.title;
      const p = document.createElement("p"); p.textContent = doc.category + " · " + doc.size + (doc.source === "google_drive" ? " · Google Drive" : " · PixelForge Storage");
      const a = document.createElement("a"); a.href = doc.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Open document ↗";
      a.addEventListener("click", () => {
        if (!doc.resourceId || !["supabase","google_drive"].includes(doc.source)) return;
        try {
          let visitorId = sessionStorage.getItem("pf-resource-visitor");
          if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem("pf-resource-visitor", visitorId); }
          fetch(SUPABASE_URL + "/functions/v1/site-settings?action=track-resource", {
            method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", keepalive: true,
            body: JSON.stringify({ source: doc.source, resourceId: doc.resourceId, visitorId })
          }).catch(() => {});
        } catch (_) { /* Tracking is optional; never block opening a document. */ }
      });
      card.append(icon, h3, p, a); grid.append(card);
    });
    if (loadMoreButton) loadMoreButton.hidden = docs.length <= state.visibleLimit;
  }
  async function loadSearchConfig() {
    try {
      const response = await fetch(SUPABASE_URL + "/functions/v1/site-settings?action=public-content", { credentials: "omit" });
      if (!response.ok) throw new Error("Search settings unavailable");
      const payload = await response.json(), config = payload.search || {};
      state.searchConfig = {
        enabled: config.enabled === true, smartEnabled: config.smartEnabled !== false,
        filtersEnabled: config.filtersEnabled !== false,
        maxResults: Number.isInteger(config.maxResults) ? Math.min(100, Math.max(6, config.maxResults)) : 30,
        placeholder: typeof config.placeholder === "string" ? config.placeholder : "Search documents, notes and guides…"
      };
    } catch (_) { /* Keep local fallback settings if the public settings service is unavailable. */ }
    state.visibleLimit = state.searchConfig.maxResults;
    if (!state.searchConfig.enabled) {
      search.closest(".library-search").hidden = true;
      if (searchFilters) searchFilters.hidden = true;
      if (searchHint) searchHint.hidden = true;
      search.value = "";
    } else {
      search.placeholder = state.searchConfig.placeholder;
      if (searchFilters) searchFilters.hidden = !state.searchConfig.filtersEnabled;
      if (searchHint) searchHint.hidden = false;
    }
    if (categoryFilter && active) { categoryFilter.value = active.slug; categoryFilter.disabled = true; }
  }

  async function load() {
    await loadSearchConfig();
    if (!window.supabase || !window.supabase.createClient) {
      return showState("The document library service could not load. Please refresh later.", true);
    }
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const selected = active ? [active] : categories;
    try {
      showState("Loading published documents…");
      const results = await Promise.all(selected.map(async category => {
        const { data, error } = await client.storage.from(PUBLIC_BUCKET).list(category.slug, {
          limit: 100, offset: 0, sortBy: { column: "created_at", order: "desc" }
        });
        if (error) throw error;
        return (data || []).filter(file => file.name && !file.name.endsWith("/")).map(file => {
          const path = category.slug + "/" + file.name;
          const { data: publicData } = client.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
          const bytes = Number(file.metadata && file.metadata.size || 0);
          const size = bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
          const ext = (file.name.split(".").pop() || "FILE").slice(0, 4);
          return { title: niceName(file.name), category: category.name, categorySlug: category.slug, url: publicData.publicUrl, size, ext, source: "supabase", resourceId: path };
        });
      }));
      let driveDocs = [];
      try {
        const driveResponse = await fetch(SUPABASE_URL + "/functions/v1/google-drive-files?action=public-list");
        const drivePayload = await driveResponse.json();
        if (!driveResponse.ok) throw new Error(drivePayload.error || "Published Drive documents could not be loaded.");
        driveDocs = (drivePayload.documents || [])
          .filter(doc => selected.some(category => category.slug === doc.category))
          .map(doc => ({
            title: doc.title || "Google Drive document",
            category: categories.find(category => category.slug === doc.category)?.name || doc.category,
            categorySlug: doc.category,
            url: SUPABASE_URL + "/functions/v1/google-drive-files?action=public-download&id=" + encodeURIComponent(doc.drive_file_id),
            size: doc.size_bytes ? (doc.size_bytes >= 1048576 ? (doc.size_bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(doc.size_bytes / 1024)) + " KB") : "Size unavailable",
            ext: (doc.title || "").split(".").pop()?.slice(0, 4) || "FILE",
            source: "google_drive",
            resourceId: doc.drive_file_id
          }));
      } catch (driveError) {
        console.warn("Published Google Drive documents could not be loaded:", driveError);
      }
      state.documents = results.flat().concat(driveDocs);
      render();
    } catch (error) {
      showState("The public library is not connected yet. Admin-only files remain private. (" + (error.message || "Storage unavailable") + ")", true);
    }
  }
  search.addEventListener("input", () => { state.visibleLimit = state.searchConfig.maxResults; render(); });
  categoryFilter?.addEventListener("change", () => { state.visibleLimit = state.searchConfig.maxResults; render(); });
  typeFilter?.addEventListener("change", () => { state.visibleLimit = state.searchConfig.maxResults; render(); });
  loadMoreButton?.addEventListener("click", () => { state.visibleLimit += state.searchConfig.maxResults; render(); });
  load();
})();