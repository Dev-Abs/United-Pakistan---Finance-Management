# Mobile product audit

## Product and users

United Pakistan Finance Management replaces a monthly spreadsheet and WhatsApp workflow. Administrators maintain member dues, payments, expenses, reminders, campaign contributions, reports, monthly rollover, and organization configuration. Read-only users can inspect the same operational data and exports but cannot mutate it.

Authentication is a username/password exchange against the Express API. The returned bearer token identifies either `admin` or `reader`; all data is proxied through Express to Google Apps Script and Google Sheets.

## Core entities

- Month: one Google Sheet tab and the primary reporting context.
- Member: name, phone, category, monthly fund, previous balance, total payable, paid amount, remaining balance, status, date, and remarks.
- Payment: an update to a member's month record with derived balance and status.
- Follow-up: reminder/reply history, reason, next reminder date, and awaiting-reply state.
- Expense: dated categorized outflow with amount, payment method, payee, and remarks.
- Special-fund campaign: configured campaign identity, thresholds, appeal text, contributions, targets, and progress.
- Settings: organization identity, payment details, defaults, and campaign configuration.

## Important workflows

1. Review current month health: collected, outstanding, expenses, net balance, overdue members, and recent activity.
2. Find a member, inspect status/history, record a full or partial payment, send/copy a WhatsApp reminder, and log the response.
3. Add, edit, or remove a member.
4. Record, edit, filter, and delete an expense.
5. Review campaign progress, inspect member targets, record/edit/delete contributions, and share the Urdu appeal.
6. Generate reports and export members or expenses as CSV, Excel, or PDF.
7. Create a new month and optionally carry outstanding balances.
8. Update organization/campaign settings and run diagnostics/repair.

## Backend constraints and risks

- Tokens are static secrets and have no expiry or refresh endpoint. Mobile stores the token securely and validates it with `/api/auth/status`, but true refresh and password reset require backend work.
- Forgot/reset-password and notifications have no server APIs. The mobile UI explains the support path; it does not invent an authentication or notification system.
- Google Sheets calls can be slow; mobile needs explicit timeouts, cached last-known data, retry, stale-data labeling, and pull-to-refresh.
- Export endpoints return files; Android storage/share handling is required.
- Mutating operations are forbidden for the reader role and must be removed or disabled in the UI in addition to server enforcement.

## Mobile prioritization

P0: login/session restore, dashboard, month switching, members, payment recording, reminders, expenses, campaign overview/contributions, read-only enforcement, offline/stale behavior.

P1: reports and exports, member history, settings/profile, month rollover, diagnostics.

P2 (backend-dependent): real password reset, push notifications, token refresh, server-backed audit feed, biometric re-authentication policy.
