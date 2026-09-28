# UI/UX Discovery Report

Evidence date: 2026-09-28. Scope: read-only discovery; no application code changed.

## 1. Environment & capability checks

| Check | Evidence/result |
|---|---|
| OS | Windows NT 10.0.26200.0 |
| Node/npm | Node v24.19.0; npm 11.17.0 |
| Flutter/Dart | `flutter --version` and `dart --version` produced no usable output before the 30-second command window ended. NOT CHECKED — version output unavailable. |
| Java/Gradle | `java` path resolves to `C:\Program Files (x86)\Common Files\Oracle\Java\java8path\java.exe`; version output unavailable. `gradle` was not resolved. |
| Git | Git resolves from `C:\Users\abdullah.ubaidullah\AppData\Local\Programs\Git\cmd\git.exe`; branch/status below. |
| Local server + `/api/health` | NOT CHECKED — no local server was started because the repository requires environment/database configuration and the task prohibits changing configuration. |
| Multi-sector realistic seed | `server/scripts/seed-auth-users.js` exists for auth users; `server/scripts/migrate-from-sheets.js` imports a seed sector. No verified script was found that creates multiple realistic sectors. |
| Browser screenshot | `require('playwright')` failed exactly: `Cannot find module 'playwright'` (require stack points to the repository eval script). NOT CHECKED — no browser launch. |
| Local role login | NOT CHECKED — requires running API/database and credentials; account names are documented in `PROJECT_CONTEXT.md`, but passwords are intentionally not inspected/reported. |
| Flutter tests/goldens/web/device | NOT CHECKED — Flutter command output unavailable within capability window; no emulator/device was verified. |
| Fonts | Web loads Inter from Google Fonts; login loads it synchronously, app shell uses print/onload. No local Inter or Noto Urdu font asset was found by source inspection. |

## 2. Git & current UI state

Current branch: `main`. Working tree was already dirty before discovery; `git status --short` included modified `.env.example`, `PROJECT_CONTEXT.md`, `README.md`, selected server/public/mobile files, and untracked RLS/discovery files. No changes were made by this report task.

Recent commits: `cdb31af -- changes`, `302f64c -- final`, `b4e4d7c -- supabase`, `d690cdc -- changes`, `46afd07 --changes`, `ff72e7f -- enhancements`, `4d08d28 engancements and ai`, `792d4b5 mobile code and server`, then older UX commits `cb7e0e6 Refresh finance management UX` and `6b7c10a Modernize UI and improve app responsiveness`.

Best evidence-based UI-revamp baseline: `cb7e0e6`, the last clearly titled UX refresh before the later mobile/server/AI and current red-system work. This is a reasoned baseline, not a definitive project decision.

Backup branches/tags: no local backup/tag refs were shown; `remotes/origin/main` exists.

## 3. Web portal inventory

| View | Route/nav | JS | Roles/primary task |
|---|---|---|---|
| Login | `/login.html` | `app.js` auth flow | all; authenticate |
| Dashboard | `/` | `dashboard.js` | all; monthly overview, charts, quick actions |
| Members | `/members` | `members.js` | all; search, payment, follow-up, member CRUD by permission |
| Expenses | `/expenses` | `expenses.js` | all; review/record expenses, export |
| Special Fund | `/special-fund` | `special-fund.js` | all; campaign/contributions/appeal |
| Reports | `/reports` | `reports.js`, `export.js` | all; reporting and export |
| Settings | `/settings` | `settings.js` | all with role-gated management/diagnostics |
| Sector admin | `/admin` | `admin.js` | super_admin; sector/platform administration |

CSS files: `style.css` 719 lines, 5 `!important`, 4 `@media`; `components.css` 1,257 lines, 0 `!important`, 0 `@media`; `responsive.css` 511 lines, 1 `!important`, 5 `@media`. Exact breakpoints are in `responsive.css` and `style.css`; source inspection found mobile/tablet/desktop media rules but no browser validation. Root tokens include brand `#1a0305/#2a0508/#4a0a10/#7a0f1a/#a3121f/#c8102e/#e23a4a/#f27a83/#ffe5e7`, status success/warning/info/danger pairs, `--sidebar-width:264px`, `--header-height:76px`, radius 8/12/16px, spacing 4–32px, shadows, and transition. Dark mode is `@media (prefers-color-scheme: dark)` token override; no user theme switch was verified in web source.

