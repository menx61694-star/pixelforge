(() => {
  const SUPABASE_URL = "https://zeueivmdzhkhonkyllij.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_sTs9Niej0BbWOw1vITV_jA_utoWwsw3";
  const PUBLIC_BUCKET = "public-documents";
  const categories = [{"slug":"pdf-documents","name":"PDF Documents","desc":"Published PDF files and downloadable documents."},{"slug":"study-notes","name":"Study Notes","desc":"Organized notes and learning material."},{"slug":"books-resources","name":"Books & Resources","desc":"Helpful books, references and learning resources."},{"slug":"other-documents","name":"Other Documents","desc":"Additional public documents and useful files."},{"slug":"exam-materials","name":"Exam Materials","desc":"Exam-focused notes, practice material and preparation files."},{"slug":"technology-guides","name":"Technology Guides","desc":"Practical technology guides, tutorials and references."}];
  const root = document.querySelector("[data-library]");
  if (!root) return;
  const categorySlug = root.dataset.category || "all";
  const active = categories.find(item => item.slug === categorySlug);
  const title = document.getElementById("library-title");
  const description = document.getElementById("library-description");
  const heading = document.getElementById("documents-heading");
  const search = document.getElementById("library-search-input");
  const grid = document.getElementById("document-grid");
  const count = document.getElementById("library-count");
  const cards = document.getElementById("category-grid");
  const state = { documents: [], loading: false };
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
  function render() {
    const q = search.value.trim().toLowerCase();
    const docs = state.documents.filter(doc => (doc.title + " " + doc.category).toLowerCase().includes(q));
    count.textContent = docs.length + (docs.length === 1 ? " document" : " documents");
    if (!docs.length) return showState(q ? "No published documents match your search." : "No documents have been published in this section yet.");
    grid.replaceChildren();
    docs.forEach(doc => {
      const card = document.createElement("article");
      card.className = "document-card";
      const icon = document.createElement("span");
      icon.className = "document-icon";
      icon.textContent = doc.ext.toUpperCase();
      const h3 = document.createElement("h3");
      h3.textContent = doc.title;
      const p = document.createElement("p");
      p.textContent = doc.category + " · " + doc.size + (doc.source === "google_drive" ? " · Google Drive" : " · PixelForge Storage");
      const a = document.createElement("a");
      a.href = doc.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Open document ↗";
      card.append(icon, h3, p, a);
      grid.append(card);
    });
  }
  async function load() {
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
          return { title: niceName(file.name), category: category.name, url: publicData.publicUrl, size, ext, source: "supabase" };
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
            url: SUPABASE_URL + "/functions/v1/google-drive-files?action=public-download&id=" + encodeURIComponent(doc.drive_file_id),
            size: doc.size_bytes ? (doc.size_bytes >= 1048576 ? (doc.size_bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(doc.size_bytes / 1024)) + " KB") : "Size unavailable",
            ext: (doc.title || "").split(".").pop()?.slice(0, 4) || "FILE",
            source: "google_drive"
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
  search.addEventListener("input", render);
  load();
})();