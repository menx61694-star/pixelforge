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
  const endpoint = "/api/analytics";
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

async function getPixelForgePrivateLocalIp() {
  if (!window.RTCPeerConnection) return null;
  const pc = new RTCPeerConnection({ iceServers: [] });
  return await new Promise(async resolve => {
    let settled = false;
    let timer;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.onicecandidate = null;
      pc.close();
      resolve(value);
    };
    pc.onicecandidate = event => {
      if (!event.candidate) return;
      const tokens = event.candidate.candidate.split(/\s+/);
      const candidateIp = tokens.find(token =>
        /^(?:\d{1,3}\.){3}\d{1,3}$/.test(token) ||
        /^[0-9a-f:]{3,}$/i.test(token)
      );
      if (candidateIp && isPixelForgePrivateIp(candidateIp)) finish(candidateIp);
    };
    timer = setTimeout(() => finish(null), 3000);
    try {
      pc.createDataChannel("pixelforge-local-ip-check");
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.iceGatheringState === "complete") finish(null);
    } catch (_) {
      finish(null);
    }
  });
}
function isPixelForgePrivateIp(ip) {
  const parts = ip.split(".");
  if (parts.length === 4 && parts.every(part => /^\\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [a,b] = parts.map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  const lower = ip.toLowerCase();
  return ip.includes(":") && /^[0-9a-f:]+$/i.test(ip) &&
    (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") ||
     lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb"));
}
const localIpDiagnosticButton = document.getElementById("local-ip-diagnostic-button");
const localIpDiagnosticStatus = document.getElementById("local-ip-diagnostic-status");
if (localIpDiagnosticButton && localIpDiagnosticStatus) {
  localIpDiagnosticButton.addEventListener("click", async () => {
    if (!window.confirm("Consent to check whether this browser exposes a private LAN IP through WebRTC and send any detected address to PixelForge Security Logs? It will be encrypted and retained for up to 90 days. Browsers may hide it; no address is sent if none is exposed.")) return;
    localIpDiagnosticButton.disabled = true;
    localIpDiagnosticStatus.textContent = "Checking browser network candidates…";
    const localIp = await getPixelForgePrivateLocalIp();
    if (!localIp) {
      localIpDiagnosticStatus.textContent = "No private LAN IP was exposed by this browser. Nothing was sent.";
      localIpDiagnosticButton.disabled = false;
      return;
    }
    try {
      const response = await fetch("https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/analytics?action=local-ip-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagePath: window.location.pathname || "/", localIp, consent: true }),
        credentials: "omit"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit the diagnostic.");
      localIpDiagnosticStatus.textContent = "Browser-reported local IP was sent over HTTPS and encrypted for the restricted Security Logs.";
    } catch (error) {
      localIpDiagnosticStatus.textContent = error.message || "Local IP diagnostic failed.";
    } finally {
      localIpDiagnosticButton.disabled = false;
    }
  });
}
