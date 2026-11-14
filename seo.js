/* Dynamic, admin-managed SEO metadata for public PixelForge pages. */
(() => {
  fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-content", {
    method: "GET", headers: { "Accept": "application/json" }, credentials: "omit"
  }).then(response => { if (!response.ok) throw new Error("SEO settings unavailable"); return response.json(); })
    .then(payload => {
      const config = payload.seo;
      if (!config || config.enabled !== true) return;
      const path = window.location.pathname.replace(/\/+$/, "") || "/";
      const overrides = Array.isArray(config.pageOverrides) ? config.pageOverrides : [];
      const page = overrides.find(item => item && item.page === path);
      const title = page && page.title ? page.title : config.defaultTitle;
      const description = page && page.description ? page.description : config.defaultDescription;
      const keywords = page && typeof page.keywords === "string" ? page.keywords : config.defaultKeywords;
      const robots = page && page.robots ? page.robots : "index,follow";
      const setMeta = (key, value, property = false) => {
        if (typeof value !== "string" || !value) return;
        const selector = property ? 'meta[property="' + key + '"]' : 'meta[name="' + key + '"]';
        let node = document.head.querySelector(selector);
        if (!node) { node = document.createElement("meta"); node.setAttribute(property ? "property" : "name", key); document.head.append(node); }
        node.setAttribute("content", value);
      };
      if (title) document.title = title;
      setMeta("description", description);
      setMeta("keywords", keywords);
      setMeta("robots", robots);
      setMeta("og:title", title, true);
      setMeta("og:description", description, true);
      setMeta("og:type", "website", true);
      if (config.ogImage && /^https:\/\//i.test(config.ogImage)) setMeta("og:image", config.ogImage, true);
      setMeta("twitter:card", "summary_large_image");
      setMeta("twitter:title", title);
      setMeta("twitter:description", description);
      if (config.ogImage && /^https:\/\//i.test(config.ogImage)) setMeta("twitter:image", config.ogImage);
      try {
        const canonicalBase = typeof config.canonicalBase === "string" && config.canonicalBase ? config.canonicalBase : window.location.origin;
        const canonicalUrl = page && page.canonical ? page.canonical : new URL(path, canonicalBase).toString();
        let canonical = document.head.querySelector('link[rel="canonical"]');
        if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.append(canonical); }
        canonical.href = canonicalUrl;
        setMeta("og:url", canonicalUrl, true);
      } catch (_) { /* Keep static canonical metadata if the configured URL is invalid. */ }
    }).catch(() => { /* Static HTML metadata remains the fallback. */ });
})();
