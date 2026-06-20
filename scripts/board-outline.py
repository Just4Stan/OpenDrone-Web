#!/usr/bin/env python3
"""Emit the true board outline of a KiCad PCB as JSON.

    kicad-python board-outline.py <path-to-.kicad_pcb>

Uses pcbnew.GetBoardPolygonOutlines() — the same routine KiCad uses for
3D rendering and zone fills — so arcs, chamfers, castellations and inner
cutouts are resolved correctly into closed polygons. The Node export
script (export-board-art.mjs) consumes this to clip copper layers to the
real board edge instead of a bounding box.

Run with KiCad's bundled interpreter, e.g. on macOS:
  /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3

Output (stdout) is JSON:
  {
    "bbox": {"minX", "minY", "width", "height"},   # mm
    "outlineCount": <int>,                          # disjoint outer outlines
    "rings": [ [[x, y], ...], ... ]                 # mm, board frame
  }
Every ring (outer outlines and inner cutouts alike) is emitted as a flat
list of points; clip with fill-rule="evenodd" so cutouts subtract
regardless of winding.

`outlineCount` is the number of SEPARATE outer outlines (pcbnew
SHAPE_POLY_SET.OutlineCount()) — NOT the total ring count, which also
includes inner cutouts (mounting slots, drilled holes routed in
Edge.Cuts). A single board with cutouts has outlineCount == 1; a
production PANEL resolves to several disjoint outer outlines
(outlineCount > 1). The export script uses this to refuse panels, which
would otherwise render the whole array into one viewBox.
"""
import json
import sys

import pcbnew


def main() -> int:
    if len(sys.argv) != 2:
        sys.stderr.write("usage: board-outline.py <path-to-.kicad_pcb>\n")
        return 2

    board = pcbnew.LoadBoard(sys.argv[1])
    poly = pcbnew.SHAPE_POLY_SET()
    # aInferOutlineIfNecessary=True falls back to a bounding hull if the
    # Edge.Cuts don't form a closed loop, so this never returns empty.
    board.GetBoardPolygonOutlines(poly, True)

    to_mm = pcbnew.ToMM
    rings = []
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")

    def add_ring(chain):
        nonlocal min_x, min_y, max_x, max_y
        pts = []
        for k in range(chain.PointCount()):
            p = chain.CPoint(k)
            x, y = to_mm(p.x), to_mm(p.y)
            pts.append([x, y])
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
        if len(pts) >= 3:
            rings.append(pts)

    for i in range(poly.OutlineCount()):
        add_ring(poly.Outline(i))
        for j in range(poly.HoleCount(i)):
            add_ring(poly.Hole(i, j))

    if not rings:
        sys.stderr.write("no board outline found\n")
        return 1

    json.dump(
        {
            "bbox": {
                "minX": min_x,
                "minY": min_y,
                "width": max_x - min_x,
                "height": max_y - min_y,
            },
            "outlineCount": poly.OutlineCount(),
            "rings": rings,
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
