# PixelForge Phase 2 — Users & Roles deployment

This phase introduces a Firebase-identity-backed role registry in Supabase. The browser never writes role records directly; the user-management Edge Function performs role changes after verifying the current Firebase administrator.

## Role model

- **Admin:** user management, permission matrix, full vault and Drive permissions.
- **Editor:** own private-vault read/upload/publish, Drive read/upload; no user management or delete by default.
- **Viewer:** read-only access to their own private vault and the connected Drive listing.

The owner UID `5PcOkyDEcNc1puSeB2lQ6dLFVOF2` is seeded as Admin and protected from demotion or suspension. Private storage objects are isolated under each Firebase UID folder. Public library objects retain public read access; writes are restricted to each user's own UID-prefixed object names.

## Required deployment order

1. Confirm Firebase Authentication has the Email/Password provider enabled.
2. Review and run `supabase/phase-2-users-roles.sql` in the Supabase SQL Editor. It expects the existing storage policies created by `supabase-storage-policies.sql` and `supabase-public-storage-policies.sql`.
3. Deploy the updated functions:
   ```sh
   supabase functions deploy user-management
   supabase functions deploy google-drive-files
   ```
4. Confirm the existing Edge Function secrets remain configured: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_WEB_API_KEY`, and the Google Drive secrets already used by the Drive function.
5. Deploy the static website from the reviewed pull request only after the SQL migration and Edge Functions are live.

No new service-account JSON or Firebase Admin private key is required. User creation uses a secondary Firebase client app to create the Auth account, then calls the protected Edge Function to assign a role and sends a password-reset email.

## Verification checklist

- Existing owner can sign in and is the immutable Admin.
- New user is created in Firebase Auth and receives a password-reset email.
- A role record is created only after Firebase UID/email validation.
- Admin can change roles, suspend/reactivate users, and update the permission matrix.
- Suspended users cannot establish an active admin session or pass storage/Drive authorization.
- Viewer cannot upload, publish, delete, manage users, or perform Drive writes/deletes.
- Editor cannot delete private files or Drive files by default.
- Users can list/download only their own private-vault folder.
- Public library remains publicly readable and each role can only write its own UID-prefixed published objects.
- Existing owner Google Drive OAuth connection remains owner-only; Drive file actions are role-gated.
- Regression-test the existing login, private vault upload/list/download/delete, publishing/unpublishing, and Drive list/upload/download/delete workflows.

## Important

The SQL migration and Edge Functions must be deployed before the updated admin page can authenticate non-owner users. Do not publish the frontend first. The migration is additive to the existing storage setup; review the actual Supabase policy names before running it if the earlier SQL scripts were not applied as documented.
