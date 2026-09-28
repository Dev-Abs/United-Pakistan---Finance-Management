# React migration feasibility

Date: 2026-09-28

## Current metrics

- 7 authenticated HTML views, 820 lines of view HTML.
- 3,547 lines / 193,717 bytes of browser JavaScript.
- 2,124 lines / 54,031 bytes of CSS.
- 15 Express route modules and an unchanged same-origin API/PWA deployment.
- 37 `innerHTML`/`insertAdjacentHTML` call sites; most are static UI fragments, while audited API/user values are escaped.
- Existing Node coverage: 57 tests. Browser coverage was added with Playwright and axe-core.
- No SEO requirement; authenticated dashboard; PWA install and same-origin Express API must remain.

## Options

| Option | Estimated effort | Regression risk | Initial bundle/performance | Testability | PWA/deploy | Maintenance |
|---|---:|---|---|---|---|---|
| Keep vanilla and harden | 10–16 engineer-days | Low–medium | Best; no framework runtime | Good after Playwright/axe and modular DOM helpers | No hosting change | Acceptable at seven views; discipline required |
| Incremental Vite + React + TypeScript | 30–45 engineer-days | Medium | +50–100 KB gzip typical before route splitting | Excellent | Requires dual-router build and Vite PWA integration | Best if product/team expands materially |
| Next.js | 40–60 engineer-days | High | Highest runtime/build complexity for this use | Excellent | Duplicates Express concerns; rewrite deployment | Unjustified without SSR/SEO/server-component needs |

## Decision

Do not migrate now. The app has only seven views, no SEO/SSR need, a mature same-origin Express/PWA deployment, and active web/mobile parity work. A framework migration would triple the UI effort while the two reported critical defects were shared-theme and context-contract defects that React would not inherently solve.

Continue with the current incremental modules, centralized API/context handling, semantic tokens, DOM construction for new data-driven UI, and Playwright/axe guardrails.

Reconsider Vite + React + TypeScript when at least two of these conditions become true:

1. More than 12 independently evolving authenticated routes.
2. Three or more engineers regularly change web UI concurrently.
3. Complex shared form/state logic is duplicated across at least four screens.
4. The legacy `innerHTML` count cannot be reduced safely under 15 call sites.
5. Component-level interaction coverage becomes materially cheaper than page fixtures.

If those conditions are met, use the proposed strangler plan: same origin, route switches, React Router, TanStack Query, one typed auth/context client, React Hook Form plus schema validation, accessible headless primitives, Vitest/Testing Library, Playwright, Vite PWA, and per-route rollback. Next.js remains excluded unless SSR/SEO becomes a product requirement.

