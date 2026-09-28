# Revamp and deferred-feature phase status

Updated 2026-09-28. This is an evidence register, not a claim that every phase is complete.

| Phase | Verified in repository/live environment | Remaining evidence or owner action |
|---|---|---|
| B | Super-admin overview, sector summaries/users, status, audit, explicit sector context, SQL aggregation, role guards, audit filtering/pagination, and sector search/status filtering with bounded pagination | Production E2E still needed |
| C | Red CSS/manifest tokens, admin console, context banner, responsive shell primitives, authenticated exports/notifications | Browser screenshots, keyboard audit, all-view visual pass unavailable |
| D | Flutter red theme, super-admin entry, notification screen, refresh/session behavior, secretary team management, explicit-sector super-admin team entry, tests/analyze previously passing | Real device, large-text overflow and golden evidence unavailable; current Flutter tool invocation stalled without output |
| E | Migration/auth/team/refresh/idempotency live smoke checks; secretary/super-admin/read-only role contracts, forced-password flow, cross-sector denial, team provisioning/reset/deactivation, inactive-login rejection, and explicit-sector super-admin access pass live under RLS; README and parity docs updated | Deployed web/mobile UI walkthrough remains |
| F | Short access JWTs, rotating/revocable refresh tokens, server/web/mobile logout revocation, durable database-backed login lockout, password change, durable audit/idempotency, rotation runbook; all route-facing finance reads/writes carry transaction-local sector/role context; finance-table RLS is enabled and live isolation smoke passes | Set `DATABASE_RLS_ROLE=authenticated` in every deployed runtime and re-smoke that deployment; deployed UI logout walkthrough remains |
| G | Secretary/super-admin team APIs, one-time credentials, audit/idempotency, super-admin account table, Settings-based web read-only account UI, Flutter secretary team management, explicit-sector Flutter super-admin team entry, and live route × role smoke under RLS | Deployed UI walkthrough remains; Flutter device walkthrough unavailable |
| H | Authenticated CSV/Excel/PDF exports with audit, request/approve onboarding, sector notifications web/Flutter | FCM, scheduler, SSO, deeper cross-sector reports require owner accounts/configuration |
| I | Security rotation docs, unrelated-issues register, health/deploy guidance, syntax/test checks | Flutter informational lints, release keystore/build warning, deployment-backed integration suite remain |
| J | Core API/auth/migration smoke coverage documented in project context | Final web/mobile E2E, production export/backup and session-revocation walkthrough remain |

## Current verification

- Node suite: 57/57 passing; production dependency audit reports 0 vulnerabilities; every server JavaScript file passes `node --check`.
- Reproducible `npm run verify:release` passes in default mode and live mode (`VERIFY_LIVE=true DATABASE_RLS_ROLE=authenticated`), including tests, audit, all server syntax checks, RLS role/isolation smoke, and Phase 2 role smoke.
- The release gate's Windows npm invocation was hardened to avoid the prior child-shell deprecation warning; default verification now passes cleanly.
- Post-cleanup live verification also passes end to end with `VERIFY_LIVE=true DATABASE_RLS_ROLE=authenticated`.
- Owner-only completion steps are now executable in `OWNER_COMPLETION_RUNBOOK.md`; deployment/browser/device/provider evidence remains intentionally unclaimed until the artifacts exist.
- Post-runbook integrity check passes: `git diff --check` and default `npm run verify:release` both succeed.
- Touched JavaScript syntax checks pass.
- Flutter analysis/tests are currently unverified: after stale Dart processes were stopped, a fresh `flutter test --no-pub` produced no output and remained live after a bounded 30-second wait, so it was stopped and no pass is claimed.
- Live migrations through `006_auth_login_attempts.sql` are applied; hosted finance-table RLS is enabled and database isolation smoke passes through the restricted Supabase `authenticated` role. Fresh `db:check-rls-role` reports `rlsEnforcementReady: true`; fresh `smoke:rls` passes with 0 missing-context rows, 3 scoped rows, 0 forged cross-sector rows, super-admin visibility, and support-table access.
- Fresh `smoke:phase2` with `DATABASE_RLS_ROLE=authenticated` passes secretary/super-admin login, cross-sector rejection, empty-sector isolation, read-only write denial, forced-password flow, stable client roles, and the complete team role matrix.
- A Vercel deployment exists, but its current environment was not read back here; `DATABASE_RLS_ROLE=authenticated` still needs deployment confirmation. No Firebase project, OAuth client, release keystore, or real-device/browser screenshot session was accessed by this agent.
- Flutter team management now supports read-only account listing, creation, one-time credential display/copy, password reset, and activation/deactivation. Secretaries reach it from More; super-admins reach it by opening a sector from mobile Sector administration, which supplies an explicit `X-Sector-Id` header. `ApiClient` now supports per-request headers. `npm test` passes 57/57; Flutter formatter/analyzer/test invocations produced no output within the available tool window and are not claimed as passing.