Views are fetched and inserted by the SPA (`public/js/app.js`); HTML is then enhanced with module code. Dialogs, tables, skeletons and empty states are template/DOM based. Chart.js 4.4.7 and Lucide 0.468.0 are CDN-loaded. PWA manifest declares United Pakistan Finance / UP Finance, standalone, portrait-primary, background `#1A0305`, theme `#C8102E`, and `/icon-192.png`, `/icon-512.png` (those PNG paths were not verified present). Service worker cache is `up-finance-v11-enterprise`; API is never cached, CSS/JS/views are network-first with cache fallback, and static assets are cache-first. HTML uses versioned CSS URLs in the app shell while login CSS is unversioned, which can permit mixed asset freshness.

Accessibility evidence: semantic nav landmarks, `aria-label`/live-region/dialog attributes, `:focus-visible`, keyboard command center, focus restoration/scroll lock in JS, and `prefers-reduced-motion` rules are present. Build step: no bundler/Tailwind/PostCSS script appears in `package.json`; deployment runs Express directly.

## 4. Flutter inventory

| File | Lines | Renders/reachability |
|---|---:|---|
| `lib/src/screens.dart` | 1,891 | core auth/shell/dashboard/members/activity/forms; role-gated through shell |
| `lib/src/parity_screens.dart` | 1,455 | parity workflows/settings/reports/special fund |
| `lib/src/ai_assistant.dart` | 1,681 | assistant workspace and actions |
| `lib/src/theme.dart` | 523 | light/dark/system theme and component tokens |
| `lib/src/finance_store.dart` | 319 | API-backed state |
| `lib/src/session.dart` | 229 | auth/session |
| `lib/src/api_client.dart` | 196 | Dio client |
| `lib/src/templates.dart` | 143 | message templates |
| `lib/src/app.dart` | 137 | router/app shell |
| `lib/main.dart` | 8 | entrypoint |

Files over 1,000 lines: `screens.dart`, `parity_screens.dart`, `ai_assistant.dart`.

UI-relevant declared dependencies: `flex_color_scheme ^8.4.0`, `google_fonts ^6.2.1`, `flutter_animate ^4.5.2`, `iconsax ^0.0.8`, `go_router ^17.5.0`, `skeletonizer ^3.0.0`, `fl_chart ^1.2.0`, `dio ^5.9.0`, `flutter_secure_storage ^9.2.4`, `url_launcher ^6.3.2`. Resolved versions should be read from `mobile/pubspec.lock`; tests were not completed.

Navigation uses GoRouter, a four-tab/More shell with role guards, and ChangeNotifier/`FinanceStore`. Responsive behavior uses Flutter layout constraints/breakpoints. Android manifest handles orientation/configuration changes; compile/min/target SDK are delegated to Flutter defaults in `build.gradle.kts`. iOS build support was not verified. Tablet/large-screen layouts are represented in the design docs but not device-verified.

## 5. Screen × role matrix

| Surface/action | super_admin | secretary | read_only |
|---|---|---|---|
| Dashboard, members, expenses, special fund, reports | visible | visible | visible |
| Record/edit/delete payments, members, expenses, follow-ups | enabled | enabled by route permission | hidden/disabled/read-only |
| Settings organization/templates/months | visible; management actions | visible; scoped management actions | visible with writes restricted |
| Team/sector administration | visible for super admin | hidden | hidden |
| Diagnostics/repair/export | visible where route guard allows | role/route dependent | export/read only; mutations denied |
| AI assistant | visible when feature flags enabled | visible when enabled | scoped/read-only behavior |

This matrix is source/route based; live role screenshots and API verification were not possible. No additional role leak is asserted without runtime evidence.

## 6. Real content & data characteristics

