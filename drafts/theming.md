# Theming: light/dark token reference

Full contract for the palette merged in PR #286 (2026-07-17). CLAUDE.md keeps
the 5-line summary; this file is the authority for colors.

## Tokens, not literals

Every color in CSS or JSX references a semantic token: `var(--color-bg)`,
`--color-bg-card`, `--color-bg-elevated`, `--color-text`, `--color-text-muted`,
`--color-text-dim`, `--color-border`, `--color-border-strong`, `--color-gold`
(accent) + `--color-gold-hover`, `--color-gold-bright`, `--color-gold-soft`,
`--color-gold-fill` + `--color-gold-fill-hover`, `--color-green`,
`--color-green-deep`, `--color-stock`. Never hardcode a hex/rgb for something
that should change between themes.

## Brand anchors are physical colors

The gold `#fdb600` and the green `#147A31` are the actual product colors
(motors). They live in the palette as `--color-gold-bright` and
`--color-green`. Keep them exact.

## Gold ramp

- Base `--color-gold` = `#c89d2e` in both themes; `--color-gold-hover` =
  `#dab040`.
- `--color-gold-bright` = `#fdb600` (the physical brand gold) for gold
  text/icons on dark or photographic surfaces where the muted gold washes out
  (about 10.7:1 on near-black; about 1.6:1 on white, so never as text on
  white).
- A darker "AA-safe" gold reads brown. Do NOT walk gold down to a dark amber.
- Gold text sits directly on the background in both themes, including white:
  a deliberate ~2.6:1 brand accent on white, labels and eyebrows only, never
  body copy. There is no `--color-tag-bg` and no "Gold tags" section in
  app.css; the `.gold-tag` JSX class is inert (safe to leave in place). For
  gold on a genuinely dark surface inside a light page, use
  `--color-gold-bright` and give that element its own dark background; do not
  introduce a blanket chip rule.

## Green ramp (PCB green)

- `--color-green` is the emerald brand green: `#4ea866` on dark (legible),
  the true `#147A31` on light (AA 5.4:1 on white).
- `--color-green-deep` = `#327014`, the dark solder-mask PCB green for fills
  and borders, same in both modes.
- `--color-stock` aliases `--color-green`, so stock/success indicators
  re-theme with it automatically.

## Fills and ink

- `--color-gold-fill` (+ `-hover`) is the token for FILLED surfaces (buttons,
  active pills, the wordmark) with `--color-on-accent` ink on top;
  `background: gold` never takes `--color-gold`.
- Text on the gold accent uses `--color-on-accent` (dark ink in both modes),
  not `--color-bg`.

## Where the values live

`app/styles/app.css`: dark is the default in the Tailwind `@theme` block;
light overrides the same token names under the `html.light { ... }` block
right below it. To retune a color, edit those two places only.

If a dark literal is unavoidable (e.g. a load overlay that can't be a token),
add a matching `html.light .your-selector { ... }` twin in the light-mode
section. Grep `html.light` in app.css for examples.

## Switching mechanics

`app/lib/theme.ts`: an inline `<head>` script (`THEME_INIT_SCRIPT`, injected
in `root.tsx`) resolves the theme before first paint, so there is no flash.
Resolution order: `localStorage['od-theme']`, then OS `prefers-color-scheme`,
then dark. `ThemeToggle` writes the explicit choice and live-follows the OS
until the visitor toggles.

## Caveats

- Third-party embeds (Discord widget, Turnstile) can't be CSS-themed.
  Turnstile is passed `getActiveTheme()`; the Discord widget panel is
  intentionally dark in both modes (it frames a dark iframe).
- Don't reintroduce `class="dark"`-only assumptions or `prefers-color-scheme`
  media queries for color. The class on `<html>` is the single source of
  truth.
