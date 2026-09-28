# UI/UX Design System — Blood-Red Platform Console

Last reviewed: 2026-09-28

This specification supersedes the emerald/teal and emerald/cyan/indigo visual systems. Finance calculations, cumulative payments, special-fund rules, role permissions, and API response contracts do not change in Phase A.

## Token contract

The web implementation target is `public/css/style.css` custom properties. The Flutter implementation target is `mobile/lib/src/theme.dart` (`AppColors`, `AppGradients`, `AppSemanticColors`, `buildTheme`). Names are intentionally shared so visual QA can compare platforms.

### Color tokens

| Token | Light value | Dark value / use |
|---|---|---|
| `--brand-950` / `AppColors.crimson950` | `#1A0305` | canvas/deep brand |
| `--brand-900` / `crimson900` | `#2A0508` | dark canvas |
| `--brand-800` / `crimson800` | `#4A0A10` | raised dark surface |
| `--brand-700` / `crimson700` | `#7A0F1A` | navigation/strong brand |
| `--brand-600` / `crimson600` | `#A3121F` | primary action start |
| `--brand-500` / `crimson500` | `#C8102E` | signature brand |
| `--brand-400` / `crimson400` | `#E23A4A` | action end/highlight |
| `--brand-300` / `crimson300` | `#F27A83` | dark-theme secondary text only |
| `--brand-100` / `crimson100` | `#FFE5E7` | light tint |
| `--ember` / `AppColors.ember` | `#FF5A4F` | focus/glow, never a danger substitute |
| `--canvas-light` / `background` | `#FBF6F5` | light page canvas |
| `--surface-light` / `surface` | `#FFFFFF` | cards/forms/tables |
| `--canvas-dark` | `#120607` | dark page canvas |
| `--surface-dark` | `#1C0B0D` | dark surfaces |
| `--raised-dark` | `#261115` | elevated dark surfaces |
| `--success` / semantic success | `#13713A` light, `#72DB91` dark | paid/healthy |
| `--warning` / semantic warning | `#805600` light, `#FFCB70` dark | attention |
| `--info` / semantic info | `#096A86` light, `#70D4F4` dark | neutral platform info |
| `--danger` / semantic danger | outlined/icon-led treatment | destructive/error; never brand gradient |

All normal text must meet 4.5:1 contrast. Statuses must pair color with an icon and explicit label; red alone never means danger because red is the brand.

### Gradients

- `brand`: `135deg #3B0509 → #8B0F1C → #C8102E` for hero/brand panels.
- `action`: `#A3121F → #E23A4A` for primary actions and active navigation.
- `ambient`: low-opacity radial ember glow behind hero areas only.
- Long-form content, tables, and forms remain flat readable surfaces.

### Type, spacing, shape, elevation, motion

- UI typeface: Inter on web and Manrope on Flutter until a later coordinated font decision; money uses tabular numerals.
- Spacing: 4/8-point scale: `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- Radii: `sm 8`, `md 12`, `lg 16`; platform hero may use `xl 24`.
- Elevation: `level-1` hairline/soft shadow, `level-2` raised card, `level-3` modal/console overlay.
- Motion: 160ms control, 240ms standard, 320ms emphasized; zero duration when reduced motion is enabled.

## Component inventory

Buttons (primary gradient, secondary flat, quiet, danger outlined), text/select/date inputs, search/filter toolbar, KPI cards, hero cards, flat data tables with local scroll, status chips with icon and text, dialogs/drawers, bottom sheets, sidebar/top bar/bottom navigation, command center, charts, skeleton/loading, empty/error/retry, toast/live region, one-time credential reveal/copy block, context banner, and audit-log filter/pagination.

## Information architecture

### Platform console (`super_admin`)

1. Platform Overview — sector counts, cross-sector collected/due/collection rate/expenses, attention ranking, system health.
2. Sectors — search/list, create, activate/deactivate, sector detail, enter sector.
3. Sector Users — secretary/read-only accounts, create/reset/deactivate, one-time credential reveal.
4. Audit Log — sector/actor/action/date filters and pagination.
5. Backup & System — one-way Sheets backup result, database health, AI flags, deployment status.
6. Context banner — `Viewing: <Sector>`, explicit Exit action, visible on every sector-scoped screen.

### Sector console (`secretary` / `read_only`)

Dashboard, Members, Expenses, Special Fund, Reports, Settings, Assistant, and More. Secretary sees write actions; read-only sees no write affordances. Neither sees platform navigation.

## Responsive contracts

- Web widths: 360, 768, 1024, 1440. Tables scroll inside their own container; the page never gains horizontal overflow.
- Flutter widths: small/regular phone and tablet. Content gets a bounded max width on tablets; sheets respect keyboard insets; text scale 1.3–2.0 must wrap rather than clip.
- Dialogs and sheets use safe areas, explicit max heights, internal scrolling, focus restoration, and accessible labels.

## Role/context state map

`super_admin` starts in Platform Overview. Enter Sector stores an explicit selected sector context and sends it through the existing validated `X-Sector-Id` contract. Exit clears it and returns to Platform Overview. `secretary` and `read_only` never choose a sector context from the client. A missing or inactive super-admin context remains a visible, actionable 4xx state rather than silently falling back.
