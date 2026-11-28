# Phase 27 — Student signup security setup

This phase adds mandatory Firebase email verification, Cloudflare Turnstile anti-bot checks, disposable-email domain blocking, and server-side signup rate limiting.

## 1. Create a Cloudflare Turnstile widget

1. In Cloudflare Dashboard, open Turnstile and create a widget for `pixelforge.jo3.org`.
2. Use the Managed widget mode.
3. Copy its **site key** and **secret key**.

In `student-auth.js`, replace `YOUR_CLOUDFLARE_TURNSTILE_SITE_KEY` with the site key. The site key is public and belongs in the browser.

## 2. Configure Supabase Edge Function secrets

Set these secrets for the existing Supabase project:

- `TURNSTILE_SECRET_KEY`: the Turnstile secret key from Cloudflare.
- `STUDENT_RATE_LIMIT_HASH_SECRET`: a new, random secret of at least 32 bytes. Do not reuse Firebase, Supabase, or any other application secret.

Example generation command (run locally; do not commit the output):

```bash
openssl rand -hex 32
```

Set both secrets using the Supabase Dashboard Edge Function secrets page or the Supabase CLI.

## 3. Apply the database migration

Run `supabase/phase-27-student-signup-protection.sql` in the Supabase SQL Editor after `phase-26-student-accounts.sql`.

The migration creates a service-role-only rate-limit table and an atomic RPC. It limits verified student profile registrations to 5 attempts per IP per hour and 3 attempts per email per hour.

## 4. Deploy

Merge the code PR, then deploy the `user-management` Edge Function. The existing GitHub Actions workflow deploys that function on a push to `main`.

## 5. Verification checklist

- New account signup sends Firebase email verification.
- Unverified accounts cannot create a student profile or open the dashboard.
- Turnstile must pass before Firebase account creation and again before a new verified profile is registered.
- Common disposable email domains are rejected server-side.
- Rate limits return HTTP 429 after the configured thresholds.
- Existing active students can sign in without creating duplicate profiles.
- Admin/Editor/Viewer role registry remains unchanged.
- Verify a real signup, email link, login, Admin Students list, and suspended-account rejection in production before announcing launch.

**Important:** Until the real Turnstile site key and secret are configured and the SQL migration is applied, new student registration intentionally remains unavailable.