# PixelForge Security Logs setup

Security logs retain visitor IP addresses for emergency and abuse investigations.

## 1. Generate a 256-bit encryption key

Run locally (do not paste the output into chat or commit it):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep the generated value in a password manager. Do not reuse the Supabase service-role key.

## 2. Configure the Supabase Edge Function secret

In Supabase Dashboard, open **Project Settings → Edge Functions → Secrets** (or the project's Edge Function secrets page) and add:

- Name: `ANALYTICS_IP_ENCRYPTION_KEY`
- Value: the generated Base64 key

The value must decode to exactly 32 bytes. Never add it to frontend JavaScript, Git, GitHub Pages, or a public environment variable.

**Important:** Keep this key stable and backed up securely. If it is lost or changed, existing encrypted IP addresses cannot be decrypted.

## 3. Apply the SQL migration

Run `supabase/phase-4-security-logs.sql` in the Supabase SQL Editor after configuring the secret. The migration:
- creates the security log and manual-deletion audit tables;
- enables RLS and denies direct access to public, anon and authenticated roles;
- grants table access only to service_role;
- grants the security log view/delete permissions to the admin role only;
- schedules daily deletion of visitor IP logs older than 90 days using pg_cron.

If the SQL editor reports that pg_cron cannot be enabled or scheduled, stop and resolve that database extension permission issue; do not claim automatic retention is active.

## 4. Deploy and verify

Deploy the updated `analytics` Edge Function. Then sign in as an admin and open **Security logs**. Verify a fresh public page visit creates a log with a decrypted IP visible only to an admin. Test manual deletion only after confirming that the current logs are disposable.

## Retention and access

- Automatic cleanup runs daily at 03:17 UTC and deletes records older than 90 days.
- Manual **Delete all logs** requires the `security.logs.delete` permission and an explicit confirmation.
- Manual deletion attempts are recorded in `pixel_forge_security_log_admin_actions` without storing visitor IP addresses.
- Security logs are separate from traffic analytics. Existing page-view counts, unique-session hashes, and location aggregates are unchanged.
