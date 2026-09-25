# Mobile product strategy

## Information architecture

Primary navigation uses four destinations:

1. Home — current-month health, attention queue, compact trend, recent activity, and quick actions.
2. Members — searchable member list with status chips and direct payment/reminder actions.
3. Activity — segmented Payments / Expenses / Special Fund ledger.
4. More — Reports, notifications placeholder, profile, settings, help, about, diagnostics, and month rollover.

Global month selection lives in the top app bar and is retained across feature areas. Global search is a full-screen route grouping members and actions. Create/transaction flows use full-height bottom sheets on phones so context remains visible and keyboards behave naturally.

## Web-to-mobile mapping

| Web capability | Mobile treatment |
| --- | --- |
| Dashboard cards/table | Compact KPI strip, net-position chart, attention queue, recent activity |
| Member table | Searchable status-grouped list → member detail |
| Member CRUD modal | Touch-first bottom sheet/full-screen form |
| Payment modal | Two-step amount/date sheet with live remaining balance |
| Follow-ups | Member timeline and quick reminder/reply sheet |
| Expense table | Ledger list grouped by date; filter sheet; expense detail/form |
| Special-fund page | Campaign progress, category targets, member progress, contribution ledger |
| Reports | Mobile summary sections plus shareable/downloadable exports |
| Settings | Grouped forms with role-aware controls |
| Month rollover | Guarded wizard with carry-balance preview and confirmation |
| Command palette | Global search and contextual quick actions |

## Interaction principles

- Primary tasks stay within two taps from a main tab.
- Destructive changes require explicit confirmation; successful financial writes show a receipt-like result.
- Reader users see a persistent Read only badge and no misleading write affordances.
- Cached content remains usable offline with a timestamp; writes are never silently queued.
- Lists use progressive disclosure rather than desktop tables.
- Numbers use tabular figures, explicit PKR labels, and consistent positive/warning/error semantics.

## Design system direction

The visual language is restrained, high-contrast, and Pakistan-inspired without becoming decorative: deep emerald for trust and primary action, warm off-white backgrounds, ink text, muted slate metadata, amber attention, and red destructive states. Surfaces are flat with hairline borders; radius is 12–16 px; shadows are rare. Type uses a modern grotesk appearance with tabular numerals. Motion is 160–240 ms and suppressed for reduced-motion settings.

The source-of-truth boards in this folder define spacing, hierarchy, components, and screen composition for Flutter implementation.
