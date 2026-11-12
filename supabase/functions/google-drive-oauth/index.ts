import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  Deno.env.get("PIXELFORGE_ADMIN_ORIGIN") ?? "https://pixelforge.jo3.org",
  "http://localhost:8000",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status = 200, request?: Request) =>
  new Response(JSON.stringify(body), { status, headers: { ...(request ? corsHeaders(request) : {}), "Content-Type": "application/json" } });

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function encryptToken(token: string, secret: string): Promise<string> {
  const raw = fromBase64(secret);
  if (raw.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  // Copy into ArrayBuffer-backed views for strict Web Crypto BufferSource typing.
  const keyBuffer = new ArrayBuffer(32);
  new Uint8Array(keyBuffer).set(raw);
  const key = await crypto.subtle.importKey("raw", keyBuffer, "AES-GCM", false, ["encrypt"]);

  const ivBuffer = new ArrayBuffer(12);
  const iv = new Uint8Array(ivBuffer);
  crypto.getRandomValues(iv);

  const encodedToken = new TextEncoder().encode(token);
  const tokenBuffer = new ArrayBuffer(encodedToken.byteLength);
  new Uint8Array(tokenBuffer).set(encodedToken);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBuffer }, key, tokenBuffer);
  return `${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

async function verifyFirebaseAdmin(request: Request): Promise<boolean> {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(required("FIREBASE_WEB_API_KEY"))}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: match[1] }),
  });
  if (!response.ok) return false;
  const payload = await response.json();
  const account = payload.users?.[0];
  return account?.localId === required("PIXELFORGE_ADMIN_UID") && account.disabled !== true;
}

function supabaseAdmin() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const db = supabaseAdmin();

    if (action === "start") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed" }, 405, request);
      }
      const origin = request.headers.get("Origin") ?? "";
      if (!allowedOrigins.has(origin)) {
        return json({ error: "This PixelForge origin is not allowed to connect Google Drive." }, 403, request);
      }
      if (!(await verifyFirebaseAdmin(request))) {
        return json({ error: "Administrator authentication required" }, 401, request);
      }

      // Keep the state table bounded; expired states can no longer be consumed.
      const { error: cleanupError } = await db
        .from("google_drive_oauth_states")
        .delete()
        .lte("expires_at", new Date().toISOString());
      if (cleanupError) throw cleanupError;

      const stateBytes = crypto.getRandomValues(new Uint8Array(32));
      const state = base64Url(stateBytes);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await db.from("google_drive_oauth_states").insert({
        state_hash: await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state)).then((v) => base64Url(new Uint8Array(v))),
        expires_at: expiresAt,
        return_to: origin + "/admin.html",
      });
      if (error) throw error;

      const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      google.search = new URLSearchParams({
        client_id: required("GOOGLE_CLIENT_ID"),
        redirect_uri: `${required("SUPABASE_URL")}/functions/v1/google-drive-oauth`,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/drive.file",
        access_type: "offline",
        prompt: "consent",
        state,
      }).toString();
      return json({ authorization_url: google.toString() }, 200, request);
    }

    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, request);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const googleError = url.searchParams.get("error");
    if (googleError) return new Response("Google authorization was not completed. You may close this page.", { status: 400, headers: { ...corsHeaders(request), "Content-Type": "text/plain; charset=utf-8" } });
    if (!code || !state) return json({ error: "Missing OAuth code or state" }, 400, request);

    const stateHash = base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state))));
    const { data: returnTo, error: stateError } = await db.rpc(
      "consume_google_drive_oauth_state",
      { p_state_hash: stateHash },
    );

    if (stateError) throw stateError;

    if (!returnTo) {
      return json(
        { error: "OAuth state is invalid, expired, or already used. Start the connection again." },
        400,
        request,
      );
    }

    // Validate the persisted return destination before exchanging the one-time code.
    let destination: URL;
    try {
      destination = new URL(returnTo || required("PIXELFORGE_ADMIN_URL"));
    } catch {
      throw new Error("OAuth return destination is invalid");
    }
    if (
      !allowedOrigins.has(destination.origin) ||
      destination.pathname !== "/admin.html" ||
      destination.username !== "" ||
      destination.password !== ""
    ) {
      throw new Error("OAuth return destination is not allowed");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: required("GOOGLE_CLIENT_ID"),
        client_secret: required("GOOGLE_CLIENT_SECRET"),
        redirect_uri: `${required("SUPABASE_URL")}/functions/v1/google-drive-oauth`,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) return json({ error: "Google token exchange failed", details: tokens.error_description ?? tokens.error }, 400, request);
    if (!tokens.refresh_token) return json({ error: "Google did not return a refresh token. Revoke the app's access in Google Account permissions and reconnect." }, 400, request);

    const encrypted = await encryptToken(tokens.refresh_token, required("GOOGLE_TOKEN_ENCRYPTION_KEY"));
    const { error: saveError } = await db.from("google_drive_oauth_tokens").upsert({
      id: "pixelForge-owner",
      refresh_token_encrypted: encrypted,
      scope: tokens.scope ?? "https://www.googleapis.com/auth/drive.file",
      connected_at: new Date().toISOString(),
    });
    if (saveError) throw saveError;

    destination.searchParams.set("google_drive", "connected");
    return Response.redirect(destination.toString(), 303);
  } catch (error) {
    console.error("Google Drive OAuth error:", error);
    return json({ error: "OAuth request failed. Check Edge Function logs and configured secrets." }, 500, request);
  }
});
