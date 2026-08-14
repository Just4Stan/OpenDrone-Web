#!/usr/bin/env python3
"""Build the site's runtime brand assets from the artwork already in this repo.

    python3 scripts/gen-site-assets.py

Reads only two files, both already served by the site:

    app/assets/favicon.svg        the OD mark
    public/opendrone-wordmark.svg the OpenDrone logotype

and writes the icons and the social card. It does not carry a copy of the
brand package: the masters live in OpenDrone-Brand and are generated there by
tools/generate.py. This script exists because a browser needs a 192px PNG and
an OG card at a fixed 1200x630, which are site plumbing, not brand assets.

Deterministic: SOURCE_DATE_EPOCH is pinned so repeated runs are byte-identical.

The OG card's tagline is converted to outlines at build time, so the committed
SVG carries no font dependency and renders the same on every machine. Doing
that needs SF Pro, so the tagline step is macOS-only; everything else is not.
"""

import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = dict(os.environ, SOURCE_DATE_EPOCH="1000000000")

GOLD = "#ffb700"          # one gold, both grounds. See brand/README.md.
INK = "#1a1a1e"
PAPER = "#e5e5e5"
BG_DARK = "#0d0d10"
WM_TF = "translate(0,433) scale(0.1,-0.1)"
TAGLINE = "Open source drone electronics, designed in Belgium"


def mark_path():
    svg = open(f"{ROOT}/app/assets/favicon.svg").read()
    d = re.search(r'<path d="([^"]+)"', svg)
    if not d:
        sys.exit("no path in app/assets/favicon.svg")
    return d.group(1)


def wordmark_paths():
    svg = open(f"{ROOT}/public/opendrone-wordmark.svg").read()
    p = re.findall(r'<path d="(.*?)"', svg, re.S)
    if len(p) != 9:
        sys.exit(f"expected 9 glyph paths, got {len(p)}")
    return [" ".join(x.split()) for x in p]


def outline(text, size):
    """Tagline as paths, so the committed SVG needs no font. Returns (d list, width)."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools.pens.svgPathPen import SVGPathPen
    f = instantiateVariableFont(TTFont("/System/Library/Fonts/SFNS.ttf"),
                                {"wght": 400, "opsz": 96}, inplace=True)
    gs, cm = f.getGlyphSet(), f.getBestCmap()
    k = size / f["head"].unitsPerEm
    out, x = [], 0.0
    for ch in text:
        g = cm.get(ord(ch))
        if g is None:
            continue
        pen = SVGPathPen(gs)
        gs[g].draw(pen)
        if pen.getCommands():
            out.append((pen.getCommands(), x * k))
        x += gs[g].width
    return out, x * k, k


def run(cmd):
    subprocess.run(cmd, check=True, env=ENV)


def build_icons():
    """PWA and Apple icons: the mark knocked out of a gold squircle."""
    d = mark_path()
    S, pad, radius = 1024.0, 0.18, 0.225
    # mark ink box in display units, from the favicon viewBox
    h = S * (1 - 2 * pad)
    k = h / 355.011
    w = 330.449 * k
    src = f"{ROOT}/public/_icon.svg"
    open(src, "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{S:.0f}" height="{S:.0f}" '
        f'viewBox="0 0 {S:.0f} {S:.0f}" role="img" aria-label="OpenDrone">\n'
        f'  <rect width="{S:.0f}" height="{S:.0f}" rx="{S * radius:.2f}" fill="{GOLD}"/>\n'
        f'  <g transform="translate({(S - w) / 2 - 0.593 * k:.4f},'
        f'{S * pad - 0.075 * k:.4f}) scale({k:.6f})">\n'
        f'    <g transform="{WM_TF}" fill="{BG_DARK}" fill-rule="evenodd">'
        f'<path d="{d}"/></g>\n  </g>\n</svg>\n')
    for name, px in (("icon-192", 192), ("icon-512", 512), ("apple-touch-icon", 180)):
        run(["rsvg-convert", "-f", "png", "-w", str(px), "-h", str(px),
             "-o", f"{ROOT}/public/{name}.png", src])
        print(f"   public/{name}.png")
    os.remove(src)


def build_og():
    """1200x630 social card: the real wordmark, not a webfont that will not load."""
    W, H = 1200, 630
    wm = wordmark_paths()
    k = 0.148                                  # wordmark cap ~53px
    wm_w, wm_h = 2400 * k, 355 * k
    x, y = (W - wm_w) / 2, 300.0
    glyphs = "".join(f'<path fill="{PAPER if i < 4 else GOLD}" d="{d}"/>' for i, d in enumerate(wm))
    body = (f'  <rect width="{W}" height="{H}" fill="{BG_DARK}"/>\n'
            f'  <g transform="translate({x:.3f},{y - 355.95 * k:.3f}) scale({k})">\n'
            f'    <g transform="{WM_TF}" fill-rule="evenodd">{glyphs}</g>\n  </g>\n')
    try:
        glyph_paths, tw, tk = outline(TAGLINE, 30)
        tx = (W - tw) / 2
        body += f'  <g fill="#8a8a8a">\n'
        for d, gx in glyph_paths:
            body += (f'    <path transform="translate({tx + gx:.3f},400) '
                     f'scale({tk:.6f},{-tk:.6f})" d="{d}"/>\n')
        body += "  </g>\n"
    except Exception as e:                     # noqa: BLE001 - font is optional
        print(f"   tagline skipped ({e.__class__.__name__}): SF Pro unavailable")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
           f'viewBox="0 0 {W} {H}" role="img" aria-label="OpenDrone">\n{body}</svg>\n')
    open(f"{ROOT}/public/og-image.svg", "w").write(svg)
    run(["rsvg-convert", "-f", "png", "-w", str(W), "-h", str(H),
         "-o", f"{ROOT}/public/og-image.png", f"{ROOT}/public/og-image.svg"])
    print("   public/og-image.svg + .png")


def build_wordmark_pngs():
    src = f"{ROOT}/public/opendrone-wordmark.svg"
    for px in (400, 1200, 2400):
        run(["rsvg-convert", "-f", "png", "-w", str(px),
             "-o", f"{ROOT}/public/opendrone-wordmark-{px}.png", src])
        print(f"   public/opendrone-wordmark-{px}.png")


if __name__ == "__main__":
    if not shutil.which("rsvg-convert"):
        sys.exit("rsvg-convert is required")
    print("icons:")
    build_icons()
    print("social card:")
    build_og()
    print("wordmark renditions:")
    build_wordmark_pngs()
