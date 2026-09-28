# Unrelated Issues Register

This register tracks issues observed while implementing the requested migration and revamp. Items here are not silently folded into finance behavior changes.

| Issue | Evidence | Planned action | Verification status |
|---|---|---|---|
| Browser screenshot automation cannot initialize Chrome/in-app assets | Prior UI automation attempts failed before page interaction | Retry Playwright/Chrome setup in a host with browser assets | Open; no screenshot claim |
| Flutter Google Fonts attempts network fetches during tests | Test output reports font download warnings while all tests pass | Bundle/cache approved fonts or configure test fallback | Open; tests pass |
| Informational Flutter deprecation/style lints remain | Targeted analysis reports legacy Radio API and style infos | Replace deprecated Radio APIs and clear infos in a dedicated cleanup pass | Open |
| Android release Gradle loopback failure | Prior release builds failed before compilation | Repair host Java/Gradle loopback environment and rebuild with production HTTPS origin | Open |
| No real device/emulator session for accessibility/device QA | No connected target in current environment | Run web/device QA on an owner-controlled workstation | Open |
| Admin UI still uses a browser prompt for one-time secretary credentials | `public/js/admin.js` | Replace with an accessible copy-once credential dialog | Open |
| Refresh/session and idempotency clients need deployment-backed retry tests | Current tests are local/mocked plus live smoke scripts | Add deployment integration suite after Vercel linkage | Open |

No item in this register authorizes changing cumulative payment semantics, sending messages, or modifying production credentials.
