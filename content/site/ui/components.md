# UI components — `PlaceholderBanner.tsx`, `EmptyState.tsx`, `FirmwareSplit.tsx`

> source: app/components/PlaceholderBanner.tsx, app/components/EmptyState.tsx, app/components/FirmwareSplit.tsx

Shared chrome used across multiple routes: the pre-launch banner, the
generic empty-state block, and the PDP firmware-contribution split. The
newsletter signup form lives in `ui/footer.md`; donation upsell, cart,
support, feedback, and search components are captured in their own files.

## Pre-launch banner

- **aria_label:** Pre-launch notice
- **tag:** PRE-LAUNCH
- **message:** Text & numbers are AI-generated placeholders.

## Empty state (component defaults only)

`title`, `description`, and `ctaLabel` are passed in by each route (their
text is captured in those route files). The only string hardcoded inside
the component itself is the role/announcement plumbing — there is no
default visible copy. The status region announces via `role="status"`.

(No editable strings owned here — all visible text is prop-driven.)

## Firmware split (PDP price breakdown)

Only renders for EUR prices above a small floor. The two euro amounts are
**computed** from the product price (board amount = price − €1
contribution); do not edit them here. The firmware project name and its
link are passed in per product (**dynamic**).

- **fallback_project:** firmware
- **aria_label:** Open-source firmware contribution

### prose: tagline

{board amount} for the board.
**{contribution amount} for the {firmware project} ↗ maintainers.**

The amounts and the firmware project name are dynamic. The editable
copy is the surrounding words: "for the board." and "for the … 
maintainers." When the firmware project has no link, the project name
renders as plain text (or the fallback "firmware"); with a link it shows
the project name followed by a "↗" glyph.
