# Renderer design system

The renderer is built on **shadcn/ui** (style `base-nova`, on Base UI) with
Tailwind v4. The default look matches the SportsLink Marketing Hub: Vercel's
Geist values, Geist Sans and Geist Mono (bundled, the CSP allows fonts from the
app only), hairline panels, no shadows, black primary actions and one colour
for data.

## Rules

1. **shadcn components only.** Compose screens from `src/renderer/components/ui/`.
   If shadcn has the control, use it; if it is missing, add it from the repo
   root with `npx shadcn@latest add <name>`. Never hand-build a button, select,
   switch, slider, table, badge, card, dialog, tooltip or menu.
2. **Style through tokens**, never a hex: `bg-card`, `text-muted-foreground`,
   `bg-data`, `text-ok`, `text-warn`, `text-destructive`. A colour that comes
   from data (a theme swatch, a provider mark) is passed as a CSS variable.
3. **One data colour.** `--data` is each theme's colour for bars, rings and
   chart-1. It is a fill, never small text.
4. **No meaning by colour alone** (WCAG 1.4.1). A usage level shows its colour
   together with an icon and a word (`LevelBadge`, `UsageMeter`).
5. **Unmeasured is not zero.** Before the first reading the overlay shows `--`.
6. **Charts** use shadcn's `Chart` at a fixed size for small ones, with
   `type="linear"`, `isAnimationActive={false}` and, when decorative,
   `accessibilityLayer={false}`.
7. **Generated files** in `components/ui/` may be changed only with a comment
   saying why (see `slider.tsx`).
8. No em dashes in user-facing copy, commits or docs.

## Files

| Path | Owns |
|---|---|
| `components.json` | shadcn config: `base-nova`, `@/` aliases, lucide icons |
| `src/renderer/index.css` | Imports (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`), `@theme inline` token map, base layer, full-strength focus ring |
| `src/renderer/styles/themes.css` | shadcn's variables for all ten themes, light and dark |
| `src/renderer/lib/theme.ts` | Theme and mode store, theme catalogue, window fill |
| `src/renderer/index.html` | First-paint preloader (repeats each theme's background) |
| `src/renderer/lib/usage-level.ts` | Usage thresholds and their tokens |
| `components/app/` | `AppHeader`, `ThemeMenu`, `IconAction` |
| `components/usage/` | `UsageMeter`, `LevelBadge`, `Sparkline` |
| `components/cost/` | Cost panel parts |
| `components/settings/` | `SwitchField`, `SliderField`, overlay settings |

## Themes

Geist (default), Olive (the original palette), Dusk, Lime, Ocean, Retro, Neo,
Forest, SportsLink and Blossom, each light and dark. A stored `vercel` choice
maps to the default. Adding a theme means a block in `themes.css`, an entry in
`THEMES` in `lib/theme.ts` and a row in the preloader table in `index.html`.

The base-nova `.dark` class drives dark mode; `data-theme` on `<html>` picks
the colour theme.

## Accessibility decisions

- **Focus rings at full strength.** shadcn draws its ring at 50% of `--ring`,
  which measured 2.2 to 2.7:1 here, under the 3:1 a focus indicator needs. An
  unlayered rule in `index.css` sets the ring to full `--ring`, including on a
  control whose hidden child holds focus.
- **Slider focus.** Base UI focuses a hidden input inside the thumb, so the
  generated thumb never showed focus. `slider.tsx` adds
  `has-[:focus-visible]:ring-3`.
- **`--input` holds 3:1** against the card, because it is also the switch
  track and field border (WCAG 1.4.11).
- **Status colours** are AA on the card, on the page and on their own 10% badge
  tint, in every theme.

## Checking

```bash
node scripts/check-theme-contrast.mjs
```

Checks every text pair at 4.5:1 and every fill, ring and field border at 3:1 in
all 20 theme and mode combinations. Run it after changing any colour.

```bash
npm run test:e2e
```

`e2e/visual-qa.spec.ts` runs `e2e/qa/qa-check.js` (adapted from the hub) on the
live Electron window: layout at real window widths from 400 to the display's
work area and emulated widths above it, resize sequences, WCAG AA text in every
theme and mode, a visible focus indicator on every Tab stop, the Settings
dialog, and a quiet console. `e2e/overlay.spec.ts` checks the overlay the same
way. Results and screenshots land in `e2e/artifacts/qa/` (not committed).

The QA switches themes in place rather than reloading: each reload refetches
every account, and a run full of reloads rate-limited a real account.
