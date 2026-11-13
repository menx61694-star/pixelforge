(() => {
  "use strict";
  const endpoint = "https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/site-settings?action=public-status";
  function renderMaintenance(message) {
    if (document.getElementById("pixelforge-maintenance-screen")) return;
    const style = document.createElement("style");
    style.textContent = `
      #pixelforge-maintenance-screen{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#101d49,#263d7b);color:#fff;text-align:center;font-family:'DM Sans',Arial,sans-serif}
      #pixelforge-maintenance-screen .maintenance-card{width:min(100%,560px);padding:clamp(28px,6vw,54px);border:1px solid #ffffff30;border-radius:22px;background:#ffffff12;box-shadow:0 24px 80px #050d2866;backdrop-filter:blur(12px)}
      #pixelforge-maintenance-screen .maintenance-mark{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 24px;border-radius:15px;background:#ff861c;color:#101d49;font-size:30px;font-weight:800}
      #pixelforge-maintenance-screen h1{margin:0 0 14px;font-size:clamp(28px,5vw,42px);letter-spacing:-.04em}
      #pixelforge-maintenance-screen p{margin:0;color:#e0e7f5;font-size:15px;line-height:1.8;overflow-wrap:anywhere}
      #pixelforge-maintenance-screen .maintenance-note{margin-top:24px;color:#ffbd7b;font-size:11px;font-weight:800;letter-spacing:.14em}
    `;
    const screen = document.createElement("section");
    screen.id = "pixelforge-maintenance-screen";
    screen.setAttribute("role", "status");
    screen.setAttribute("aria-live", "polite");
    const card = document.createElement("div");
    card.className = "maintenance-card";
    const mark = document.createElement("div");
    mark.className = "maintenance-mark";
    mark.textContent = "P";
    const heading = document.createElement("h1");
    heading.textContent = "We'll be back soon";
    const body = document.createElement("p");
    body.textContent = message;
    const note = document.createElement("div");
    note.className = "maintenance-note";
    note.textContent = "PIXELFORGE · SCHEDULED MAINTENANCE";
    card.append(mark, heading, body, note);
    screen.append(card);
    document.head.append(style);
    document.body.append(screen);
    document.body.style.overflow = "hidden";
  }
  fetch(endpoint, { method: "GET", cache: "no-store", credentials: "omit", headers: { "Accept": "application/json" } })
    .then(response => {
      if (!response.ok) throw new Error("Public site status unavailable");
      return response.json();
    })
    .then(data => {
      if (data && data.maintenance === true) {
        const message = typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : "We are performing scheduled maintenance. Please check back soon.";
        renderMaintenance(message);
      }
    })
    .catch(() => {
      // Fail open: a status-service outage must never take the public site offline.
    });
})();
