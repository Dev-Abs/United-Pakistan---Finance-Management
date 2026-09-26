# United Pakistan - Finance Management

A lightweight, full-stack web application for managing the monthly finances of the United Pakistan political party. Replaces manual Excel + WhatsApp operations with a clean admin panel backed by Google Sheets via Google Apps Script.

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
        ↓  HTTPS POST/GET
Google Apps Script Web App (acts as thin sheet API)
        ↓
Google Sheets (one tab per month, acts as database)
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
8. In the Apps Script code, replace the `SECRET` value with a new random value. Use the same value for `APPS_SCRIPT_SECRET` in Vercel. Do not commit it.

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
   - `ADMIN_USERNAME`: for example, `secretary`
   - `ADMIN_PASSWORD`: choose a strong, unique password
   - `SESSION_SECRET`: a long random value used as the admin bearer token
   - `READER_USERNAME`: optional read-only account name
   - `READER_PASSWORD`: optional read-only account password
   - `READER_SECRET`: a second long random value, different from `SESSION_SECRET`
   - `APPS_SCRIPT_URL`: the deployed Google Apps Script Web App URL from step 1.7
   - `APPS_SCRIPT_SECRET`: the random value configured in `Code.gs`
   - `DEEPSEEK_API_KEY`: DeepSeek API key; server secret only, never add it to Flutter or an APK
   - `DEEPSEEK_MODEL`: a currently supported model selected after evaluation (the example file uses `deepseek-flash`)
   - `AI_FEATURES_ENABLED`: set to `true` only after approving the external-data policy and configuring the key/model
   - `AI_CONTROLLED_ACTIONS_ENABLED`: keep `false` by default; set to `true` only to expose admin-only bulk draft preparation after the stronger-authentication review
   - Optional AI budget controls: `AI_DAILY_REQUEST_LIMIT`, `AI_MAX_INPUT_CHARS`, `AI_MAX_OUTPUT_TOKENS`, and `AI_TIMEOUT_MS`
   - Optional organization fields from `.env.example`
3. Click **Deploy**. Vercel will use `vercel.json` to host the Express API and static web app.
4. Open `https://YOUR-PROJECT.vercel.app/api/health`. Continue only when it returns `configured: true`.
5. Test the web login at `https://YOUR-PROJECT.vercel.app/login.html` before building the mobile app.

Never paste deployment secrets into source files, commit them, or share them in screenshots. Values previously committed as examples should be treated as exposed and rotated before production use.

The copilot sends only minimized facts through the authenticated Express API. It excludes phone numbers, credentials, tokens, and free-form remarks. Entry parsing produces an editable proposal; saving still requires explicit confirmation and uses the normal authorized finance route. Bulk drafts never send automatically and remain disabled unless `AI_CONTROLLED_ACTIONS_ENABLED=true`. Scheduled unattended automation is intentionally unavailable until expiring sessions, durable audits, and a scheduler exist.

### 4. Build the Android app against Vercel

From the `mobile` directory, run:

```bash
flutter clean
flutter pub get
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR-PROJECT.vercel.app
```

Do not add `/api` to `API_BASE_URL`; the app adds routes such as `/api/auth/login` itself. The generated APK is `mobile/build/app/outputs/flutter-apk/app-release.apk`. Install that APK on the phone, uninstalling the earlier emulator-configured build first if Android keeps the old app data.

### 5. Running Locally
If you want to run the project on your own machine:
1. Ensure Node.js (v18+) is installed.
2. Run `npm install` in the project root.
3. Rename `.env.example` to `.env` and fill in the required variables (especially `APPS_SCRIPT_URL`).
4. Run `npm start`.
5. Open `http://localhost:3000` in your browser.

## Project Structure
- `/apps-script/` - Google Apps Script code to paste into Google Sheets.
- `/public/` - Vanilla HTML, CSS, and JS for the frontend. No build step required.
- `/server/` - Express server acting as the API layer and Vercel serverless entry points.

## Settings
You can update your Organization Name, Secretary Name, Easypaisa details, etc., directly from the **Settings** page in the web app. These details are used to dynamically generate the WhatsApp reminder templates.
