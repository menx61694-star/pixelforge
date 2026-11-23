/* Keep the Quick Tools navigation item consistent on secondary pages. */
(() => {
  const links = document.querySelectorAll("[data-quick-tools-nav]");
  if (!links.length) return;
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET",
    headers: { "Accept": "application/json" },
    credentials: "omit"
  })
    .then(response => {
      if (!response.ok) throw new Error("Quick Tools settings unavailable");
      return response.json();
    })
    .then(payload => {
      const config = payload.quickTools;
      const enabled = Boolean(config && config.enabled === true && Array.isArray(config.items) && config.items.length);
      links.forEach(link => { link.hidden = !enabled; });
    })
    .catch(() => links.forEach(link => { link.hidden = true; }));
})();
