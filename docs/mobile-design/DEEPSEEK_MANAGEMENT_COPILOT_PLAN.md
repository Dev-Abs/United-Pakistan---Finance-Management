# DeepSeek Management Copilot Plan

Last reviewed: 2026-09-26

## Goal

Add an Urdu/English management copilot to the Flutter app that reduces repetitive work without allowing an AI model to silently change financial records. The assistant should explain live finance data, prepare follow-ups and reports, help fill forms, and highlight records that need attention.

Phases 0–3 are implemented behind the server-side feature flag: read-only briefings/drafts/narratives, parse-to-confirm entry, deterministic anomaly review, and short-retention aggregate chat. The safe Phase 4 subset (admin-only bulk draft preparation) is implemented behind a second disabled-by-default action flag. Automatic sending, direct model writes, voice input, and scheduled unattended work remain out of scope until their documented platform prerequisites exist.

## Non-negotiable architecture

```text
Flutter app
  -> authenticated United Pakistan Express API
      -> reads only the minimum required data from Google Sheets
      -> sends a minimized/redacted payload to DeepSeek
      -> validates the model's structured response
      -> returns a safe preview to Flutter
      -> existing finance route performs a write only after admin confirmation
```

- Never put `DEEPSEEK_API_KEY` in Dart, `--dart-define`, the APK, Google Sheets, Apps Script, source control, or `PROJECT_CONTEXT.md`.
- Store the key only as a server-side Vercel environment variable. Use `DEEPSEEK_API_KEY`, plus configurable `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL` values.
- The mobile client must never call DeepSeek directly. An APK can be inspected and a bundled key can be stolen.
- Protect every AI route with the existing `requireAuth` middleware. Draft/read operations may be available to readers if desired; execution remains admin-only through `requireWriteAccess`.
- Do not give the model direct database, Sheets, or existing write-route access. The server owns all data fetching, calculation, validation, authorization, and writes.
- AI output is advisory. Existing deterministic calculations remain the source of truth for totals, balances, status, IDs, dates, and permissions.

## Recommended first release

### 1. Management briefing

Add an **AI Briefing** card to the dashboard with actions for “Today”, “This month”, and “Compare with previous month”. The backend calculates the figures and DeepSeek turns them into a concise Urdu, English, or mixed-language briefing:

- cash collected, expenses, cash balance, and collection rate;
- paid, partial, and pending member counts;
- largest outstanding balances and follow-ups due;
- Special Fund progress;
- unusual conditions, with links to the relevant app screens;
- three suggested management priorities.

The model receives aggregate figures by default. Member names or phone numbers are included only when the user explicitly asks for member-level follow-up help.

### 2. Smart reminder drafts

From a member detail page or a filtered pending-members list, generate a respectful Urdu/English WhatsApp reminder using the existing organization settings and message templates. Show the exact recipient, amount, balance, and message in a review sheet. The user taps **Open WhatsApp**; the AI never sends a message itself.

Support tones such as polite, concise, firm, and campaign appeal. Keep financial values server-supplied and immutable in the preview so the model cannot invent amounts.

### 3. Report narrative

On Reports and Special Fund, add **Generate summary**. DeepSeek explains server-calculated totals, trends, collection performance, and next actions. The result can be copied or shared. It must label the reporting month and generation time and state when data is incomplete.

### 4. Assisted expense and payment entry

Allow natural-language input such as “Printing expense 3,500 today, paid cash” or “Ahmed has now paid 2,000 for September”. DeepSeek converts it to a proposed JSON form. Flutter opens the normal payment/expense sheet with fields populated but editable.

- The user must confirm the member, reporting month, amount meaning, date, category, and remarks.
- For member payments, explicitly distinguish **new installment** from the backend's current **cumulative Amount Paid** field. The server, not the model, computes any new cumulative value.
- Submission uses the existing `/api/payments/:id` or `/api/expenses` route after confirmation.

### 5. Data-quality assistant

Use deterministic checks first, then ask DeepSeek to explain the findings and propose next steps:

- negative or non-numeric amounts;
- paid amount greater than payable amount;
- missing/invalid dates or months;
- possible duplicate expenses or contributions;
- members with overdue balances and no recent follow-up;
- sudden expense or collection changes compared with recent months.

Never auto-repair records. Link each finding to a review screen and require normal edit/delete confirmation.

## Later release, after the first release is trusted

