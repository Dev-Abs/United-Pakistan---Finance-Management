# UI evidence index

Generated 2026-09-28 with the deterministic Playwright fixture in `tests/ui/ui-audit.spec.js`.

- `baseline/web/`: current-build verification capture for seven authenticated routes at 1440×900, 1024×768 and 390×844 in light and dark system themes (42 PNGs).
- `target/web/`: the self-reviewed accepted visual target after the Phase 3 no-migration decision (42 PNGs).
- `result/web/`: implementation results captured from the same routes, data and viewports (42 PNGs).
- `baseline/mobile/`, `target/mobile/`, and `result/mobile/`: login and mandatory sector-selection goldens at 320×568, 360×800, and 412×915, light/dark, and 1.3× text scale (12 PNGs per set).
- `STYLE_GUIDE.html`: token and component reference.
- `INTERACTIONS.md`: motion, focus and feedback contract.

The target and result images intentionally match: the accepted target was frozen from the corrected deterministic build after visual self-review because the brief authorized continuation when no approval response was available. Historical pre-fix evidence is the failure output described in `docs/audit/UX_AUDIT.md`; it is not relabeled as a screenshot.

The web suite blocks external CDN resources so screenshots remain deterministic; empty icon placeholders in evidence are therefore not layout defects. Production loads Lucide and Chart.js from their pinned CDN URLs. Flutter goldens use bundled Roboto and Material Icons so text and icons are deterministic. Real-device screenshots and release installation remain owner-only evidence.
