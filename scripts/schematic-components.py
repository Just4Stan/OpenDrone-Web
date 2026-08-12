#!/usr/bin/env python3
"""Whole-symbol bounding boxes per schematic sheet, for the PDP's hover
highlight (the schematic analogue of board-components.py).

    python3 scripts/schematic-components.py <root.kicad_sch>

Walks the hierarchy from the root sheet (each (sheet ...) block names its
child file), computes each placed symbol's bounding box from the embedded
lib_symbols geometry (rectangles, polylines, circles, arcs, pins), and prints
JSON to stdout:

    {"sheets": {"<slug>": {"components": {"C33": [[x, y, w, h], ...]}}}}

Coordinates are schematic millimetres, which is exactly the coordinate space
of the SVGs kicad-cli exports (verified: symbol anchors line up with the
invisible <text> metadata in the sheets), so the viewer can draw these boxes
straight into the sheet's viewBox. Slugs mirror export-schematics.mjs: the
root file is "root", every child sheet is its sheet NAME lowercased (that is
how kicad-cli names the per-sheet SVGs). Multi-unit symbols yield one box per
placed unit under the same reference. Power symbols (#PWR/#FLG) are skipped.

Pure stdlib; run with any python3. No KiCad needed.
"""

import json
import math
import sys
from pathlib import Path


# ---------------------------------------------------------------- s-expressions
def parse_sexp(text):
    """Parse a KiCad s-expression file into nested lists of str/float."""
    i, n = 0, len(text)

    def parse():
        nonlocal i
        while i < n and text[i] in " \t\r\n":
            i += 1
        if text[i] == "(":
            i += 1
            out = []
            while True:
                while i < n and text[i] in " \t\r\n":
                    i += 1
                if text[i] == ")":
                    i += 1
                    return out
                out.append(parse())
        if text[i] == '"':
            i += 1
            s = []
            while text[i] != '"':
                if text[i] == "\\":
                    i += 1
                s.append(text[i])
                i += 1
            i += 1
            return "".join(s)
        s = i
        while i < n and text[i] not in " \t\r\n()":
            i += 1
        atom = text[s:i]
        try:
            return float(atom)
        except ValueError:
            return atom

    return parse()


def children(node, tag):
    return [c for c in node if isinstance(c, list) and c and c[0] == tag]


def child(node, tag):
    for c in node:
        if isinstance(c, list) and c and c[0] == tag:
            return c
    return None


def prop(node, name):
    for c in children(node, "property"):
        if len(c) >= 3 and c[1] == name:
            return c[2]
    return None


# ------------------------------------------------------------- symbol geometry
class BBox:
    def __init__(self):
        self.min_x = math.inf
        self.min_y = math.inf
        self.max_x = -math.inf
        self.max_y = -math.inf

    def add(self, x, y):
        self.min_x = min(self.min_x, x)
        self.min_y = min(self.min_y, y)
        self.max_x = max(self.max_x, x)
        self.max_y = max(self.max_y, y)

    def ok(self):
        return self.min_x <= self.max_x

    def points(self):
        return [
            (self.min_x, self.min_y),
            (self.max_x, self.min_y),
            (self.max_x, self.max_y),
            (self.min_x, self.max_y),
        ]


def unit_extent(sym_node, bbox):
    """Accumulate one lib sub-symbol's drawing extent into bbox (symbol space)."""
    for rect in children(sym_node, "rectangle"):
        for tag in ("start", "end"):
            pt = child(rect, tag)
            if pt:
                bbox.add(pt[1], pt[2])
    for poly in children(sym_node, "polyline"):
        pts = child(poly, "pts")
        if pts:
            for xy in children(pts, "xy"):
                bbox.add(xy[1], xy[2])
    for circ in children(sym_node, "circle"):
        c = child(circ, "center")
        r = child(circ, "radius")
        if c and r:
            bbox.add(c[1] - r[1], c[2] - r[1])
            bbox.add(c[1] + r[1], c[2] + r[1])
    for arc in children(sym_node, "arc"):
        for tag in ("start", "mid", "end"):
            pt = child(arc, tag)
            if pt:
                bbox.add(pt[1], pt[2])
    for pin in children(sym_node, "pin"):
        at = child(pin, "at")
        ln = child(pin, "length")
        if not at:
            continue
        x, y = at[1], at[2]
        bbox.add(x, y)
        if ln:
            ang = math.radians(at[3] if len(at) > 3 else 0)
            bbox.add(x + ln[1] * math.cos(ang), y + ln[1] * math.sin(ang))


