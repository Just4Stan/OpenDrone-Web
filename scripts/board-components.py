#!/usr/bin/env python3
"""Emit every component (footprint) of a KiCad PCB as JSON.

    kicad-python board-components.py <path-to-.kicad_pcb>

Sibling of board-outline.py — it reads the SAME board with the SAME pcbnew
unit conversion (pcbnew.ToMM, i.e. internal-nm / 1e6 → mm) so its output
lands in the IDENTICAL board-native coordinate frame. The Node export
script (export-board-art.mjs) then applies the single (dx, dy) translation
it already computes for the board outline to move every component into the
SVG viewBox frame, with no scale and no per-frame fudging.

For each footprint that has at least one pad (real component — passives
included; pure graphic/fiducial-only footprints with no pads are skipped as
noise) it emits:

  {
    "ref":        "U2",                  # reference designator
    "value":      "RP2354B",             # value field
    "footprint":  "lib:QFN-80_...",      # footprint library id
    "layer":      "F",                   # "F" (top) or "B" (bottom)
    "x": <mm>, "y": <mm>,                # GetPosition(), native frame
    "rot": <deg>,                        # GetOrientationDegrees()
    "bbox": {"x","y","w","h"},           # mm, native frame (see below)
    "courtyard": [[x, y], ...]           # mm, native frame; omitted if none
  }

bbox source, in priority order (tightest faithful component extent first):
  1. courtyard bounding box (F or B courtyard outline) when present,
  2. else the union of the pad bounding boxes (the metal footprint),
  3. else GetBoundingBox(False, False) (geometry only, text excluded).

All coordinates are in the board-native frame (Y positive-down, same as
pcbnew internal units), matching board-outline.py exactly.

Run with KiCad's bundled interpreter, e.g. on macOS:
  /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3
"""
import json
import sys

import pcbnew

to_mm = pcbnew.ToMM


def courtyard_polys(fp):
    """Return (points, bbox) for whichever courtyard outline exists, else
    (None, None). Points are mm in native frame; bbox is (minx,miny,maxx,maxy).
    Prefers the courtyard on the side the footprint sits on."""
    sides = (
        (pcbnew.F_CrtYd, pcbnew.B_CrtYd)
        if not fp.IsFlipped()
        else (pcbnew.B_CrtYd, pcbnew.F_CrtYd)
    )
    for layer in sides:
        cy = fp.GetCourtyard(layer)
        if cy.OutlineCount():
            outline = cy.Outline(0)
            pts = []
            minx = miny = float("inf")
            maxx = maxy = float("-inf")
            for k in range(outline.PointCount()):
                p = outline.CPoint(k)
                x, y = to_mm(p.x), to_mm(p.y)
                pts.append([x, y])
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
            if len(pts) >= 3:
                return pts, (minx, miny, maxx, maxy)
    return None, None


def pad_bbox(fp):
    """Union of pad bounding boxes in mm native frame, or None if no pads."""
    minx = miny = float("inf")
    maxx = maxy = float("-inf")
    n = 0
    for pad in fp.Pads():
        b = pad.GetBoundingBox()
        minx = min(minx, to_mm(b.GetX()))
        miny = min(miny, to_mm(b.GetY()))
        maxx = max(maxx, to_mm(b.GetX() + b.GetWidth()))
        maxy = max(maxy, to_mm(b.GetY() + b.GetHeight()))
        n += 1
    if n == 0:
        return None
    return (minx, miny, maxx, maxy)


def geom_bbox(fp):
    """GetBoundingBox geometry only (text excluded), mm native frame."""
    try:
        b = fp.GetBoundingBox(False, False)
    except TypeError:
        b = fp.GetBoundingBox()
    return (
        to_mm(b.GetX()),
        to_mm(b.GetY()),
        to_mm(b.GetX() + b.GetWidth()),
        to_mm(b.GetY() + b.GetHeight()),
    )


def main() -> int:
    if len(sys.argv) != 2:
        sys.stderr.write("usage: board-components.py <path-to-.kicad_pcb>\n")
        return 2

    board = pcbnew.LoadBoard(sys.argv[1])
    components = []

    for fp in board.GetFootprints():
        if len(fp.Pads()) == 0:
            # Graphic-only / fiducial / logo footprint — not a real component.
            continue

        cy_pts, cy_bbox = courtyard_polys(fp)
        if cy_bbox is not None:
            minx, miny, maxx, maxy = cy_bbox
        else:
            pb = pad_bbox(fp)
            minx, miny, maxx, maxy = pb if pb is not None else geom_bbox(fp)

        pos = fp.GetPosition()
        entry = {
            "ref": fp.GetReference(),
            "value": fp.GetValue(),
            "footprint": fp.GetFPID().GetUniStringLibId(),
            "layer": "B" if fp.IsFlipped() else "F",
            "x": to_mm(pos.x),
            "y": to_mm(pos.y),
            "rot": fp.GetOrientationDegrees(),
            "bbox": {
                "x": minx,
                "y": miny,
                "w": maxx - minx,
                "h": maxy - miny,
            },
        }
        if cy_pts is not None:
            entry["courtyard"] = cy_pts
        components.append(entry)

    if not components:
        sys.stderr.write("no components with pads found\n")
        return 1

    json.dump({"components": components}, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
