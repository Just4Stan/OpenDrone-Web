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

bbox source, in priority order (fully enclose the physical component first):
  1. courtyard bounding box (F or B courtyard outline) when present — the
     KiCad-authored keep-out, which already wraps the connector body;
  2. else GetBoundingBox(False, False) — the FULL footprint extent (pads PLUS
     graphics/silk/fab, i.e. the drawn body outline), text excluded.

A pad-union fallback was deliberately dropped: connectors (USB-C, microSD,
JST) carry their shell/body as silk+fab geometry that overhangs the pads, so a
pad-only box misses the part. GetBoundingBox(False, False) spans the whole
drawn body and keeps the highlight box over the real connector.

All coordinates are in the board-native frame (Y positive-down, same as
pcbnew internal units), matching board-outline.py exactly.

Run with KiCad's bundled interpreter, e.g. on macOS:
  /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3
"""
import json
import re
import sys

import pcbnew

to_mm = pcbnew.ToMM

# A board-outline footprint (the ESC's "4in1ESC" body, U4/U3) is one big
# footprint whose pads ARE the motor / battery / signal solder pads but carry no
# per-pad refdes — so they can't be highlighted individually. We detect such a
# footprint automatically (its bbox spans ~the whole board AND it has many pads)
# and ALSO emit one pseudo-component per meaningful pad net, ref'd
# "<FPREF>~<sanitized-net>", so the teardown can point pins at motor / battery /
# signal pad GROUPS. The parent footprint entry is kept unchanged.
#
# `bbox area >= this fraction of the board-edges bbox area` (plus the pad-count
# floor below) is what flags a board-outline footprint. The next-largest
# footprint on these boards is a JST connector at <70 mm^2 vs the board's
# ~1000-2000 mm^2, so the gap is enormous and 0.5 is safely between them. Pads
# overshoot the routed edge (CNC-trimmed flush by the fab), so the body bbox can
# exceed the board-edges bbox — the fraction is a floor, not a ceiling.
BOARD_OUTLINE_AREA_FRAC = 0.5
BOARD_OUTLINE_MIN_PADS = 10

# Mounting holes on a pad-carrier footprint are plated through-holes sitting on
# a power net (GND/BATT) at the board corners — electrically they're just chassis
# tie points, NOT a highlightable solder terminal. Left in, they swamped the
# "Battery pads" group (4 corner holes lit up instead of the real B+/B- lugs).
# We exclude any circular PTH pad whose drill is >= this (mm): the M3 mount holes
# here drill 3.0 mm (20x20) / 4.0 mm (30x30), while every real signal/power pad
# is either SMD (drill 0) or a slotted/rect PTH on a 0.4-1.2 mm drill — so 2.5
# cleanly separates the mount holes from every meaningful pad.
MOUNTING_HOLE_MIN_DRILL_MM = 2.5

# Nets that are not meaningful as a highlightable pad (no-connects, empty).
# Sanitized net names are matched case-insensitively against these prefixes.
SKIP_NET_PREFIXES = ("unconnected-", "")


def sanitize_net(net):
    """Net name -> compact pseudo-ref token. Strip a leading hierarchy slash,
    turn remaining slashes into underscores, and drop anything that isn't
    alphanumeric / + / _ so the token reads like the schematic net
    (/ESC4/MotorA -> ESC4_MotorA, /CSA+ -> CSA+, +BATT -> +BATT)."""
    s = net.lstrip("/")
    s = s.replace("/", "_")
    s = re.sub(r"[^A-Za-z0-9+_]", "", s)
    return s


def is_mounting_hole_pad(pad):
    """True for a plated mounting-hole pad: a circular PTH with a large drill.
    These corner holes ride on GND/BATT but aren't a real solder terminal, so
    they must be dropped from the pad pseudo-components (otherwise the Battery
    group highlights the 4 mount holes instead of the B+/B- lugs)."""
    if pad.GetAttribute() != pcbnew.PAD_ATTRIB_PTH:
        return False
    if pad.GetShape() != pcbnew.PAD_SHAPE_CIRCLE:
        return False
    return to_mm(pad.GetDrillSize().x) >= MOUNTING_HOLE_MIN_DRILL_MM


def pad_bbox(pad):
    """Pad bounding box (minx, miny, maxx, maxy) in mm, native frame."""
    b = pad.GetBoundingBox()
    return (
        to_mm(b.GetX()),
        to_mm(b.GetY()),
        to_mm(b.GetX() + b.GetWidth()),
        to_mm(b.GetY() + b.GetHeight()),
    )


def board_area_mm2(board):
    """Area (mm^2) of the board-edges bounding box, used to auto-detect a
    footprint whose body spans ~the whole board."""
    b = board.GetBoardEdgesBoundingBox()
    return to_mm(b.GetWidth()) * to_mm(b.GetHeight())


def fp_bbox_area_mm2(fp):
    """Area (mm^2) of a footprint's full bounding box (pads + graphics)."""
    minx, miny, maxx, maxy = geom_bbox(fp)
    return max(0.0, maxx - minx) * max(0.0, maxy - miny)


