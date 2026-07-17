# Theming — light/dark token system (full reference)

*Moved out of CLAUDE.md 2026-07-17. CLAUDE.md keeps the 5-line summary; this is
the full contract. NOTE: PR #286 (brand palette `#fdb600` gold + PCB green,
reverts gold-on-black chips) would change the gold rules below — check
`drafts/coordination.md` before starting gold/theming work.*

## Tokens, not literals

Every color in CSS or JSX must reference a semantic token: `var(--color-bg)`,
`--color-bg-card`, `--color-bg-elevated`, `--color-text`, `--color-text-muted`,
`--color-text-dim`, `--color-border`, `--color-border-strong`, `--color-gold`
(accent) + `--color-gold-hover`, `--color-gold-soft`, `--color-gold-fill` +
`--color-gold-fill-hover`, `--color-stock`. Never hardcode a hex/rgb for
something that should change between themes.

## Gold rules (Stan, 2026-07-06 — pending #286)

- **One light gold:** `#dab040` in light mode (text AND fills), `#c89d2e` base
  in dark. A darker "AA-safe" gold reads brown on white — do NOT walk light
  gold back down to a dark amber.
- **Gold text is always gold-on-black.** Dark mode gets this for free; in light
  mode every gold label/badge/eyebrow sits on a near-black tag chip
  (`--color-tag-bg`, see the "Gold tags — light mode" section in app.css).
  Adding a new gold label? Add its selector to that section, or put the
  `gold-tag` class on it in JSX. Deliberate exceptions (plain gold, no chip):
  inline headline accent words and hover states — below AA on white, accepted.
- **`--color-gold-fill` (+ `-hover`)** is the token for FILLED surfaces
  (buttons, active pills, the wordmark) with `--color-on-accent` ink on top;
  `background: gold` never takes `--color-gold`.
- **Text on the gold accent** uses `--color-on-accent` (dark ink in both
  modes), not `--color-bg`.

## Where the values live

`app/styles/app.css`: dark is the default in the Tailwind `@theme` block; light
overrides the same token names under the `html.light { … }` block right below
it. To retune a color, edit those two places only.

If a dark literal is unavoidable (e.g. a load overlay or a backdrop that can't
be a token), add a matching `html.light .your-selector { … }` twin in the
light-mode section. Grep `html.light` in app.css for examples.

## Switching mechanics

`app/lib/theme.ts`: an inline `<head>` script (`THEME_INIT_SCRIPT`, injected in
`root.tsx`) resolves the theme before first paint — no flash. Resolution order:
`localStorage['od-theme']` → OS `prefers-color-scheme` → dark. `ThemeToggle`
writes the explicit choice and live-follows the OS until the visitor toggles.

## Caveats

- Third-party embeds (Discord widget, Turnstile) can't be CSS-themed. Turnstile
  is passed `getActiveTheme()`; the Discord widget panel is intentionally dark
  in both modes (it frames a dark iframe).
- Don't reintroduce `class="dark"`-only assumptions or `prefers-color-scheme`
  media queries for color — the class on `<html>` is the single source of truth.
