# Manual, API, and assistant capability matrix

Last audited: 2026-09-26. “Proposal” means the assistant can prepare a reviewable result but the general command center cannot execute it.

| Feature | Manual UI | API | AI read | AI write/action | Role | Tests / outstanding gap |
|---|---|---|---|---|---|---|
| Months and dashboard | Yes | Read/create | Reads selected month and aggregates | Proposal only for create | Admin create; reader read | Month ordering/stale-response tests pass; AI execution open |
| Members | Add/edit/delete/search/detail | CRUD | Reads bounded authorized records | Proposal only | Admin write; reader read | Server write authorization exists; destructive/concurrency tests incomplete |
| Monthly payments | Cumulative entry | Atomic conditional update after Apps Script redeploy | Reads balances/history | Assisted-entry confirmation executes normal API | Admin write; reader read | Installment conversion and stale-month tests pass; live conflict test pending |
| Expenses | Add/edit/delete/list | CRUD | Reads records and duplicate review | Assisted-entry confirmation can add; general edits are proposals | Admin write; reader read | AI proposal validation tested; write idempotency open |
| Follow-ups | Add/timeline | Read/add | Reads records | Proposal only | Admin write; reader read | Crafted reader mutation coverage incomplete |
| Special Fund | Campaign/contribution UI | Contribution CRUD/settings | Reads campaign/contributions | Proposal only | Admin write; reader read | Live persistence and conflict coverage pending |
| Templates | Five types, preview/save/reset | Settings merge | Reads supplied template settings | Proposal only; cannot truthfully save from chat | Admin write; reader read | Placeholder regression exists; AI save execution open |
| Reports/exports | Reports and web exports | Authenticated CSV/XLSX/PDF routes | Reads aggregates/source records | Report text/copy proposal only | Both read | Mobile native download/share pipeline open |
| Appearance | System/Light/Dark | Local secure preference | Not needed | Manual only; AI action open | Both | Rapid switch and persistence-error tests pass; restart/device test pending |
| Assistant briefings/chat/drafts | Dedicated workspace | DeepSeek routes behind flags | Yes | Entry confirmation for payment/expense only | Reads by role; controlled bulk drafts admin | 12 mocked Node tests; no live DeepSeek verification |
| Authentication/session | Login/restore/logout | Shared bearer tokens | N/A | N/A | Admin/reader | 401 clears session; expiring tokens and durable audit are open |

## Safe production boundary

Keep `AI_CONTROLLED_ACTIONS_ENABLED=false` until the application has expiring actor-bound authentication plus persistent confirmation, idempotency, and audit records. Model output is never an authorization decision, and no command proposal should be treated as completed until the normal service verifies the persisted record.
