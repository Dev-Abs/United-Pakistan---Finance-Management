# United Pakistan - Finance Management

A lightweight, full-stack web application for managing monthly finances. Supabase Postgres is the authoritative datastore; Google Sheets remains a one-time migration source and one-way disaster-recovery export target.

## Features

- **Special Fund campaigns** — configure category minimums and an Urdu appeal, track multiple contributions per member, and review campaign progress and its transaction ledger.
- **Dashboard**: High-level stats, recent payments, and quick actions.
- **Member Management**: Add, edit, delete, and search members.
- **Payment Tracking**: Mark payments, handle partial payments, and auto-calculate remaining balances.
- **Reminders**: One-click WhatsApp link generation and bulk copy features.
- **Monthly Rollover**: Create a new month sheet carrying over pending balances with a single click.
- **Export**: Download records in CSV, Excel, or PDF format.
- **Management copilot (optional)**: Generate grounded briefings and reminders, parse natural-language entries into editable confirmations, review deterministic data anomalies, and ask scoped read-only questions without granting the model direct write access.

## Architecture
```
Browser (HTML/CSS/Vanilla JS)
        ↓  REST calls
Express.js Server (Node.js, hosted on Vercel as serverless functions)
        ↓  parameterized SQL
Supabase Postgres (authoritative datastore)

Admin-triggered backup: Express → Google Apps Script → DBBackup_* Sheets tabs
```

## Setup & Deployment Guide

### 1. Google Sheets & Apps Script Setup
1. Create a new Google Spreadsheet.
2. Go to `Extensions > Apps Script`.
3. Copy the contents of `apps-script/Code.gs` from this project and paste it into the editor.
4. Click **Deploy > New deployment**.
5. Select **Web app**.
6. Set **Execute as**: `Me` and **Who has access**: `Anyone`.
7. Click Deploy, authorize the app, and copy the **Web app URL**.
8. Under **Project Settings → Script properties**, add `APPS_SCRIPT_SECRET` with a new random value. Use the same value in Vercel. Do not place it in `Code.gs` or commit it.

### 2. GitHub Setup
1. Initialize a git repository in this project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
2. Push the code to a new GitHub repository.

