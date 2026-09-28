# Security Rotation Runbook

This document contains names and procedures only. It intentionally contains no secret values, tokens, passwords, or personal records.

## Rotation inventory

| Secret or credential | Where it is used | Rotation owner | Required follow-up |
|---|---|---|---|
| `DATABASE_URL` password | Express `pg` connection | Project owner / Supabase | Create a new database password, percent-encode reserved characters, update ignored local `.env` and deployment variables, run `npm run db:check`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Administrative Supabase tooling, if retained | Project owner / Supabase | Generate a new server-only key, update deployment secret store, never expose to web/mobile. |
| `JWT_SECRET` | Access-token signing | Project owner | Set a new random value of at least 32 characters; restart all instances. Existing access and refresh sessions become invalid after session-version/revocation cleanup. |
| `SUPER_ADMIN_PASSWORD` | Bootstrap seed only | Project owner | Choose a new strong password, run `npm run db:seed-auth` only when intentionally provisioning; complete forced password change. |
| `SEED_SECRETARY_PASSWORD` | Bootstrap seed only | Project owner | Choose a separate strong password, run the seed command, then complete forced password change. |
| Apps Script project property secret | One-way Sheets backup endpoint | Project owner / Apps Script | Generate a new property value, update deployment `APPS_SCRIPT_SECRET`, redeploy the Web App, run the backup smoke. |
| Previously committed legacy admin/reader credentials | Historical examples and old auth paths | Project owner | Retire accounts and passwords; do not reuse them. Search repository history and rotate any matching live accounts. |
| DeepSeek API key | Optional AI provider | Project owner / DeepSeek | Revoke and issue a new key, store only in deployment secrets, keep AI disabled until the data boundary is approved. |
| Vercel deployment variables | Production runtime | Project owner / Vercel | Update the private variables, redeploy, verify `/api/health`, login, refresh rotation, and backup behavior. |
| Android release keystore | Mobile release signing | Organization owner | Create/rotate an organization-owned keystore, store it outside the repository, update CI/local signing configuration, and record recovery ownership separately. |

## Order of operations

1. Put the application in a maintenance window and revoke old provider/deployment credentials.
2. Rotate the database and Apps Script secrets, update the private deployment store, and verify connectivity/backup.
3. Rotate `JWT_SECRET`, increment/revoke user sessions, and verify login plus refresh-token rotation.
4. Rotate bootstrap and platform credentials; run the seed command only with intentional fresh values.
5. Keep AI flags disabled until the external-data policy is approved; rotate the provider key immediately before enablement.
6. Rebuild the Android release only after the HTTPS API origin and keystore are configured.

## Verification checklist

- `npm run db:check`
- `npm run db:migrate`
- `npm test`
- `npm audit --omit=dev`
- `npm run smoke:phase2`
- `npm run smoke:phase1` with the backup deployment
- Login, forced password change, `/api/auth/refresh`, logout, and deactivated-user rejection
- `/api/health` reports configured without revealing secret values
- Confirm no secret appears in `.env.example`, `PROJECT_CONTEXT.md`, logs, audit metadata, or client bundles

Production rotation is intentionally owner-operated. This repository does not call provider dashboards, revoke production keys, or alter deployment accounts automatically.