def lib_extents(sch):
    """lib_id -> {unit -> BBox} from the file's embedded lib_symbols."""
    out = {}
    libs = child(sch, "lib_symbols")
    if not libs:
        return out
    for sym in children(libs, "symbol"):
        lib_id = sym[1]
        units = out.setdefault(lib_id, {})
        for sub in children(sym, "symbol"):
            # "<name>_<unit>_<bodystyle>"
            parts = str(sub[1]).rsplit("_", 2)
            if len(parts) != 3:
                continue
            unit = int(parts[1])
            box = units.setdefault(unit, BBox())
            unit_extent(sub, box)
    return out


def instance_box(inst, exts):
    """Sheet-space bbox [x, y, w, h] for one placed symbol, or None."""
    lib_id = child(inst, "lib_id")
    at = child(inst, "at")
    if not lib_id or not at:
        return None
    units = exts.get(lib_id[1])
    if not units:
        return None
    unit_node = child(inst, "unit")
    unit = int(unit_node[1]) if unit_node else 1
    mirror = child(inst, "mirror")
    mirror_ax = mirror[1] if mirror and len(mirror) > 1 else None
    x0, y0 = at[1], at[2]
    rot = (at[3] if len(at) > 3 else 0) % 360

    merged = BBox()
    for u in (0, unit):
        b = units.get(u)
        if b and b.ok():
            for px, py in b.points():
                merged.add(px, py)
    if not merged.ok():
        return None

    out = BBox()
    for sx, sy in merged.points():
        if mirror_ax == "x":
            sy = -sy
        elif mirror_ax == "y":
            sx = -sx
        if rot == 90:
            rx, ry = -sy, sx
        elif rot == 180:
            rx, ry = -sx, -sy
        elif rot == 270:
            rx, ry = sy, -sx
        else:
            rx, ry = sx, sy
        # Symbol space is y-up; the sheet (and the exported SVG) is y-down.
        out.add(x0 + rx, y0 - ry)
    return [
        round(out.min_x, 3),
        round(out.min_y, 3),
        round(out.max_x - out.min_x, 3),
        round(out.max_y - out.min_y, 3),
    ]


def sheet_components(path):
    sch = parse_sexp(path.read_text())
    exts = lib_extents(sch)
    comps = {}
    for inst in children(sch, "symbol"):
        ref = prop(inst, "Reference")
        if not ref or ref.startswith("#"):
            continue
        box = instance_box(inst, exts)
        if box:
            comps.setdefault(ref, []).append(box)
    return sch, comps


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: schematic-components.py <root.kicad_sch>")
    root = Path(sys.argv[1]).resolve()
    sheets = {}
    root_sch, root_comps = sheet_components(root)
    sheets["root"] = {"components": root_comps}
    for sh in children(root_sch, "sheet"):
        name = prop(sh, "Sheetname")
        file = prop(sh, "Sheetfile")
        if not name or not file:
            continue
        child_path = (root.parent / file).resolve()
        if not child_path.exists():
            continue
        _, comps = sheet_components(child_path)
        # kicad-cli names each per-sheet SVG after the sheet NAME; the export
        # script lowercases that for the slug. Mirror it exactly.
        sheets[name.lower()] = {"components": comps}
    json.dump({"sheets": sheets}, sys.stdout)


if __name__ == "__main__":
    main()
