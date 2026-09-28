# Owner completion runbook for phases B–J

This checklist covers the evidence that cannot be produced from the repository-only environment. It does not contain credentials or tokens.

## 1. Deploy with RLS enforcement

In the Vercel project settings, set the production variable `DATABASE_RLS_ROLE` to `authenticated`, confirm the existing private database/auth variables, and redeploy. From a machine with the production URL and database environment available, run:

```powershell
$env:DATABASE_RLS_ROLE="authenticated"
npm run db:check-rls-role
npm run smoke:rls
npm run smoke:phase2
```

Expected evidence: `rlsEnforcementReady: true`, zero missing-context rows, zero forged cross-sector rows, and all Phase 2 smoke flags true. Open `/api/health` and confirm HTTP 200 before the role smoke.

## 2. Web walkthrough (B, C, E, F, G, J)

Using one super-admin, one secretary, and one read-only account in a non-production test sector:

1. Sign in and enter a sector from the platform console.
2. Verify sector search/filter/pagination, account status, audit filters, and the context banner.
3. Create, reset, deactivate, and reactivate a read-only account from Settings.
4. Trigger CSV, Excel, and PDF exports; confirm downloads, audit rows, and sector scoping.
5. Sign out, then confirm the prior refresh token cannot rotate.
6. Repeat at 360px, 768px, 1024px, and 1440px widths; tab through command palette, dialogs, and credential controls.

Capture screenshots and the browser console result for each step. Any failed step is a release blocker.

## 3. Flutter/device walkthrough (D, G, H, J)

Build with the deployed HTTPS origin:

```powershell
cd mobile
flutter pub get
flutter build apk --release --dart-define=API_BASE_URL=https://<production-origin>
```

On a real Android device, verify login/session restore, theme persistence, notifications, secretary Team management, super-admin sector entry, read-only denial, WhatsApp intents, report/special-fund flows, retry states, and rapid tab switching. Repeat at large text scale and in light/dark themes. Store screenshots plus the APK build output.

## 4. External providers and deferred capabilities (H, I)

Only after owner approval: configure Firebase for push delivery, an OAuth client for SSO, and a scheduler for notifications. Keep AI disabled until the documented data boundary is approved. Record provider project IDs and deployment timestamps, never secrets, in the release ticket.

## 5. Final sign-off

Attach the deployment URL, live smoke output, browser/device screenshots, APK checksum, and provider configuration evidence to the release record. Update `PHASE_STATUS.md` only after each artifact exists; do not convert unavailable evidence into a completion claim.
