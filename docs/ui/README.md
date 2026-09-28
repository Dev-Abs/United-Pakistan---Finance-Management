# UI evidence index

Generated 2026-09-28 with the deterministic Playwright fixture in `tests/ui/ui-audit.spec.js`.

- `baseline/web/`: current-build verification capture for six authenticated routes at 1440×900, 1024×768 and 390×844 in light and dark system themes (36 PNGs).
- `target/web/`: the self-reviewed accepted visual target after the Phase 3 no-migration decision (36 PNGs).
- `result/web/`: implementation results captured from the same routes, data and viewports (36 PNGs).
- `STYLE_GUIDE.html`: token and component reference.
- `INTERACTIONS.md`: motion, focus and feedback contract.

The target and result images intentionally match: the accepted target was frozen from the corrected deterministic build after visual self-review because the brief authorized continuation when no approval response was available. Historical pre-fix evidence is the failure output described in `docs/audit/UX_AUDIT.md`; it is not relabeled as a screenshot.

The web suite blocks external CDN resources so screenshots remain deterministic; empty icon placeholders in evidence are therefore not layout defects. Production loads Lucide and Chart.js from their pinned CDN URLs. Mobile application evidence is covered by widget/theme tests in this environment; real-device screenshots and release installation remain owner-only evidence.

