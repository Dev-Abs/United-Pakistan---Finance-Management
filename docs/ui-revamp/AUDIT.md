# UI/UX Audit — Super-Admin and Redesign Baseline

Last reviewed: 2026-09-28

## Scope and evidence

This is Phase A’s code-level audit. Findings are based on the current files, route behavior, CSS/layout rules, Flutter widget tree, and the existing role middleware. Browser screenshot automation and a Flutter device/emulator were not available in this workspace, so no visual claim below is based on an unobserved screenshot. Phase C/D must re-check these findings with screenshots or golden tests.

## Role and super-admin breakage

### Current behavior

- `server/middleware/auth.js` correctly requires an explicit sector context for a `super_admin` on sector-scoped routes, but `public/js/app.js` still treats the role badge as only `admin` versus `reader` and has no platform landing state.
- `public/index.html` opens the normal finance shell for every authenticated user. The only platform navigation is the recently added hidden Sector admin link; there is no platform overview, sector context banner, enter/exit flow, or platform system-status view.
- `public/views/dashboard.html` and `mobile/lib/src/screens.dart` assume a selected reporting month and sector finance data. A super-admin without `X-Sector-Id` therefore cannot use the normal dashboard safely; this is correct fail-closed behavior but an incomplete product experience.
- `mobile/lib/src/session.dart` stores `systemRole`, while the shell still renders the ordinary five-destination finance navigation and exposes platform management only as a More action. There are no mobile platform overview, sector detail, users, audit, backup, or context-banner screens.
- `server/routes/admin.js` currently supports sector list/create/activate/deactivate, secretary create/reset, and audit-log retrieval. It does not yet provide SQL-aggregated platform overview, sector summary, user management, explicit enter/exit context state, or backup/system-status presentation.
- `server/routes/auth.js` returns `systemRole` and `sectorId`, but the web session does not persist a selected super-admin sector context; context is request-header driven and must be made visible and persistent in the UI.

### Required fixes

1. Add a platform console landing state for `super_admin`, separate from a sector dashboard.
2. Add explicit enter-sector/exit-sector state and a persistent context banner on web and mobile.
3. Add platform overview, sector KPIs, users, audit, backup, and system-status surfaces.
4. Preserve the existing 4xx fail-closed behavior when a super-admin has no selected sector.

## Web audit by screen and breakpoint

Breakpoints audited: 360px, 768px, 1024px, and 1440px.

| Screen / files | 360px | 768px | 1024px | 1440px | Priority |
|---|---|---|---|---|---|
| Login — `public/login.html`, `public/css/style.css` | Form and explanatory copy compete for short vertical space; password-change form needs a clear step indicator and long-password wrapping. | Empty side space is not used for trust/status context. | Login remains a centered single-purpose surface rather than adapting to a two-column brand panel. | Large blank canvas makes the experience feel like a utility page. | P1 |
| Shell/nav — `public/index.html`, `public/js/app.js`, `public/css/style.css`, `public/css/responsive.css` | Bottom More sheet and header actions must avoid safe-area overlap; long labels can clip. | Sidebar/bottom-nav transition needs a tested intermediate state. | Sidebar collapse and content width need a measured breakpoint contract. | Persistent sidebar, command center, and top header compete for attention; no platform context banner. | P1 |
| Dashboard — `public/views/dashboard.html`, `public/js/dashboard.js` | KPI cards and chart labels can compress; tables need local horizontal scroll only. | Toolbar and comparison controls can wrap into uneven rows. | Two-column grids need explicit min-widths and chart height constraints. | Excess card chrome and competing hero/metric hierarchy reduce scan speed. | P1 |
| Members — `public/views/members.html`, `public/js/members.js` | Search/filter/action rows are dense; member detail dialogs need keyboard-safe scrolling. | Toolbar wrapping can create a second visual header. | Table and detail panel need a stable split contract. | Wide table leaves low-information columns visually dominant. | P1 |
| Expenses — `public/views/expenses.html`, `public/js/expenses.js` | Form controls and date/category fields risk clipping at 360px. | Filter/action wrapping needs consistent order. | Table density needs a readable column priority. | Summary and ledger hierarchy is flat. | P1 |
| Reports — `public/views/reports.html`, `public/js/reports.js` | Export controls and long narrative text need stacked layout. | Chart/table controls need a single responsive row. | Comparison panels need equal-height and overflow-safe cards. | Report whitespace and action hierarchy need stronger grouping. | P2 |
| Special Fund — `public/views/special-fund.html`, `public/js/special-fund.js` | Campaign metadata and Urdu/WhatsApp copy can overflow; contribution form needs bottom-sheet keyboard handling. | Member target cards need a two-column-to-one-column rule. | Ledger and campaign summary need independent scroll regions. | Hero campaign area should be more purposeful and less card-repetitive. | P1 |
| Settings — `public/views/settings.html`, `public/js/settings.js` | Long labels and template editors need full-width stacking. | Form grid can leave uneven columns. | Diagnostics and templates need clearer task grouping. | Large form page lacks a persistent save/status summary. | P2 |
| Sector admin — `public/views/admin.html`, `public/js/admin.js` | Current table is not a complete mobile console; one-time password uses a browser prompt and has no copy affordance. | Table/actions need a card/list transformation. | Needs KPI summary, filters, and detail drawer. | Needs platform overview and persistent context rather than a CRUD-only page. | P0 |

