# Interaction specification

- Route changes: 160–240ms opacity/translate transition; no layout-affecting animation.
- Buttons/navigation: color, border, shadow and transform feedback in 160ms; pressed state moves 1px and scales to 0.985.
- Dialogs/sheets: focus moves into the surface, Escape/backdrop closes where safe, focus returns to the trigger, and the background is scroll-locked.
- Command and More overlays: removed from the focus tree while closed; opened controls receive focus.
- Loading: use skeleton/content placeholders for finance surfaces; avoid blocking full-screen spinners after last-known-good data exists.
- Success/error: human wording in live regions; errors include retry where recovery is possible. Raw headers, stack traces and provider errors are prohibited.
- Destructive actions: explicit confirmation with the affected member/sector in the prompt.
- Motion accessibility: `prefers-reduced-motion` and Flutter `disableAnimations` reduce durations/delays to zero.
- Touch targets: minimum 44px web and 48dp mobile for primary interactive controls.

