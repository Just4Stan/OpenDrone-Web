# OpenDrone Web — Claude instructions

## Deployment
- Oxygen auto-deploys from this GitHub repo. **Always push after committing** — local-only commits don't reach opendrone.be.
- After every commit, run `git push` (or `git push -u origin <branch>` for feature branches). Don't leave commits sitting locally unless explicitly told "don't push" / "local only".

## Theming (light / dark)
The site supports light and dark. The pattern is the standard CSS-custom-property
token swap — follow it and new UI themes for free.

- **Tokens, not literals.** Every color in CSS or JSX must reference a semantic
  token: `var(--color-bg)`, `--color-bg-card`, `--color-bg-elevated`,
  `--color-text`, `--color-text-muted`, `--color-text-dim`, `--color-border`,
  `--color-border-strong`, `--color-gold` (accent) + `--color-gold-hover`,
  `--color-gold-soft`, `--color-stock`. Never hardcode a hex/rgb for something
  that should change between themes.
- **Text on the gold accent** uses `--color-on-accent` (dark ink in both modes),
  not `--color-bg`. Use it for any filled-gold button/badge/active state.
- **Where the values live** (`app/styles/app.css`): dark is the default in the
  Tailwind `@theme` block; light overrides the same token names under the
  `html.light { … }` block right below it. To retune a color, edit those two
  places only.
- **If a dark literal is unavoidable** (e.g. a load overlay or a backdrop that
  can't be a token), add a matching `html.light .your-selector { … }` twin in
  the light-mode section. Grep `html.light` in app.css for examples.
- **Switching mechanics** (`app/lib/theme.ts`): an inline `<head>` script
  (`THEME_INIT_SCRIPT`, injected in `root.tsx`) resolves the theme before first
  paint — no flash. Resolution order: `localStorage['od-theme']` → OS
  `prefers-color-scheme` → dark. `ThemeToggle` writes the explicit choice and
  live-follows the OS until the visitor toggles. Default with no stored choice
  is the OS preference.
- **Third-party embeds** (Discord widget, Turnstile) can't be CSS-themed.
  Turnstile is passed `getActiveTheme()`; the Discord widget panel is
  intentionally dark in both modes (it frames a dark iframe).
- **Don't** reintroduce `class="dark"`-only assumptions or `prefers-color-scheme`
  media queries for color — the class on `<html>` is the single source of truth.
