# Web → Mobile Feature Parity

Last verified: 2026-09-28

## Available in mobile

- Secure login, restored-session validation, global 401 sign-out, and read-only role enforcement.
- Month-aware dashboard totals, cash-flow chart, activity, pull-to-refresh, loading, empty, error, and offline states.
- Member search/status filters, add/edit/delete, cumulative payment entry, member-specific WhatsApp, and follow-up logging.
- Member history grouped into expandable monthly records plus a reminder/reply timeline.
- Expense creation and month-filtered expense ledger.
- Dedicated Special Fund screen with campaign totals, member targets/balances, contribution entry, ledger, member appeal, and report sharing.
- Monthly report summary and WhatsApp report sharing. Every report template receives `{date}` and `{report_period}` values.
- Editable templates for regular member, report sharing, monthly report, Special Fund appeal, and Special Fund report messages.
- Template variable chips, tap-to-insert, preview, reset, validation, save, and unsaved-change confirmation.
- Organization/payment defaults, month creation, diagnostics/repair actions, and persisted System/Light/Dark appearance.
- A first-class Assistant destination with bounded six-message context, validated action cards, explicit confirmation for persistent changes, reviewed individual/bulk WhatsApp drafts, anomaly review, and server-enforced reader restrictions.
- Mobile networking now matches the web client’s 15-second timeout and identical-GET de-duplication behavior; superseded month loads are cancelled and stale responses remain rejected.
- Super-admins can open Sector administration from More to list/create sectors; the web client additionally supports activation, secretary provisioning/reset, and audit-log review. Secretary credentials are one-time and must be changed after first login.

## Web-only or intentionally deferred

- CSV, Excel, and generated PDF file download/share. The current export endpoints require bearer authentication and the mobile client does not yet implement authenticated binary downloads.
- Bulk-opening multiple WhatsApp reminder conversations. Mobile exposes safe member-by-member messaging to avoid OS popup/rate-limit problems.
- Editing/deleting existing follow-up rows. The backend only exposes follow-up creation.
- Push notifications and password reset. No matching backend APIs exist.
- Permanent sector deletion is intentionally unavailable; deactivation preserves auditability and prevents new access.

## Business rules preserved

- A payment updates cumulative `Amount Paid`, not an incremental installment.
- New-member payable equals monthly fund plus previous balance.
- Special Fund entries require a campaign, member, and amount greater than zero.
- WhatsApp phone numbers normalize Pakistani local mobile numbers to country code `92`; invalid/missing numbers are blocked.
- Readers can view finance data and templates but cannot mutate records, settings, diagnostics, or campaigns.
- Super-admin finance requests require an explicit active sector selection; secretary and reader requests are always bound to their own sector, including AI context and exports.
- Release builds require an explicit HTTPS `API_BASE_URL`; the emulator address is debug-only.
