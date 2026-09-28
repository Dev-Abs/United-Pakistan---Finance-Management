# Revamp and deferred-feature phase status

Updated 2026-09-28. This is an evidence register, not a claim that every phase is complete.

| Phase | Verified in repository/live environment | Remaining evidence or owner action |
|---|---|---|
| B | Super-admin overview, sector summaries/users, status, audit, explicit sector context, SQL aggregation, role guards | Full pagination/filter UI and production E2E still needed |
| C | Red CSS/manifest tokens, admin console, context banner, responsive shell primitives, authenticated exports/notifications | Browser screenshots, keyboard audit, all-view visual pass unavailable |
| D | Flutter red theme, super-admin entry, notification screen, refresh/session behavior, tests/analyze previously passing | Real device, large-text overflow and golden evidence unavailable |
| E | Migration/auth/team/refresh/idempotency live smoke checks; README and parity docs updated | Full three-role walkthrough on deployed web/mobile remains |
| F | Short access JWTs, rotating refresh tokens, lockout, password change, durable audit/idempotency, rotation runbook | Postgres RLS is not enabled; distributed lockout and production revocation still need deployment verification |
| G | Secretary/super-admin team APIs, one-time credentials, audit/idempotency, super-admin account table | Secretary team-management screens and full route × role matrix remain |
| H | Authenticated CSV/Excel/PDF exports with audit, request/approve onboarding, sector notifications web/Flutter | FCM, scheduler, SSO, deeper cross-sector reports require owner accounts/configuration |
| I | Security rotation docs, unrelated-issues register, health/deploy guidance, syntax/test checks | Flutter informational lints, release keystore/build warning, deployment-backed integration suite remain |
| J | Core API/auth/migration smoke coverage documented in project context | Final web/mobile E2E, production export/backup and session-revocation walkthrough remain |

## Current verification

- Node suite: 52/52 passing.
- Touched JavaScript syntax checks pass.
- Flutter analysis/tests have completed without reported failures in the available environment.
- Live migrations through `005_sector_onboarding.sql` are applied.
- No production deployment, Firebase project, OAuth client, release keystore, or real-device/browser screenshot session was accessed by this agent.
