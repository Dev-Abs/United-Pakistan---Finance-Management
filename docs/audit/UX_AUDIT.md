# UI/UX and functional audit

Date: 2026-09-28

## Scope and evidence

The audited product is an Express 4 PWA with seven server-delivered HTML views and 3,547 lines of browser JavaScript, plus a Flutter client with 6,797 Dart lines. The web client uses a small history-based router, HTML fragments, ES modules, local storage for the access/refresh tokens and selected sector, and a single API wrapper. The mobile client uses GoRouter, Dio, ChangeNotifier stores, and secure storage. Server authorization is JWT-backed and tenant scope is applied by `scopeToSector`.

Automated evidence uses the installed Microsoft Edge through Playwright and axe-core. The deterministic fixture covers authenticated data without using personal or production finance records. Screenshots are written to `docs/ui/baseline/web/`. The Node suite passes 57/57. Flutter tests pass 15/15. Dart analysis has zero errors and 26 existing informational lints.

## Screen scores

| Platform | Screen | Score | Notes |
|---|---|---:|---|
| Web | Login/onboarding | 4 | Clear sign-in and request flow; external font remains optional. |
| Web | Dashboard | 4 | Strong hierarchy and responsive cards; shared theme defect fixed. |
| Web | Members | 4 | Useful filtering and actions; labels and warning contrast fixed. |
| Web | Expenses | 4 | Clear ledger/forms; user strings are now escaped before HTML insertion. |
| Web | Special Fund | 4 | Campaign-led workflow; status filter label fixed. |
| Web | Reports | 4 | Task-oriented summaries and exports; dynamic category strings escaped. |
| Web | Settings | 4 | Grouped configuration and diagnostics; dense on small screens. |
| Web | Sector administration | 4 | Search, status, pagination, users, audit, onboarding and explicit entry. |
| Mobile | Login/forced password | 4 | Keyboard-safe, validated and secure-storage backed. |
| Mobile | Sector selection | 4 | New searchable blocking state prevents super-admin dead-end. |
| Mobile | Dashboard/members/activity | 4 | Real states and data, readable surfaces, responsive content. |
| Mobile | Assistant/more/admin/team | 4 | Role-aware actions; context switcher is now persistent. |

## Findings

| ID | Platform | Screen | Severity | Category | Symptom | Root cause | Fix / status |
|---|---|---|---|---|---|---|---|
| UX-001 | Web | All authenticated | Critical | Theming | Dark text/surfaces mixed with light-only canvas and dialog surfaces. | Shared CSS used hardcoded light gradient/dialog/footer values under dark system mode. | Fixed with semantic background variables, `color-scheme`, and token-backed overlays. |
| UX-002 | Web/mobile | Super-admin finance | Critical | Tenant context | Blank banner or raw missing-header errors; mobile had no global context header. | Context existed only in web local storage; mobile Dio had no selected-sector state or interceptor binding. | Fixed end to end with structured API codes, forced selection, persistence, global header attachment, retry preservation and switching. |
| UX-003 | Web | Hidden overlays | High | Accessibility | Keyboard could reach controls inside visually hidden command and mobile-more overlays. | `aria-hidden` and opacity did not remove descendants from focus order. | Fixed with the native `hidden` state synchronized with open/close logic. |
| UX-004 | Web | Members | High | Accessibility | Two filters and reporting-month select had no accessible name. | Compact controls omitted labels. | Fixed with explicit accessible names. |
| UX-005 | Web | Members | High | Contrast | Warning badge was 2.81:1. | Hardcoded orange bypassed the semantic warning token. | Fixed; uses the 4.5:1-capable warning token. |
| UX-006 | Web | Finance tables/lists | High | Security | Several member/expense/report fields were interpolated into `innerHTML`. | Legacy string-template rendering lacked consistent escaping. | Fixed for identified user/API-supplied fields; static fragment loading remains by design. |
| UX-007 | Mobile | Super-admin | High | System state | Invalid/deactivated selected sector left finance views in an error state. | Server returned prose-only errors and the app could not invalidate selection. | Fixed with stable error codes and automatic return to selection. |
| UX-008 | Web | PWA | Medium | Installability | Manifest references missing PNG icons. | Only SVG icon is present. | Deferred: generate signed-off 192px/512px brand assets before release. |
| UX-009 | Mobile | Whole app | Low | Code health | Analyzer reports 26 informational lints. | Existing compact control-flow style and a few async-context/deprecation notices. | Deferred; no analyzer errors. Address separately to avoid unrelated churn. |
| UX-010 | Both | Production | High | Evidence | Production, real-device, 10k-record and provider-backed workflows are not reproducible in this workspace. | No deployment credentials/device/provider projects were supplied. | Open owner evidence; deterministic local tests do not claim production proof. |

## Role and context contract

- `secretary`: server-authoritative sector; matching or absent header accepted, conflicting sector denied.
- `read_only`: same tenant binding; all write middleware denies mutation.
- `super_admin`: platform routes work without tenant context; every finance route requires one active explicit sector.
- No context: web routes to Sector administration; mobile renders Select a sector.
- Valid context: attached to every finance request, including a replay after token refresh.
- Stale context: server returns `SECTOR_CONTEXT_INVALID`; clients clear it and return to selection with human wording.
- Logout or non-super-admin role restoration clears mobile context and secure-storage keys.

## Verification output

- `npm test`: 57 passed, 0 failed.
- `flutter test --no-pub`: 15 passed, 0 failed.
- `dart analyze mobile`: 0 errors, 26 informational lints.
- Playwright/axe: dashboard, members, expenses, reports and settings desktop are clean; Special Fund filter fix and compact hidden-overlay fix were applied from failures and are covered on rerun.

