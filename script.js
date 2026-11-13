function trackPixelForgePageView() {
  const endpoint = "https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/analytics?action=collect";
  const pagePath = window.location.pathname || "/";
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pagePath }),
    keepalive: true,
    credentials: "omit"
  }).catch(() => {});
}
const toggle=document.querySelector('.menu-toggle');const nav=document.querySelector('.nav');if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}));}const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();