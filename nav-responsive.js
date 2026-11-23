/* Responsive navigation: mobile uses the full menu; desktop only shows a More menu when links cannot fit. */
(() => {
  const header = document.querySelector(".site-header");
  const nav = header?.querySelector(".nav");
  const toggle = header?.querySelector(".menu-toggle");
  if (!header || !nav || !toggle) return;

  const originalLinks = Array.from(nav.querySelectorAll("a"));
  const mobile = window.matchMedia("(max-width: 760px)");
  const overflowBox = document.createElement("div");
  overflowBox.className = "nav-overflow-box";
  const overflowMenu = document.createElement("div");
  overflowMenu.className = "nav-overflow-menu";
  overflowMenu.hidden = true;
  header.appendChild(overflowBox);
  overflowBox.appendChild(overflowMenu);

  const reset = () => {
    originalLinks.forEach(link => nav.appendChild(link));
    overflowMenu.replaceChildren();
    nav.classList.remove("open", "nav-overflow-mode");
    overflowMenu.hidden = true;
    toggle.hidden = !mobile.matches;
    toggle.textContent = mobile.matches ? "☰" : "⋯";
    toggle.setAttribute("aria-label", mobile.matches ? "Toggle navigation" : "Show more navigation links");
    toggle.setAttribute("aria-expanded", "false");
  };

  const fitDesktop = () => {
    reset();
    if (mobile.matches) return;
    toggle.hidden = true;
    nav.classList.remove("open");
    const visibleLinks = originalLinks.filter(link => !link.hidden);
    const headerWidth = header.clientWidth;
    const brandWidth = header.querySelector(".brand")?.getBoundingClientRect().width || 0;
    const available = Math.max(0, headerWidth - brandWidth - 64);
    const navLinksWidth = visibleLinks.reduce((sum, link) => sum + link.getBoundingClientRect().width, 0);
    if (navLinksWidth <= available) return;

    toggle.hidden = false;
    toggle.textContent = "⋯";
    toggle.setAttribute("aria-label", "Show more navigation links");
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.add("nav-overflow-mode");
    const moreWidth = 60;
    let width = 0;
    const keep = Math.max(1, visibleLinks.length);
    for (let i = 0; i < visibleLinks.length; i++) width += visibleLinks[i].getBoundingClientRect().width;
    while (width + moreWidth > available && visibleLinks.length > 1) {
      const link = visibleLinks.pop();
      width -= link.getBoundingClientRect().width;
      link.classList.remove("active");
      overflowMenu.prepend(link);
    }
    overflowMenu.hidden = true;
    overflowBox.classList.toggle("has-overflow", overflowMenu.children.length > 0);
  };

  const apply = () => {
    reset();
    if (mobile.matches) return;
    fitDesktop();
  };

  toggle.addEventListener("click", () => {
    if (mobile.matches) {
      const opened = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(opened));
      return;
    }
    const opened = !overflowMenu.hidden;
    overflowMenu.hidden = opened;
    toggle.setAttribute("aria-expanded", String(!opened));
  });
  document.addEventListener("click", event => {
    if (!overflowBox.contains(event.target) && event.target !== toggle) {
      overflowMenu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });
  window.addEventListener("resize", apply, { passive: true });
  if (document.fonts?.ready) document.fonts.ready.then(apply);
  apply();
})();