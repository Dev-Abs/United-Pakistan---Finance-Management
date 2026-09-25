# United Pakistan Finance Management — Project Context

Last updated: 2026-09-26

## Product goal and architecture

A responsive Express/vanilla-JavaScript finance management PWA backed by Google Sheets through Google Apps Script. It manages monthly member funds, payments, expenses, follow-ups, reports, settings, admin/read-only access, and campaign-based special funds. `public/` is the SPA, `server/` is the Express API, and `apps-script/Code.gs` owns spreadsheet persistence. Vercel serves the Express app.

## Current decisions and completed work

- The Special Fund feature is complete: campaign settings, separate contribution ledger, partial/multiple payments, receipts, member targets/status, configured Urdu appeal, WhatsApp/copy actions, navigation, and permissions. Settings writes merge partial updates.
- The app shell now routes immediately while month metadata refreshes. Cached month names provide an instant warm start; Sheets requests have a 15-second timeout and concurrent identical GETs are deduplicated.
- Dashboard current-month content renders before optional previous-month comparisons. View templates are cached in memory, stale route responses are ignored, and navigation has a subtle progress/enter state.
- The UI uses an emerald/teal Pakistan-inspired palette, explicit text-selection and keyboard-focus colors, calmer shadows/radii, touch feedback, below-fold rendering containment, accessible busy/live states, and reduced-motion support.
- External UI libraries are pinned; fonts load without blocking render. Static assets use versioned URLs and stale-while-revalidate caching, while HTML/service-worker responses revalidate.
- Unused vulnerable server dependencies (`jspdf`, `multer`) were removed. Browser PDF export now loads jsPDF 4.2.1 and AutoTable 5.0.8. A lockfile is committed for reproducible deploys.
- The September UX refresh simplifies mobile navigation to five destinations with a bottom-sheet More menu, adds clearer page context and management toolbars to Members and Expenses, exposes live result counts and filter reset actions, keeps data-table headers visible on desktop, and improves empty states.
- Dialogs now gain accessible roles/labels, Escape and backdrop dismissal, focus placement, scroll locking, and focus restoration. Toasts use safe text nodes and live-region semantics. Login now supports password visibility and browser autofill metadata.
- Dashboard, Members, Expenses, and Reports replace stale month-change handlers when reinitialized, preventing duplicate requests after repeated navigation.
- The enterprise shell adds a searchable Ctrl/Cmd+K command center for pages and frequent admin actions, a persistent collapsible desktop sidebar, clearer page context, mobile search/actions access, and explicit offline status.
- Shared design tokens now cover spacing and radius scales; navigation, inputs, cards, tables, dialog controls, focus states, and responsive command UI use one restrained enterprise visual language.
- Dynamically loaded views receive automatic label/control association and normalized dialog close controls. Reports and Settings now have consistent task-oriented page introductions and reporting-period context.
- A native Flutter Android client foundation now lives in `mobile/`. It follows a design-first mobile architecture with login, role-aware shell, four-tab navigation, dashboard, member search/list/detail, payment and expense sheets, activity/special-fund views, reports, notifications placeholder, month selection, empty/success/read-only states, and centralized theme/API configuration.
- The Flutter foundation now uses a deliberately scoped premium stack: FlexColorScheme/Google Fonts/dynamic color for light and dark themes, GoRouter guards, Flutter Animate transitions, Iconsax navigation, Cupertino-style modal sheets, responsive breakpoints, Skeletonizer loading, toast feedback, fl_chart cash-flow visualization, Dio networking, and encrypted secure-storage session restoration. Packages without a concrete current use case were not added.
- The mobile product audit, web-to-mobile mapping, visual design system, full screen collection, critical workflow board, and application-state board are stored in `docs/mobile-design/` as the implementation source of truth.
- The mobile API base URL is injected with `--dart-define=API_BASE_URL=...`; the existing backend still lacks password reset, token refresh, push notification, and device-bound secure-session APIs. Only login is live-wired in this first client foundation; finance screens currently demonstrate the agreed UI/flows with representative data pending repository/state integration.
- Mobile login troubleshooting confirmed that the bundled default API URL, `http://10.0.2.2:3000`, is emulator-only. A physical-device/release APK must be rebuilt with the deployed HTTPS Express origin via `--dart-define=API_BASE_URL=https://...`; the current “offline” message represents a socket connection failure before credential validation.
- Vercel/mobile deployment preparation now includes a public non-sensitive `/api/health` probe, safe placeholder-only `.env.example`, ignored local `.vercel/` metadata, complete production environment-variable guidance, and an explicit Android release command/output path. Previously committed example values must be treated as exposed and rotated before production use.

## Important files changed