Global web defects: the current CSS is emerald/teal, semantic danger uses red while brand is being changed to red, table overflow behavior is inconsistent across views, and there is no tested dark-mode token system in the web shell. Asset versioning exists in `public/js/app.js` and `public/sw.js` and must be retained.

## Flutter audit

Breakpoints: small phone (320–359), regular phone (360–599), tablet (600–1023), and large text scales 1.3–2.0 in both light and dark modes.

- Theme — `mobile/lib/src/theme.dart`: tokens are still emerald/teal/cyan/indigo; compatibility aliases named `blood` and `crimson` conceal the actual palette. Replace them with explicit red tokens and keep success/warning/info/error semantically distinct.
- Shell — `mobile/lib/src/screens.dart`: five destinations are appropriate for sector users but do not express a platform console for super-admins. More is a long scrolling composition and currently hosts the sector-admin action rather than a first-class platform route.
- Platform admin — `mobile/lib/src/screens.dart`: `AdminScreen` only lists/creates sectors. It lacks overview KPIs, sector detail, user reset/deactivation, audit filters, backup/status, enter/exit context, and one-time password copy UX.
- Forms/sheets — `mobile/lib/src/parity_screens.dart` and `screens.dart`: long forms and modal sheets need explicit max-width, keyboard inset, and text-scale tests; existing code has informational/deprecation lints that can obscure layout regressions.
- Tables/ledgers — activity and member history rely on dense rows; at 2.0 text scale these require semantic wrapping and no fixed-height assumptions.
- Charts/cards — dashboard chart and metric cards need bounded widths on tablets and a zero-data state that remains readable in both themes.
- Login/forced password — `screens.dart`: the flow exists, but the new platform role needs a distinct post-login landing and context explanation.

## Visual-evidence attempt

No new Playwright dependency was added in Phase A. The existing browser automation path was previously unavailable in this environment (Chrome/in-app browser assets could not initialize). Flutter has no active emulator/device session. Phase C/D must use Playwright or document the same failure with command output, and must add widget/golden coverage for the specified widths and text scales before claiming visual completion.

## Prioritized worklist

- P0: platform landing/context model, sector admin mobile/web completeness, red semantic tokens, and safe one-time-password UX.
- P1: shell/nav, dashboard, members, expenses, special fund, and responsive table/form behavior.
- P2: reports/settings hierarchy, dark-mode polish, and reduced-motion/large-text refinement.