- A scoped chat screen with suggested questions such as “Who needs follow-up this week?” and “Prepare the September committee briefing.”
- Bulk reminder preparation, with a separate preview for every recipient; no automatic bulk sending.
- Voice-to-draft using device speech-to-text, feeding only the transcript into the same assisted-entry flow.
- Scheduled weekly briefing generated by the backend, only after a proper job scheduler, audit storage, and notification API exist.
- Tool/function calling only for read-only data tools at first. Any proposed mutation must become a typed confirmation card and go through existing validated routes.

## API design

Create `server/routes/ai.js` and `server/services/deepseek.js`.

Initial endpoints:

- `GET /api/ai/capabilities` — enabled state, model label, supported features, and user-visible privacy note; never expose the key.
- `POST /api/ai/briefing` — accepts month, comparison period, language, and detail level.
- `POST /api/ai/message-draft` — accepts a member row ID or server-known member identity, message purpose, tone, and language.
- `POST /api/ai/report-summary` — accepts report type, month/date range, and language.
- `POST /api/ai/parse-entry` — accepts short natural language and returns a proposed typed form; does not write.
- `POST /api/ai/data-review` — runs deterministic validations and optionally asks the model to explain them.

Use a common response envelope:

```json
{
  "success": true,
  "data": {
    "kind": "briefing",
    "content": "...",
    "facts": {},
    "warnings": [],
    "suggestedActions": [],
    "generatedAt": "ISO-8601 timestamp"
  },
  "usage": {
    "requestId": "opaque-id",
    "model": "configured-server-model"
  }
}
```

For parse/draft endpoints, require JSON output and validate it against a local schema before returning it. Reject missing, extra, invalid, or out-of-range fields. Do not trust model-provided row IDs, roles, totals, or authorization decisions.

## DeepSeek configuration

Suggested production variables:

```text
DEEPSEEK_API_KEY=<set only in Vercel/project secrets>
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=<current model selected after a small quality/cost evaluation>
AI_FEATURES_ENABLED=true
AI_DAILY_REQUEST_LIMIT=<chosen budget guard>
AI_MAX_INPUT_CHARS=<chosen privacy/cost guard>
```

Do not hardcode a model name into Flutter. DeepSeek's available model names, behavior, and prices can change; keep selection server-side and verify against the official documentation at implementation time. Use a faster/lower-cost model for drafts and summaries, and reserve a reasoning-capable option for complex analysis only if evaluation proves it useful.

Set short connection/response timeouts, one safe retry for transient 429/5xx failures with jitter, an abort path, and a friendly “AI is temporarily unavailable” state. Core finance workflows must continue to work when AI is disabled, out of credit, rate-limited, or offline.

## Prompt and data rules

- Build versioned server-side prompts; never accept a client-supplied system prompt.
- Instruct the model to use only supplied facts, say when data is insufficient, preserve PKR values exactly, and avoid legal/accounting claims.
- Prefer aggregates and opaque internal IDs. Remove phone numbers, credentials, tokens, free-form sensitive remarks, and unrelated records before calling DeepSeek.
- Ask for a language explicitly: Urdu, English, or bilingual. Test Urdu script, names, currency formatting, and right-to-left rendering.
- Use identical stable prompt prefixes where practical so DeepSeek's automatic context caching can reduce repeated-input cost, while keeping user/request isolation identifiers free of personal information.
- Treat all model text as untrusted content: render it as plain text, limit its length, and never interpret it as HTML, Markdown commands, URLs to open automatically, or executable instructions.

## Security, privacy, and governance

Before production, management must decide what organizational/member data is permitted to leave the backend for DeepSeek processing. Record that policy in the UI and project documentation. If member-level data is not approved, restrict AI to aggregate reports and user-entered text.

Add:

- per-user and per-IP rate limits on AI routes;
- request size and output-token limits;
- an allowlist of supported AI operations;
- audit records containing request ID, authenticated role, operation, month, status, latency, and token counts—but not the API key, full prompt, full response, phone number, or raw financial record;
- a budget ceiling and a server-side kill switch;
- a clear “AI-generated—review before use” label;
- privacy-safe error logging;
- tests proving readers cannot execute writes and AI routes cannot bypass existing authorization.

The current static bearer-secret authentication is a wider production risk: the same long-lived admin token is returned to every admin login. Before advanced tool execution or broad distribution, replace it with expiring per-login sessions/tokens, revocation, and stronger credential storage.

## Mobile UX

