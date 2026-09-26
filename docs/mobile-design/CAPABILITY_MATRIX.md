# Manual, API, and assistant capability matrix

Last audited: 2026-09-26. AI-originated mutations require an explicit mobile confirmation and then use the same authorized route as the manual UI. WhatsApp actions only open a reviewed draft; delivery cannot be verified by the app.

| Feature | Manual UI | API | AI read | AI write/action | Role | Tests / outstanding gap |
|---|---|---|---|---|---|---|
| Months and dashboard | Yes | Read/create | Reads month metadata and aggregates | Select after review; create after confirmation | Admin create; reader read | Month ordering/stale-response tests pass |
| Members | Add/edit/delete/search/detail | CRUD | Reads bounded authorized records | Proposal only | Admin write; reader read | Server write authorization exists; destructive/concurrency tests incomplete |
| Monthly payments | Cumulative entry | Atomic conditional update after Apps Script redeploy | Reads balances/history | Structured review → confirm → existing payment API | Admin write; reader read | Amount bounds validated server-side; live Sheets conflict test pending |
| Expenses | Add/edit/delete/list | CRUD | Reads records and duplicate review | Structured review → confirm → existing expense API | Admin write; reader read | AI payload validation tested; durable idempotency remains open |
| Follow-ups | Add/timeline | Read/add | Reads records | Structured review → confirm → existing follow-up API | Admin write; reader read | Reader mutation proposals are stripped server-side |
| Special Fund | Campaign/contribution UI | Contribution CRUD/settings | Reads campaign/contributions | Reports/messages; contribution review → confirm → existing API | Admin write; reader read | Live persistence/conflict coverage pending |
| Templates | Five operational types, preview/save/reset | Settings merge | Reads supplied templates | Draft/edit/preview in chat; explicit save confirmation | Admin write; reader read | Keys are allow-listed; placeholder regression passes |
| Reports/exports | Reports and web exports | Authenticated CSV/XLSX/PDF routes | Reads aggregates/source records | Report draft/copy and reviewed WhatsApp open | Both read | Mobile native binary download/share remains open |
| Appearance | System/Light/Dark | Local secure preference | Not needed | Manual only; AI action open | Both | Rapid switch and persistence-error tests pass; restart/device test pending |
| Assistant briefings/chat/drafts | Dedicated primary navigation workspace | DeepSeek routes behind flags | Members, ledgers, follow-ups, settings, campaigns, templates, months/activity | Structured confirmed actions; bulk drafts never auto-send | Reads by role; controlled bulk drafts admin | 17 mocked Node tests; no live DeepSeek request performed |
| Authentication/session | Login/restore/logout | Shared bearer tokens | N/A | N/A | Admin/reader | 401 clears session even on secure-storage failure; expiring tokens/durable audit remain open |

## Safe production boundary

Keep `AI_CONTROLLED_ACTIONS_ENABLED=false` until bulk previews are management-tested. Individual command actions are validated server-side, explicitly confirmed in Flutter, and then submitted through normal authorized routes; model output is never an authorization decision. Durable actor-bound audit and idempotency are still required before unattended actions, automatic retries, or direct sends are considered.
