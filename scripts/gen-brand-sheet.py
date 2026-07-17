#!/usr/bin/env python3
"""
Compose a single-page OpenDrone brand sheet (PDF + PNG) from the logo package.
One deliverable the client can open to see every lockup, the mark, the mono
set, and the colour spec. Pure vector; rendered with rsvg-convert.
"""
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public", "opendrone-wordmark.svg")
OUT = os.path.join(ROOT, "brand")

GROUP_TF = "translate(0,433) scale(0.1,-0.1)"
WM_VB = "-36 -17.32 2472 467.64"
MARK_VB = "-25 -13 381 381"
GOLD, GOLD_BRIGHT, INK, PAPER = "#c89d2e", "#fdb600", "#1a1a1e", "#e5e5e5"
GREEN, GREEN_DEEP = "#147a31", "#327014"
BG_DARK, BG_LIGHT = "#0d0d10", "#f7f6f3"

P = [" ".join(p.split()) for p in re.findall(r'<path d="(.*?)"', open(SRC).read(), re.S)]


def wm(x, y, w, open_fill, drone_fill):
    h = w * 467.64 / 2472
    paths = "".join(
        f'<path fill="{open_fill if i < 4 else drone_fill}" d="{d}"/>' for i, d in enumerate(P)
    )
    return (f'<svg x="{x}" y="{y}" width="{w}" height="{h:.2f}" viewBox="{WM_VB}">'
            f'<g transform="{GROUP_TF}" fill-rule="evenodd">{paths}</g></svg>')


def mark(x, y, s, fill):
    return (f'<svg x="{x}" y="{y}" width="{s}" height="{s}" viewBox="{MARK_VB}">'
            f'<g transform="{GROUP_TF}" fill="{fill}" fill-rule="evenodd">'
            f'<path d="{P[0]}"/></g></svg>')


def txt(x, y, s, fill, t, weight=400, anchor="start", family="SF Pro Display, Helvetica, Arial, sans-serif"):
    return (f'<text x="{x}" y="{y}" font-size="{s}" fill="{fill}" font-weight="{weight}" '
            f'text-anchor="{anchor}" font-family="{family}">{t}</text>')


W, H = 1600, 1240
e = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="SF Pro Display, Helvetica, Arial, sans-serif">']
e.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')

# header
e.append(txt(80, 92, 46, INK, "OpenDrone", weight=700))
e.append(txt(80, 128, 22, "#57575c", "Brand &amp; Logo Sheet"))
e.append(f'<rect x="80" y="150" width="{W-160}" height="2" fill="#e5e2dc"/>')

# primary lockups: light card + dark card
e.append('<rect x="80" y="180" width="680" height="230" rx="10" fill="#f7f6f3" stroke="#e5e2dc"/>')
e.append(wm(150, 250, 540, INK, GOLD))
e.append(txt(100, 216, 16, "#86868c", "PRIMARY / ON LIGHT", weight=600))

e.append('<rect x="840" y="180" width="680" height="230" rx="10" fill="#0d0d10"/>')
e.append(wm(910, 250, 540, PAPER, GOLD_BRIGHT))  # gold goes bright on dark
e.append(txt(860, 216, 16, "#86868c", "PRIMARY / ON DARK", weight=600))

# mark row
e.append(txt(80, 470, 16, "#86868c", "MARK", weight=600))
e.append('<rect x="80" y="486" width="180" height="180" rx="10" fill="#f7f6f3" stroke="#e5e2dc"/>')
e.append(mark(120, 526, 100, GOLD))
e.append('<rect x="280" y="486" width="180" height="180" rx="10" fill="#0d0d10"/>')
e.append(mark(320, 526, 100, "#ffffff"))
e.append('<rect x="480" y="486" width="180" height="180" rx="10" fill="#f7f6f3" stroke="#e5e2dc"/>')
e.append(mark(520, 526, 100, INK))

# mono wordmarks
e.append(txt(720, 470, 16, "#86868c", "MONOCHROME", weight=600))
e.append('<rect x="720" y="486" width="800" height="80" rx="8" fill="#ffffff" stroke="#e5e2dc"/>')
e.append(wm(760, 505, 420, "#000000", "#000000"))
e.append('<rect x="720" y="586" width="800" height="80" rx="8" fill="#f7f6f3" stroke="#e5e2dc"/>')
e.append(wm(760, 605, 420, GOLD, GOLD))

# colour swatches — row 1 brand anchors, row 2 neutrals/surfaces
e.append(txt(80, 730, 16, "#86868c", "COLOUR", weight=600))


def swatch(x, y, name, hexv, label, note=None):
    e.append(f'<rect x="{x}" y="{y}" width="330" height="140" rx="10" fill="{hexv}" stroke="#e5e2dc"/>')
    e.append(txt(x + 20, y + 94, 20, label, name, weight=600))
    e.append(txt(x + 20, y + 120, 16, label, hexv.upper()))
    if note:
        e.append(txt(x + 310, y + 32, 13, label, note, anchor="end"))


row1 = [
    ("Brand Gold", GOLD, INK, "on light"),
    ("Gold Bright", GOLD_BRIGHT, INK, "on dark"),
    ("PCB Green", GREEN, "#ffffff", "motors"),
    ("PCB Green Deep", GREEN_DEEP, "#ffffff", "fills"),
]
row2 = [
    ("Ink", INK, "#ffffff", None),
    ("Off-white", PAPER, INK, None),
    ("Surface Dark", BG_DARK, "#ffffff", None),
    ("Surface Light", BG_LIGHT, INK, None),
]
for i, (name, hexv, label, note) in enumerate(row1):
    swatch(80 + i * 350, 748, name, hexv, label, note)
for i, (name, hexv, label, note) in enumerate(row2):
    swatch(80 + i * 350, 904, name, hexv, label, note)

# footer note
e.append(f'<rect x="80" y="1084" width="{W-160}" height="2" fill="#e5e2dc"/>')
e.append(txt(80, 1128, 18, INK, "Editable vector: open the PDF or SVG in Illustrator, Affinity Designer, or Inkscape.", weight=600))
e.append(txt(80, 1158, 16, "#57575c", "SF Pro Display Bold, outlined paths. Gold is background-aware: Brand Gold #C89D2E on light, Gold Bright #FDB600 on dark surfaces."))
e.append(txt(80, 1184, 16, "#57575c", "#FDB600 gold and #147A31 green are the physical product colours (motors); deep PCB green #327014 for fills. Brand Gold ≈ Pantone 111 C · CMYK 0/22/77/22 — verify on press."))
e.append(txt(80, 1210, 16, "#57575c", "opendrone.be"))
e.append("</svg>")

sheet = "\n".join(e)
svg_path = os.path.join(OUT, "opendrone-brand-sheet.svg")
open(svg_path, "w").write(sheet)
subprocess.run(["rsvg-convert", "-f", "pdf", "-o", os.path.join(OUT, "opendrone-brand-sheet.pdf"), svg_path], check=True)
subprocess.run(["rsvg-convert", "-f", "png", "-w", "1600", "-o", os.path.join(OUT, "opendrone-brand-sheet.png"), svg_path], check=True)
print("wrote brand sheet (svg + pdf + png)")