- Add an **Assistant** entry under More initially; do not displace the four primary tabs until usage justifies it.
- Put contextual AI actions on Dashboard, Member Detail, Reports, Special Fund, Payment, and Expense screens.
- Use structured cards rather than an open-ended chatbot for the first release.
- Every write-capable suggestion follows: **Ask -> Preview -> Edit -> Confirm -> Existing API write -> Success/audit reference**.
- Show source scope (“September 2026, 42 members, refreshed 10:32”) so the manager knows what the answer covers.
- Provide retry, copy, share, thumbs-up/down, and “report incorrect result” controls. Never block normal pages behind an AI request.

## Delivery phases and acceptance gates

### Phase 0 — policy and foundation

- Rotate the credentials already identified as exposed before production.
- Add server-only configuration, DeepSeek service wrapper, timeout/retry/error mapping, feature flag, rate limiting, redaction, audit metadata, and mocked tests.
- Gate: the key is absent from the repository and APK; app behavior is unchanged when AI is disabled.

### Phase 1 — safe productivity wins

- Implement briefing, individual reminder drafts, and report narrative.
- Gate: all numeric claims can be traced to server-calculated facts; no AI endpoint writes data; Urdu/English output passes management review.

### Phase 2 — assisted entry and quality review

- Implement parse-to-form and deterministic anomaly review. **Implemented:** strict JSON parsing, local allowlist validation, server-calculated cumulative payments, editable mobile confirmation, and deterministic member/expense checks.
- Gate: malformed model output is rejected; no proposal is submitted without an explicit editable confirmation; cumulative payment semantics are tested.

### Phase 3 — scoped conversational assistant

- Add read-only tools and multi-turn context with strict data scopes, short retention, and cost limits. **Implemented:** aggregate-only monthly chat with six-message request-local context, existing input/output/rate limits, and no server-side conversation retention.
- Gate: prompt-injection tests cannot access secrets, unrelated records, or write operations.

### Phase 4 — controlled actions/automation

- Consider bulk drafts, scheduled briefings, and typed action proposals only after stronger authentication and an audit store are deployed. **Partially implemented:** admin-only bulk draft preparation returns one validated preview per outstanding member and is protected by `AI_CONTROLLED_ACTIONS_ENABLED=false`. It never sends. Scheduling and unattended mutations remain blocked on stronger authentication, durable audit storage, notification delivery, and a scheduler.
- Gate: every external message or financial mutation remains individually reviewable, attributable, reversible where possible, and enforced by server authorization.

## Verification plan

- Unit tests with a mocked DeepSeek server for success, timeout, empty output, malformed JSON, truncated JSON, 401/429/5xx, and disabled/no-key states.
- Schema and prompt tests for Urdu/English output, exact PKR values, missing data, hostile remarks/prompt injection, and excessive payloads.
- Authorization tests for admin versus reader and confirmation/write boundaries.
- Integration tests proving a parse request cannot write to Sheets and a confirmed form still uses the existing finance route.
- Mobile widget tests for loading, preview, edit, confirmation, offline, retry, and AI-disabled states.
- A small evaluation set of real-shaped but anonymized scenarios, scored by management for correctness, tone, usefulness, and hallucination rate before enabling production.
- Monitor latency, failure rate, token usage, cache hits, cost per operation, user corrections, and disabled/fallback behavior.

## Recommended implementation order

1. Approve the external-data/privacy boundary and rotate exposed credentials.
2. Implement the server wrapper, feature flag, redaction, audit metadata, limits, and mock tests.
3. Ship dashboard briefing and single-member reminder drafting behind the flag.
4. Evaluate results with anonymized cases, then add report narratives.
5. Add parse-to-form and deterministic review only after the read-only features are trusted.
6. Revisit conversational tools and automation after authentication is upgraded.

## Official DeepSeek references to re-check during implementation

- API base/compatibility and model pricing: <https://api-docs.deepseek.com/quick_start/pricing/>
- Chat Completions and structured response options: <https://api-docs.deepseek.com/api/create-chat-completion/>
- JSON output requirements and caveats: <https://api-docs.deepseek.com/guides/json_mode/>
- Tool/function calling: <https://api-docs.deepseek.com/guides/tool_calls/>
- Rate-limit/user isolation: <https://api-docs.deepseek.com/quick_start/rate_limit/>
- Automatic context caching: <https://api-docs.deepseek.com/guides/kv_cache/>
