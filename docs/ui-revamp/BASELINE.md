# UI rebuild baseline

Updated: 2026-09-28

## Verification tier

Tier C — no screenshots or layout metrics were produced. The baseline is intentionally limited to source facts and bootstrap blockers.

## Source facts

- `public/index.html` loads Google Fonts, Chart.js, and Lucide from third-party URLs.
- `public/login.html` loads Google Fonts and unversioned `/css/style.css` and `/css/components.css`.
- `public/sw.js` caches the CSS shell URLs; the HTML and login URLs currently use different cache/version strategies, so an old service-worker cache can combine old HTML with newer CSS/JS or vice versa during deployment.
- If Google Fonts is blocked, the browser falls back to the declared system sans-serif stack; Urdu therefore renders using the platform's Urdu-capable fallback, not a bundled Inter Urdu face.
- If Chart.js is blocked, dashboard/report charts cannot initialize and their chart canvases remain unavailable to the chart rendering code.
- If Lucide is blocked, icon placeholders remain because the app relies on `window.lucide.createIcons()` to replace `data-lucide` elements.
- `public/icon-192.png` and `public/icon-512.png` do not exist.

## Counts

- Screenshot count: 0
- Layout flags: not measured
- Console errors: not measured
- Failed requests: not measured
- Performance: not measured

## Highest-priority blockers

1. No working browser capture path has been established.
2. No deterministic fixture server/harness exists in this checkout.
3. Manifest icon assets are missing.
4. Fonts, charts, and icons are runtime CDN dependencies.
5. Login asset URLs are not versioned consistently with the service-worker cache.

These are unverified render defects until the harness runs; they are not presented as screenshot-backed findings.