- Performance/UI: `public/index.html`, `public/login.html`, `public/views/members.html`, `public/views/expenses.html`, `public/js/app.js`, `public/js/api.js`, `public/js/dashboard.js`, `public/js/members.js`, `public/js/expenses.js`, `public/js/reports.js`, `public/js/utils.js`, `public/css/style.css`, `public/css/components.css`, `public/css/responsive.css`, `public/sw.js`, `server/index.js`.
- Enterprise experience pass: `public/index.html`, `public/js/app.js`, `public/js/reports.js`, `public/views/reports.html`, `public/views/settings.html`, `public/css/style.css`, `public/css/components.css`, `public/css/responsive.css`, `public/sw.js`.
- Export/dependencies: `public/js/export.js`, `package.json`, `package-lock.json`.
- Special Fund: `public/views/special-fund.html`, `public/js/special-fund.js`, `server/routes/special-fund.js`, `server/routes/settings.js`, `server/services/sheets.js`, `apps-script/Code.gs`, plus navigation/docs.
- Flutter mobile: `mobile/pubspec.yaml`, `mobile/pubspec.lock`, `mobile/lib/main.dart`, `mobile/lib/src/app.dart`, `mobile/lib/src/api_client.dart`, `mobile/lib/src/session.dart`, `mobile/lib/src/theme.dart`, `mobile/lib/src/screens.dart`, `mobile/test/widget_test.dart`, `mobile/README.md`, and Android scaffold under `mobile/android/`.
- Mobile discovery/design: `docs/mobile-design/PRODUCT_AUDIT.md`, `docs/mobile-design/MOBILE_STRATEGY.md`, and PNG boards under `overview/`, `screens/`, `workflows/`, and `states/`.

## Verification

- All browser/server JavaScript files passed `node --check`; Apps Script was parse-validated separately.
- Express started successfully and returned HTTP 200 for the app shell and versioned CSS.
- Production dependency audit reports 0 vulnerabilities; full audit retains two moderate development/transitive advisories.
- `git diff --check` passed (line-ending notices only).
- The local Express app returned HTTP 200 for the login shell. Browser UI automation failed to initialize its runtime assets in this environment, so screenshot-based visual regression remains unavailable.
- After the UX refresh, all browser/server JavaScript files passed `node --check`; CSS brace counts and edited view tag counts are balanced; `git diff --check` passed.
- After the enterprise shell pass, all browser/server JavaScript files again passed `node --check`; all three CSS files have balanced braces; `git diff --check` passed; Express served the app shell and versioned CSS with HTTP 200 and the new command UI was present in both responses.
- Chrome was unavailable to the UI automation runtime and the in-app browser timed out loading localhost, so screenshot-based desktop/mobile QA remains outstanding.
- Flutter dependencies resolved successfully; `flutter analyze` reports no issues and `flutter test` passes 2/2 widget tests.
- After the premium Flutter foundation pass, SDK-compatible dependency versions resolved successfully, `dart analyze` reports no issues, and `flutter test --no-pub` passes 2/2 widget tests.
- Mobile login configuration was inspected end-to-end: the client posts to `/api/auth/login`, Android has Internet permission, and Express exposes the matching endpoint. No code was changed; the observed failure is consistent with an unreachable compile-time API base URL.
- `flutter build apk --release` was attempted twice but the installed Windows/Gradle environment failed before compilation with `java.io.IOException: Unable to establish loopback connection`, including with daemon disabled and IPv4 forced. No APK was produced in this environment.
- Deployment smoke test passed locally: `/api/health` returned HTTP 200 with `configured: true`, a valid test secretary login returned the admin role, `node --check server/index.js` passed, and `git diff --check` passed (line-ending notices only).

## Deployment and next actions

1. Publish `apps-script/Code.gs` as a new Google Apps Script Web App version; first use creates the `SpecialFund` sheet.
2. Connect/import the GitHub repository in Vercel, enter the private production variables listed in `README.md`, and deploy. The machine is not linked/authenticated to Vercel; both the CLI and dashboard automation were unavailable, so this one-time account step remains user-owned. Confirm `/api/health` and web login afterward.
3. Watch API duration after deployment. The UI no longer hangs indefinitely, but Google Apps Script/Sheets latency remains an upstream constraint.
4. Run a screenshot-based desktop/mobile visual pass when browser automation can reach localhost; verify command-palette keyboard navigation, collapsed-sidebar tooltips/legibility, mobile More → Search, and modal focus on real data.
5. Continue the Flutter data layer: replace representative screen data with repositories for members, payments, follow-ups, expenses, campaign data, reports/exports, settings, diagnostics, and month rollover. Secure token persistence is now implemented; token refresh and server-side invalidation still require backend endpoints.
6. Rotate the previously committed admin/reader credentials, session tokens, and Apps Script shared secret before production. Update `Code.gs` and publish a new Apps Script Web App version when rotating its shared secret.
7. Resolve the local Gradle loopback restriction, then run `flutter build apk --release --dart-define=API_BASE_URL=<production HTTPS URL>` from `mobile/`. Configure an organization-owned release keystore before distributing the APK.

Never store secrets, tokens, passwords, or personal financial records in this file.
