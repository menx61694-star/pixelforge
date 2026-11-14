# PixelForge Analytics Geo Proxy Deployment

The public website is hosted separately from Supabase. Browser requests to Supabase cannot carry Cloudflare's visitor geo metadata, so page-view collection now uses a same-origin Cloudflare Worker route.

## Required secrets

Generate one strong random secret (at least 32 random bytes, represented as a long hex string) and configure the exact same value in both places:

- Cloudflare Worker secret: `PIXELFORGE_GEO_PROXY_SECRET`
- Supabase Edge Function secret: `PIXELFORGE_GEO_PROXY_SECRET`

Never put this secret in browser JavaScript, Git, or `wrangler.toml`.

## Cloudflare Worker

From `cloudflare/analytics-geo`:

1. Install Wrangler and authenticate to the Cloudflare account that manages the `jo3.org` zone.
2. Set the Worker secret with `wrangler secret put PIXELFORGE_GEO_PROXY_SECRET`.
3. Deploy with `wrangler deploy`.
4. Confirm the route `pixelforge.jo3.org/api/analytics*` is attached to the Worker. The route configuration assumes the Cloudflare zone is `jo3.org`; if the zone name differs, update `zone_name` before deployment.

## Supabase

Set the same secret in the Supabase project secrets, then deploy the updated `analytics` Edge Function. The Worker signs the Cloudflare country, region, client IP and timestamp; Supabase verifies the HMAC and rejects unsigned collection requests. Requests older than five minutes are rejected.

## Verification

1. Open the public homepage and Library from a normal browser session.
2. Generate fresh page views, then open Admin → Analytics.
3. Confirm country codes appear in Country & region. Region may be blank when Cloudflare does not provide it.
4. Confirm requests sent directly to the Supabase collect endpoint without a valid signature are rejected.
5. Existing analytics rows remain unchanged; location is available only for new events after both deployments.

The Worker forwards only allowlisted page paths and the anonymous tab-session identifier. It does not expose IP addresses to browser JavaScript or store raw IP in the analytics aggregate table.