`PROJECT_CONTEXT.md` records the imported seed as 1 sector, 3 months, 12 deduplicated members, 35 payments, 11 expenses, 163 follow-ups, and one special-fund campaign. It also records 5-failure login lockout, 30-minute access tokens, and 14-day refresh tokens. No maximum limits were found in the inspected sources.

Observed source-shaped values: PKR/currency metrics, member search by name/phone/category/reply, expense categories such as Rent/Electricity/Water/Food/Maintenance, payment statuses including paid/pending/outstanding, phone/WhatsApp actions, and English UI copy. Urdu appeal/template support is documented in project context, but no visual Urdu rendering check was possible. RTL handling was not verified in web source. Existing web font is Inter; no local Urdu font was found.

Loading states include skeleton cards/table rows on dashboard, members, expenses and reports. Empty states include no matching members/expenses, no expense chart data, and generic API error/toast paths. Exact per-screen runtime error states were not executed.

## 7. Current visual state with evidence

Browser capture was unavailable because Playwright is not installed and no browser launch was completed. Code-level review only; therefore no top-15 screenshot defect list is claimed. Existing evidence file found in the repository: [web-login-public-1440-system.png](discovery/web-login-public-1440-system.png). It predates this report and was not regenerated.

Code-level visual risks to validate later: very large JS view modules; CDN font/icon/chart dependence; unverified 360/768/1024/1440 layouts; unverified dark-mode web behavior; unverified Urdu font/RTL; possible manifest icon path mismatch; mixed versioned/unversioned CSS URLs.

## 8. Performance & network reality

NOT CHECKED — no browser/server session was available for transfer size, request count, TTI, API timings, or dashboard call count. Source evidence indicates service-worker caching, request de-duplication/timeouts, skeleton loading, offline status UI, and cached view templates. No new APK was built; existing APK size was not independently verified in this discovery.

## 9. Brand & assets

Brand name: United Pakistan Finance / UP Finance. Existing mark: `public/icon.svg` with “UP”; manifest references PNG icons. Current source tokens use a blood-red identity with ember accent. Organization and sector names are API/settings-driven; per-sector color/logo storage was not verified in the inspected schema. Design docs include `docs/ui-revamp/AUDIT.md`, `DESIGN_SYSTEM.md`, `PHASE_STATUS.md`, and `UNRELATED_ISSUES.md`; project context says the audit/design system reflect Phase A while later implementation is incremental and incomplete.

## 10. Feature flags & upcoming UI surface

Documented flags/surfaces: `AI_FEATURES_ENABLED` (copilot/briefings/reminders/reports/chat), `AI_CONTROLLED_ACTIONS_ENABLED` (reviewable bulk reminder drafts; sending remains disabled), exports (CSV/Excel/PDF UI and backend), notifications (placeholder/backend route), sector administration/onboarding, and diagnostics. Push notifications, password reset, SSO, unattended actions, direct-send WhatsApp, and authenticated binary download/share remain deferred or incomplete per project context.

## 11. Testing infrastructure

Node test command is `npm test` → `node server/test/run.js`; execution was not completed within this capability window. Flutter has `mobile/test/widget_test.dart`, but `flutter test` produced no usable output before the command window ended. No Playwright/golden infrastructure was verified. No screenshot test suite was found by source inventory.

## 12. Questions for the owner

1. What devices, browsers, and screen sizes do daily users actually use?
2. Who are the daily users, and what is their technical comfort level?
3. What are the Urdu, English, and RTL priorities for web and mobile?
4. Should the default theme be light, dark, or system-following?
5. Should the UI favor dense operational tables or more spacious cards?
6. Which reference apps/sites best represent the desired quality bar?
7. What exact brand red and logo asset should be authoritative?
8. Is per-sector branding (name, logo, color) wanted?
9. What offline behavior is expected, and which actions must work offline?
10. What accessibility requirements apply, including large text and contrast targets?
11. Which screens must make the strongest first impression?
12. Which existing UI patterns must be preserved?
13. Should the web and Flutter products share identical visual language or remain platform-specific?
14. Which exports, notifications, AI surfaces, and admin workflows are in the first UI milestone?
