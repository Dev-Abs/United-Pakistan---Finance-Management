# United Pakistan Finance Management — Project Context

Last updated: 2026-09-20

## Product goal and architecture

A responsive Express/vanilla-JavaScript finance management PWA backed by Google Sheets through Google Apps Script. It manages monthly member funds, payments, expenses, follow-ups, reports, settings, admin/read-only access, and campaign-based special funds. `public/` is the SPA, `server/` is the Express API, and `apps-script/Code.gs` owns spreadsheet persistence. Vercel serves the Express app.

## Current decisions and completed work

- The Special Fund feature is complete: campaign settings, separate contribution ledger, partial/multiple payments, receipts, member targets/status, configured Urdu appeal, WhatsApp/copy actions, navigation, and permissions. Settings writes merge partial updates.
- The app shell now routes immediately while month metadata refreshes. Cached month names provide an instant warm start; Sheets requests have a 15-second timeout and concurrent identical GETs are deduplicated.
- Dashboard current-month content renders before optional previous-month comparisons. View templates are cached in memory, stale route responses are ignored, and navigation has a subtle progress/enter state.
- The UI uses an emerald/teal Pakistan-inspired palette, explicit text-selection and keyboard-focus colors, calmer shadows/radii, touch feedback, below-fold rendering containment, accessible busy/live states, and reduced-motion support.
- External UI libraries are pinned; fonts load without blocking render. Static assets use versioned URLs and stale-while-revalidate caching, while HTML/service-worker responses revalidate.
- Unused vulnerable server dependencies (`jspdf`, `multer`) were removed. Browser PDF export now loads jsPDF 4.2.1 and AutoTable 5.0.8. A lockfile is committed for reproducible deploys.

## Important files changed

- Performance/UI: `public/index.html`, `public/js/app.js`, `public/js/api.js`, `public/js/dashboard.js`, `public/css/style.css`, `public/css/components.css`, `public/css/responsive.css`, `public/sw.js`, `server/index.js`.
- Export/dependencies: `public/js/export.js`, `package.json`, `package-lock.json`.
- Special Fund: `public/views/special-fund.html`, `public/js/special-fund.js`, `server/routes/special-fund.js`, `server/routes/settings.js`, `server/services/sheets.js`, `apps-script/Code.gs`, plus navigation/docs.

## Verification

- All browser/server JavaScript files passed `node --check`; Apps Script was parse-validated separately.
- Express started successfully and returned HTTP 200 for the app shell and versioned CSS.
- Production dependency audit reports 0 vulnerabilities; full audit retains two moderate development/transitive advisories.
- `git diff --check` passed (line-ending notices only).
- Browser UI automation could not reach the localhost server in this environment, so no screenshot-based visual regression pass was possible.

## Deployment and next actions

1. Publish `apps-script/Code.gs` as a new Google Apps Script Web App version; first use creates the `SpecialFund` sheet.
2. Commit `42597ff` is ready locally. Push it to the configured GitHub `origin/main`, then deploy through Vercel and smoke-test login, dashboard, mobile navigation, Special Fund writes, and PDF/Excel export against production configuration.
3. Watch API duration after deployment. The UI no longer hangs indefinitely, but Google Apps Script/Sheets latency remains an upstream constraint.

Never store secrets, tokens, passwords, or personal financial records in this file.