def is_board_outline_fp(fp, board_area):
    """True for a footprint that IS the board outline / pad carrier: many pads
    and a body that spans ~the whole board. Repeatable for any board, not
    hardcoded to U4/U3."""
    if len(fp.Pads()) < BOARD_OUTLINE_MIN_PADS:
        return False
    if board_area <= 0:
        return False
    return fp_bbox_area_mm2(fp) >= BOARD_OUTLINE_AREA_FRAC * board_area


def pad_pseudo_components(fp):
    """Emit one pseudo-component per meaningful pad of a board-outline footprint.
    ref = "<FPREF>~<sanitized-net>"; multiple pads on one net get _1/_2/...
    suffixes. layer follows the parent footprint side; bbox is the pad's bbox in
    the native frame (same translation as every other entry lands it in the
    viewBox)."""
    ref = fp.GetReference()
    layer = "B" if fp.IsFlipped() else "F"
    # Group pads by sanitized net so we can decide whether to suffix.
    by_net = {}
    for pad in fp.Pads():
        net = pad.GetNetname()
        if not net:
            continue
        if is_mounting_hole_pad(pad):
            # Plated corner mount hole — not a highlightable terminal.
            continue
        token = sanitize_net(net)
        low = net.lower()
        if low.startswith("unconnected-") or token == "":
            continue
        by_net.setdefault(token, []).append(pad)
    out = []
    for token, pads in by_net.items():
        multi = len(pads) > 1
        for i, pad in enumerate(pads, start=1):
            minx, miny, maxx, maxy = pad_bbox(pad)
            pref = f"{ref}~{token}" + (f"_{i}" if multi else "")
            out.append(
                {
                    "ref": pref,
                    "value": pad.GetNetname(),
                    "footprint": fp.GetFPID().GetUniStringLibId(),
                    "layer": layer,
                    "x": (minx + maxx) / 2,
                    "y": (miny + maxy) / 2,
                    "rot": 0.0,
                    "bbox": {
                        "x": minx,
                        "y": miny,
                        "w": maxx - minx,
                        "h": maxy - miny,
                    },
                }
            )
    return out


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


def geom_bbox(fp):
    """Full footprint bounding box (pads + graphics/silk/fab, text excluded),
    mm native frame. This is the drawn-body extent, so it encloses connector
    shells/bodies that overhang the pads (USB-C, microSD, JST)."""
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
    board_area = board_area_mm2(board)

    for fp in board.GetFootprints():
        if len(fp.Pads()) == 0:
            # Graphic-only / fiducial / logo footprint — not a real component.
            continue

        # Board-outline / pad-carrier footprints (e.g. the ESC body U4/U3) ALSO
        # emit per-pad pseudo-components so the motor / battery / signal solder
        # pads — which share one refdes — can be highlighted as groups. The
        # parent footprint entry below is still emitted unchanged.
        if is_board_outline_fp(fp, board_area):
            components.extend(pad_pseudo_components(fp))

        cy_pts, cy_bbox = courtyard_polys(fp)
        if cy_bbox is not None:
            minx, miny, maxx, maxy = cy_bbox
        else:
            # No courtyard: use the FULL footprint extent (body outline incl.
            # silk/fab), NOT a pad-union — the latter misses connector
            # shells/bodies that overhang the pads.
            minx, miny, maxx, maxy = geom_bbox(fp)

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
