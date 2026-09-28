# Postgres schema

The application uses Supabase as managed Postgres. Express is the only database client; web and mobile clients do not receive database credentials or call Supabase directly.

## Client choice

The server uses `pg` with parameterized SQL. Phase 1 requires an explicit transaction and `SELECT ... FOR UPDATE` for cumulative monthly-payment writes, so using one low-level client for both CRUD and transactions keeps the data layer small and the transaction boundary visible. The application-side pool is capped at one connection per warm Vercel instance, matching Supabase's transaction-pooler guidance; queries are unnamed, so `pg` does not create prepared statements that transaction mode cannot support.

`SUPABASE_SERVICE_ROLE_KEY` is reserved for server-side Supabase administrative APIs if one is needed later. The Postgres connection itself uses `DATABASE_URL`; neither value belongs in source control.

## Apply and verify

1. Copy `.env.example` to `.env` and replace `DATABASE_URL` with the Supabase pooler or direct Postgres connection string. Percent-encode reserved password characters (for example, `?` becomes `%3F`). With `pg` 8.x transaction-pooler URLs, keep `uselibpqcompat=true&sslmode=require` so SSL stays required without changing to certificate-verifying semantics.
2. Run `npm run db:migrate`.
3. Run `npm run db:check` and `npm run db:verify-schema`.

Migrations are applied in filename order and recorded in `schema_migrations`. Each migration runs in a transaction. Do not edit a migration after it has been applied; add a new numbered migration instead.

The initial schema intentionally does not enable Postgres RLS. Express sector scoping is introduced in Phase 2, and RLS remains optional Phase 6 hardening.

## Phase 1 data migration and backup

Postgres is the live finance datastore. Google Sheets is used only as the one-time migration source and an admin-triggered, one-way backup destination.

1. Configure `DATABASE_URL`, `APPS_SCRIPT_URL`, and `APPS_SCRIPT_SECRET` in ignored local/deployment environment variables. In Apps Script, set the matching `APPS_SCRIPT_SECRET` under Project Settings → Script properties; it is no longer stored in `Code.gs`.
2. Publish the current `apps-script/Code.gs` as a new Web App version.
3. Run `npm run db:migrate-from-sheets -- --dry-run`. Review record totals and resolve every reported member-identity collision.
4. Confirm the target database has no sector row, then run `npm run db:migrate-from-sheets -- --commit`. The import is one transaction and refuses to overwrite an existing sector.
5. Verify totals through the API and trigger `POST /api/export/sheets-backup` with an admin bearer token. This replaces only `DBBackup_*` tabs; it never writes to legacy operational tabs.

Keep the legacy Sheets data unchanged until the imported totals and a backup snapshot have both been checked. The import has no destructive replace mode by design.

## Current-field mapping

- Monthly tab identity fields (`Name`, `Phone Number`, `Designation`, `Member Category`) map to `members`.
- Monthly tab finance fields map to `monthly_payments`, including report-consumed legacy fields (`Receipt No`, `Increment`, `Special Fund`, `Recovery`).
- `Expenses`, `FollowUps`, and `SpecialFund` headers map directly to their corresponding tables.
- Special-fund campaign settings map to `special_fund_campaigns`.
- The currently editable message keys map to `message_templates`; other Settings sheet entries map to JSON values in `settings` so their number/string types survive migration.
