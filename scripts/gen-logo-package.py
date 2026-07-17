#!/usr/bin/env python3
"""
Generate the OpenDrone logo design package from the canonical traced wordmark.

Single source of truth for the glyph geometry is public/opendrone-wordmark.svg
(9 paths: O p e n D r o n e). "Open" = paths 0-3, "Drone" = paths 4-8.
Group transform maps potrace coords -> display units, same as the site chrome.

Outputs (into brand/):
  svg/   editable vector masters (full colour, on-light, on-dark, mono b/w, mark)
  pdf/   vector PDFs — open + edit natively in Illustrator / Affinity / Inkscape
  png/   raster previews at common sizes, transparent + on-brand backgrounds
No external Python deps; shells out to rsvg-convert for PDF/PNG rasterisation.
"""

import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "opendrone-wordmark.svg")
OUT = os.path.join(ROOT, "brand")

# ---- brand constants -------------------------------------------------------
GROUP_TF = "translate(0,433) scale(0.1,-0.1)"
# tight wordmark viewBox with ~36u side / ~17u top-bottom margin (from wordmark.ts)
WM_VIEWBOX = "-36 -17.32 2472 467.64"
# squared crop around the "O" glyph for the standalone mark (from favicon.svg)
MARK_VIEWBOX = "-25 -13 381 381"

GOLD = "#c89d2e"          # canonical brand gold on LIGHT bg (site --color-gold)
GOLD_BRIGHT = "#fdb600"   # brand gold on DARK bg — the physical product gold (motors)
GREEN = "#147a31"         # brand/PCB green — physical product green (motors)
GREEN_DEEP = "#327014"    # deep solder-mask PCB green (fills/borders)
INK = "#1a1a1e"           # near-black neutral for "Open" on light bg
PAPER = "#e5e5e5"         # off-white neutral for "Open" on dark bg
BG_DARK = "#0d0d10"       # brand dark surface
BG_LIGHT = "#f7f6f3"      # brand warm off-white surface


def load_paths():
    raw = open(SRC).read()
    paths = re.findall(r'<path d="(.*?)"', raw, re.S)
    if len(paths) != 9:
        sys.exit(f"expected 9 glyph paths, got {len(paths)}")
    return [" ".join(p.split()) for p in paths]  # normalise whitespace


def wordmark_svg(open_fill, drone_fill, viewbox=WM_VIEWBOX, bg=None):
    paths = load_paths()
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" '
        f'role="img" aria-label="OpenDrone">',
    ]
    if bg:
        # background rect spanning the viewBox
        x, y, w, h = [float(v) for v in viewbox.split()]
        parts.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{bg}"/>')
    parts.append(f'  <g transform="{GROUP_TF}" fill-rule="evenodd">')
    for i, d in enumerate(paths):
        fill = open_fill if i < 4 else drone_fill
        parts.append(f'    <path fill="{fill}" d="{d}"/>')
    parts.append("  </g>")
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def mark_svg(fill, bg=None):
    d = load_paths()[0]  # the "O"
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{MARK_VIEWBOX}" '
        f'role="img" aria-label="OpenDrone mark">',
    ]
    if bg:
        x, y, w, h = [float(v) for v in MARK_VIEWBOX.split()]
        parts.append(f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{bg}"/>')
    parts.append(f'  <g transform="{GROUP_TF}" fill="{fill}" fill-rule="evenodd">')
    parts.append(f'    <path d="{d}"/>')
    parts.append("  </g>")
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


# manifest: (relpath, svg-string, background-for-png-preview)
def build_manifest():
    return [
        # --- primary full-colour wordmark ---
        ("opendrone-wordmark-onlight.svg", wordmark_svg(INK, GOLD), None),
        ("opendrone-wordmark-ondark.svg", wordmark_svg(PAPER, GOLD_BRIGHT, bg=None), BG_DARK),
        # embedded-background lockups (safe on any surface)
        ("opendrone-wordmark-onlight-bg.svg", wordmark_svg(INK, GOLD, bg=BG_LIGHT), None),
        ("opendrone-wordmark-ondark-bg.svg", wordmark_svg(PAPER, GOLD_BRIGHT, bg=BG_DARK), None),
        # --- monochrome wordmark ---
        ("opendrone-wordmark-black.svg", wordmark_svg("#000000", "#000000"), None),
        ("opendrone-wordmark-white.svg", wordmark_svg("#ffffff", "#ffffff"), BG_DARK),
        ("opendrone-wordmark-gold.svg", wordmark_svg(GOLD, GOLD), None),
        # --- standalone "O" mark ---
        ("opendrone-mark-gold.svg", mark_svg(GOLD), None),
        ("opendrone-mark-black.svg", mark_svg("#000000"), None),
        ("opendrone-mark-white.svg", mark_svg("#ffffff"), BG_DARK),
    ]


def run(cmd):
    subprocess.run(cmd, check=True)


def main():
    for sub in ("svg", "pdf", "png"):
        os.makedirs(os.path.join(OUT, sub), exist_ok=True)

    manifest = build_manifest()
    for name, svg, png_bg in manifest:
        stem = name[:-4]
        svg_path = os.path.join(OUT, "svg", name)
        open(svg_path, "w").write(svg)

        # vector PDF (editable in Illustrator/Affinity/Inkscape)
        pdf_path = os.path.join(OUT, "pdf", stem + ".pdf")
        run(["rsvg-convert", "-f", "pdf", "-o", pdf_path, svg_path])

        # PNG previews. Wordmark -> 2400w; standalone mark -> 1024 square.
        is_mark = "-mark-" in stem
        for w in ((512, 1024) if is_mark else (1200, 2400)):
            png_path = os.path.join(OUT, "png", f"{stem}-{w}.png")
            cmd = ["rsvg-convert", "-f", "png", "-w", str(w), "-o", png_path]
            if png_bg:
                cmd += ["-b", png_bg]
            run(cmd + [svg_path])

    print(f"wrote {len(manifest)} logo variants to {OUT}/ (svg + pdf + png)")


if __name__ == "__main__":
    main()
