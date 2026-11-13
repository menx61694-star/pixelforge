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