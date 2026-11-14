const SUPABASE_ANALYTICS_URL = "https://zeueivmdzhkhonkyllij.supabase.co/functions/v1/analytics?action=collect";
const ALLOWED_ORIGIN = "https://pixelforge.jo3.org";

async function sign(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Vary": "Origin"
    };
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

    let input;
    try { input = await request.json(); } catch (_) {
      return new Response("Invalid JSON", { status: 400, headers: cors });
    }
    const paths = ["/", "/index.html", "/library.html", "/pdf-documents.html", "/study-notes.html", "/books-resources.html", "/other-documents.html", "/exam-materials.html", "/technology-guides.html"];
    if (!input || !paths.includes(input.pagePath) ||
        (input.visitorSessionId && (typeof input.visitorSessionId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.visitorSessionId)))) {
      return new Response("Invalid analytics event", { status: 400, headers: cors });
    }

    const cf = request.cf || {};
    const country = typeof cf.country === "string" && /^[A-Z]{2}$/.test(cf.country) ? cf.country : "";
    const region = typeof cf.region === "string" ? cf.region.trim().slice(0, 80).replace(/[\r\n]/g, "") : "";
    const clientIp = request.headers.get("CF-Connecting-IP") || "";
    if (!clientIp || clientIp.length > 64 || !/^[0-9a-f:.]+$/i.test(clientIp)) {
      return new Response("Trusted client IP unavailable", { status: 503, headers: cors });
    }
    const timestamp = String(Date.now());
    const message = [timestamp, country, region, clientIp].join("\n");
    const signature = await sign(env.PIXELFORGE_GEO_PROXY_SECRET, message);
    const upstream = await fetch(SUPABASE_ANALYTICS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": origin,
        "x-pf-geo-timestamp": timestamp,
        "x-pf-geo-country": country,
        "x-pf-geo-region": region,
        "x-pf-geo-client-ip": clientIp,
        "x-pf-geo-signature": signature
      },
      body: JSON.stringify(input)
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...cors, "Content-Type": upstream.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" }
    });
  }
};
