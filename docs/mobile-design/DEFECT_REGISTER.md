# Mobile defect register

Last verified: 2026-09-26

| Priority | Defect and reproduction | Root cause | Resolution / evidence | Status |
|---|---|---|---|---|
| P0 | Two admins open one member, then save different cumulative payments. The later stale save overwrites the first. | The API trusted client `totalPayable`; Sheets performed an unlocked generic row update with no prior-state check. | Added a document-locked `updatePayment` Apps Script operation. It reads authoritative payable/paid values under the same lock, rejects stale `expectedAmountPaid`, calculates status/balance, and returns HTTP 409 through Express. Mobile and web now send their observed paid value. Static checks pass; live Sheets deployment test remains outstanding. | Implemented, deployment pending |
| P1 | Change System → Light → Dark rapidly, restart, and occasionally restore an older choice; storage errors show no feedback. | Secure-storage writes were launched independently and the UI discarded the returned future. | Theme writes are serialized, latest-write errors are exposed, and the appearance UI awaits persistence and reports failure. Regression tests cover rapid changes and failure. | Verified automatically |
| P1 | Select two months rapidly while the first request is slow; the older response can replace the latest data. | Every request committed to shared state without checking whether it was still current. | FinanceStore now uses a monotonic load revision and commits only the newest complete snapshot. Regression test passes. | Verified automatically |
| P1 | Ask the command center to perform a management action. It renders prose but does not execute the proposed action. | Flutter flattened structured proposals and the server did not validate action payloads deeply enough for execution. | Added server allow-lists/value bounds and structured mobile action cards. Persistent actions require explicit confirmation and use existing routes; WhatsApp remains review/open only. Durable audit/idempotency remains a production hardening item. | Verified automatically; device QA required |
| P1 | Release APK build fails before compilation on this Windows host. | Earlier Gradle runs could not establish a loopback connection. | A diagnostic arm64 release build now succeeds when temp files are redirected to the workspace drive: 18.2 MB compressed. Production still needs the real HTTPS API origin and release keystore. | Local blocker cleared |
| P2 | The Assistant is described as a primary management workspace but is hidden under More and opens as a second, nested scaffold. | The mobile shell exposes only four destinations and treats Assistant like a settings utility. | Assistant is now a persistent fifth primary destination; its content can render inside the shell without a nested app bar, and the duplicate More entry was removed. Targeted Dart analysis finds no errors or warnings. | Verified statically |
| P2 | Device/theme screenshots and performance figures are absent. | No emulator/device session is available, and browser automation previously could not reach localhost. | No screenshots or measurements are claimed. | Device QA required |

## Verification notes

- `flutter test --no-pub`: 14/14 passing, including the widget-level System → Light → Dark → System cycle, storage/401 failures, stale month responses, atomic refresh snapshots, and scoped selector rebuilds.
- `flutter analyze`: no errors or warnings; 22 informational style/deprecation lints.
- AI Node suite: 17/17 passing; touched server files pass `node --check`.
- Diagnostic arm64 release APK: 18.2 MB compressed; package code accounts for about 281 KB of decompressed AOT symbols. Gradle warned about an unbundled Cupertino icon font reference.
- Modified JavaScript files pass `node --check`; `git diff --check` passes with line-ending notices only.
- No production financial records or live DeepSeek requests were used.
