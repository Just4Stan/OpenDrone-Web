# OpenDrone — Logo Package

Vector logo package for the **OpenDrone** wordmark and mark. All artwork is
pure vector, regenerated from a single source of truth
(`public/opendrone-wordmark.svg`, traced from SF Pro Display Bold) via
`scripts/gen-logo-package.py`. Regenerate any time with:

```
python3 scripts/gen-logo-package.py
```

## What to send a designer / printer

Send the **`pdf/`** folder (or `svg/`). Both are fully editable vector:

- **PDF** — opens and edits natively in Adobe Illustrator, Affinity Designer,
  and Inkscape. This is the standard "editable vector" deliverable. (A true
  `.ai` file is Illustrator's own PDF-based format; open any PDF here in
  Illustrator and `File → Save As → Illustrator (.ai)` to get a `.ai` if a
  vendor specifically insists on that extension.)
- **SVG** — same paths, web-native, editable in any vector tool or a text
  editor.
- **PNG** — flattened raster previews only; not for print or resizing up.

## Files

Each logo exists as `svg/`, `pdf/`, and `png/` (wordmark PNG at 1200/2400 px
wide; mark PNG at 512/1024 px square).

| File | Use |
|------|-----|
| `opendrone-wordmark-onlight` | Primary. "Open" ink + "Drone" gold, on light/white backgrounds. |
| `opendrone-wordmark-ondark` | Primary for dark backgrounds ("Open" off-white + "Drone" gold). Transparent; PNG preview has dark bg baked in. |
| `opendrone-wordmark-onlight-bg` / `-ondark-bg` | Same lockups with the brand background rectangle embedded — drop-in safe on any surface. |
| `opendrone-wordmark-black` | One-colour black (single-plate print, fax, engraving, stamps). |
| `opendrone-wordmark-white` | One-colour white (knockout / reverse). Transparent. |
| `opendrone-wordmark-gold` | One-colour gold (foil, single-colour on neutral). |
| `opendrone-mark-gold` / `-black` / `-white` | Standalone "O" mark — favicon, app icon, avatar, tight spaces. |

## Colour

| Token | Hex | Use |
|-------|-----|-----|
| **Brand Gold** | `#c89d2e` | The "Drone" half, the mark, all accent. Canonical brand colour. |
| Gold (light-bg variant) | `#c08c10` | Slightly deeper gold used on the live site over off-white, for AA contrast. Optional. |
| Ink | `#1a1a1e` | "Open" half on light backgrounds. |
| Off-white | `#e5e5e5` | "Open" half on dark backgrounds. |
| Surface — dark | `#0d0d10` | Brand dark background. |
| Surface — light | `#f7f6f3` | Brand warm off-white background (not pure `#fff`). |

Brand Gold `#c89d2e` → approx **CMYK 0 / 22 / 77 / 22**, **Pantone 111 C** (nearest;
confirm on a physical guide before print).

## Clear space & minimum size

- **Clear space:** keep clear margin around the wordmark equal to the height of
  the "O". The provided viewBoxes already include a comfortable margin.
- **Minimum size:** wordmark no smaller than **120 px / 32 mm** wide on screen
  or print; mark no smaller than **16 px** (favicon) — below that, use the mark,
  never the full wordmark.

## Don't

- Don't recolour "Drone" to anything but Brand Gold (or use a full mono variant).
- Don't stretch, condense, rotate, add effects/shadows, or re-space the letters.
- Don't place the transparent full-colour wordmark on a mid-tone that kills
  contrast on either half — use a mono or `-bg` variant instead.

## Typography

The wordmark is set in **SF Pro Display Bold** (Apple system font). It is
delivered as outlined vector paths — no font file is needed to use the logo.
For companion text (headings, taglines), SF Pro / any clean grotesk pairs well.
