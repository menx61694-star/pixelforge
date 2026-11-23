/* Adaptive navigation: mobile hamburger; desktop overflow links move into More. */
(() => {
  const header=document.querySelector(".site-header"),nav=header?.querySelector(".nav"),toggle=header?.querySelector(".menu-toggle");
  if(!header||!nav||!toggle)return;
  const links=[...nav.querySelectorAll("a")],mobile=window.matchMedia("(max-width:760px)");
  const box=document.createElement("div");box.className="nav-overflow-box";
  const menu=document.createElement("div");menu.className="nav-overflow-menu";menu.hidden=true;
  header.append(box);box.append(menu);
  function reset(){links.forEach(a=>nav.append(a));menu.replaceChildren();nav.classList.remove("open","nav-overflow-mode");box.classList.remove("has-overflow");header.classList.remove("has-nav-overflow");menu.hidden=true;toggle.hidden=!mobile.matches;toggle.textContent=mobile.matches?"☰":"⋯";toggle.setAttribute("aria-label",mobile.matches?"Toggle navigation":"Show more navigation links");toggle.setAttribute("aria-expanded","false");}
  function layout(){reset();if(mobile.matches)return;toggle.hidden=true;const shown=links.filter(a=>!a.hidden);const available=header.clientWidth-(header.querySelector(".brand")?.getBoundingClientRect().width||0)-80;let total=shown.reduce((s,a)=>s+a.getBoundingClientRect().width,0);if(total<=available)return;toggle.hidden=false;toggle.textContent="⋯";nav.classList.add("nav-overflow-mode");while(total+60>available&&shown.length>1){const a=shown.pop();total-=a.getBoundingClientRect().width;menu.prepend(a);}const has=menu.children.length>0;box.classList.toggle("has-overflow",has);header.classList.toggle("has-nav-overflow",has);}
  toggle.addEventListener("click",()=>{if(mobile.matches){const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));return;}const open=menu.hidden;menu.hidden=!open;toggle.setAttribute("aria-expanded",String(open));});
  document.addEventListener("click",e=>{if(!box.contains(e.target)&&e.target!==toggle){menu.hidden=true;toggle.setAttribute("aria-expanded","false");}});
  window.addEventListener("resize",layout,{passive:true});if(document.fonts?.ready)document.fonts.ready.then(layout);layout();
})();