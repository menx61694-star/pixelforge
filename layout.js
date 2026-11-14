/* Admin-managed homepage section order, visibility and plain-text heading overrides. */
(() => {
  const allowed = new Set(["smart-document-search","discover","user-feedback","learning-corner","announcements","featured-resources","popular-resources","quick-tools","knowledge","daily-quiz","about","contact"]);
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET", headers: { "Accept": "application/json" }, credentials: "omit"
  }).then(response => { if (!response.ok) throw new Error("Homepage layout unavailable"); return response.json(); })
    .then(payload => {
      const config = payload.layout;
      if (!config || config.enabled !== true || !Array.isArray(config.sections)) return;
      const main = document.querySelector("main");
      if (!main) return;
      config.sections.filter(item => item && allowed.has(item.id)).forEach(item => {
        const section = document.getElementById(item.id);
        if (!section || section.parentElement !== main) return;
        section.classList.toggle("layout-hidden", item.enabled === false);
        if (typeof item.title === "string" && item.title.trim()) {
          const heading = section.querySelector("h2");
          if (heading) heading.textContent = item.title;
        }
        if (typeof item.subtitle === "string" && item.subtitle.trim()) {
          const subtitle = section.querySelector(".section-lead") ||
            section.querySelector(".smart-search-copy > p:last-child") ||
            section.querySelector(".daily-quiz-heading > p:last-child") ||
            section.querySelector(".contact-band div > p:not(.eyebrow)");
          if (subtitle) subtitle.textContent = item.subtitle;
        }
        main.append(section);
      });
    }).catch(() => { /* Keep the authored homepage order if layout settings cannot be loaded. */ });
})();