### 3. Vercel Deployment
1. Go to [Vercel](https://vercel.com/) and import your new GitHub repository.
2. Add the following Environment Variables for **Production, Preview, and Development** in the Vercel dashboard:
   - `JWT_SECRET`: at least 32 random characters used to sign bearer sessions
   - `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`: environment-only credentials for the seeded super administrator
   - `SEED_SECRETARY_EMAIL` / `SEED_SECRETARY_PASSWORD`: environment-only credentials for the migrated sector secretary
   - `SEED_SECTOR_SLUG`: defaults to `united-pakistan`
   - `DATABASE_URL`: Supabase Postgres transaction-pooler URI; percent-encode reserved password characters and keep `uselibpqcompat=true&sslmode=require`
   - `APPS_SCRIPT_URL`: the deployed Google Apps Script Web App URL from step 1.7
   - `APPS_SCRIPT_SECRET`: the random value configured in Apps Script properties; needed only for migration and backup export
   - `DEEPSEEK_API_KEY`: DeepSeek API key; server secret only, never add it to Flutter or an APK
   - `DEEPSEEK_MODEL`: a currently supported model selected after evaluation (the example file uses `deepseek-flash`)
   - `AI_FEATURES_ENABLED`: set to `true` only after approving the external-data policy and configuring the key/model
   - `AI_CONTROLLED_ACTIONS_ENABLED`: keep `false` by default; set to `true` only to expose admin-only bulk draft preparation after the stronger-authentication review
   - Optional AI budget controls: `AI_DAILY_REQUEST_LIMIT`, `AI_MAX_INPUT_CHARS`, `AI_MAX_OUTPUT_TOKENS`, and `AI_TIMEOUT_MS`
   - Optional organization fields from `.env.example`
3. Click **Deploy**. Vercel will use `vercel.json` to host the Express API and static web app.
4. Open `https://YOUR-PROJECT.vercel.app/api/health`. Continue only when it returns `configured: true`.
5. Run `npm run db:seed-auth` once the seed credentials are configured, then test the web login at `https://YOUR-PROJECT.vercel.app/login.html` before building the mobile app.

Never paste deployment secrets into source files, commit them, or share them in screenshots. Values previously committed as examples should be treated as exposed and rotated before production use.

The copilot sends only minimized facts through the authenticated Express API. It excludes phone numbers, credentials, tokens, and free-form remarks. Entry parsing produces an editable proposal; saving still requires explicit confirmation and uses the normal authorized finance route. Bulk drafts never send automatically and remain disabled unless `AI_CONTROLLED_ACTIONS_ENABLED=true`. Scheduled unattended automation is intentionally unavailable until expiring sessions, durable audits, and a scheduler exist.

### Platform operations

- Public sector onboarding is request-and-approve: `/login.html` accepts a sector request, while super-admins review it in the Platform Console before a sector is created. The request endpoint is honeypot- and rate-limited; CAPTCHA and credential delivery remain deployment-owned decisions.
- The authenticated shell and Flutter More screen expose sector-scoped overdue-payment and due-follow-up notifications through `/api/notifications`. Push delivery and scheduled reminders are intentionally off until Firebase credentials and a scheduler are configured.
- CSV, Excel, and PDF exports are authenticated and sector-scoped. Each export records an actor-bound audit event; PDF audit requests are idempotent.
- Team mutations and finance mutations require idempotency keys. Clients generate them automatically, while external API callers must supply `Idempotency-Key` for protected writes.
- Login lockout is durable across serverless instances: five failures for the same normalized username/client-address hash lock that key for 15 minutes. Raw usernames and IP addresses are not stored in the lockout table, and a successful login clears its key.
- Web and Flutter logout submit the current refresh token for server-side revocation before clearing local credentials. Local sign-out still completes if the network is unavailable; a revoked refresh token cannot be rotated again.
- Before enabling the review-only policies in `db/rls/finance-policies.sql`, run `npm run db:check-rls-role`. It must report `rlsEnforcementReady: true`. Either use a non-bypass `DATABASE_URL` role or set `DATABASE_RLS_ROLE` to a restricted `NOLOGIN` role that the connection role can `SET`; tenant transactions enter that role with `SET LOCAL ROLE`. Never apply the draft while the preflight fails.
- To provision the restricted-role option, choose a simple role name such as `finance_app`, set it as `DATABASE_RLS_ROLE` in the local environment, then run `npm run db:provision-rls-role` followed by `npm run db:check-rls-role`. The provisioner is idempotent, grants only tenant-table DML/schema/sequence access, creates no login or password, and does not enable policies.
- The current hosted Supabase database has the finance-table policies enabled and uses Supabase's built-in `authenticated` role for enforcement. Set `DATABASE_RLS_ROLE=authenticated` in every deployed runtime before considering RLS active end-to-end, then run `npm run db:check-rls-role` and `npm run smoke:rls` from an environment using the same database.

### 4. Build the Android app against Vercel

From the `mobile` directory, run:

```bash
flutter clean
flutter pub get
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR-PROJECT.vercel.app
```

Do not add `/api` to `API_BASE_URL`; the app adds routes such as `/api/auth/login` itself. The generated APK is `mobile/build/app/outputs/flutter-apk/app-release.apk`. Install that APK on the phone, uninstalling the earlier emulator-configured build first if Android keeps the old app data.

Before the Phase 1 cutover, follow the migration and backup runbook in `db/README.md`. Payment conflict protection now runs inside a Postgres transaction with a locked payment row. Phase 2 authentication uses bcrypt password hashes, signed JWTs, forced password changes for seeded/provisioned accounts, and explicit `X-Sector-Id` selection for super-admin finance requests.

### 5. Running Locally
If you want to run the project on your own machine:
1. Ensure Node.js (v18+) is installed.
2. Run `npm install` in the project root.
3. Copy `.env.example` to `.env` and fill in the required variables, especially `DATABASE_URL`. Add Apps Script values when running the migration or Sheets backup.
4. Run `npm start`.
5. Open `http://localhost:3000` in your browser.

## Project Structure
- `/db/` - ordered Postgres migrations and the migration/backup runbook.
- `/apps-script/` - Google Apps Script backup destination code.
- `/public/` - Vanilla HTML, CSS, and JS for the frontend. No build step required.
- `/server/` - Express server acting as the API layer and Vercel serverless entry points.

## Settings
You can update your Organization Name, Secretary Name, Easypaisa details, etc., directly from the **Settings** page in the web app. These details are used to dynamically generate the WhatsApp reminder templates.
