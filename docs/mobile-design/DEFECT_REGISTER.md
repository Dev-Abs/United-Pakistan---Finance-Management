# Mobile defect register

Last verified: 2026-09-26

| Priority | Defect and reproduction | Root cause | Resolution / evidence | Status |
|---|---|---|---|---|
| P0 | Two admins open one member, then save different cumulative payments. The later stale save overwrites the first. | The API trusted client `totalPayable`; Sheets performed an unlocked generic row update with no prior-state check. | Added a document-locked `updatePayment` Apps Script operation. It reads authoritative payable/paid values under the same lock, rejects stale `expectedAmountPaid`, calculates status/balance, and returns HTTP 409 through Express. Mobile and web now send their observed paid value. Static checks pass; live Sheets deployment test remains outstanding. | Implemented, deployment pending |
| P1 | Change System → Light → Dark rapidly, restart, and occasionally restore an older choice; storage errors show no feedback. | Secure-storage writes were launched independently and the UI discarded the returned future. | Theme writes are serialized, latest-write errors are exposed, and the appearance UI awaits persistence and reports failure. Regression tests cover rapid changes and failure. | Verified automatically |
| P1 | Select two months rapidly while the first request is slow; the older response can replace the latest data. | Every request committed to shared state without checking whether it was still current. | FinanceStore now uses a monotonic load revision and commits only the newest complete snapshot. Regression test passes. | Verified automatically |
| P1 | Ask the command center to perform a management action. It renders prose but does not execute the proposed action. | `/api/ai/command` returns model-originated proposals; there is no durable confirmation/audit/idempotency service and Flutter flattens proposals into text. | Confirmed as an implementation gap. Assisted payment/expense entry uses normal APIs after explicit confirmation, but general command actions remain non-executable. | Open |
| P1 | Release APK build fails before compilation on this Windows host. | Gradle cannot establish its required loopback connection in the current host policy. | Existing reproducible blocker retained; a production HTTPS `API_BASE_URL` is also not available in repository configuration. | Externally blocked |
| P2 | Device/theme screenshots and performance figures are absent. | No emulator/device session is available, and browser automation previously could not reach localhost. | No screenshots or measurements are claimed. | Device QA required |

## Verification notes

- `flutter test --no-pub`: 8/8 passing.
- `flutter analyze`: no errors or warnings; 24 informational lints.
- `npm test`: 12/12 passing.
- Modified JavaScript files pass `node --check`; `git diff --check` passes with line-ending notices only.
- No production financial records or live DeepSeek requests were used.
