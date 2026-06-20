#!/usr/bin/env python3
"""Locate the board SUBSTRATE in a render_board.py PNG via its SOLDERMASK bbox.

    python3 board-render-fit.py <render.png> [--mirror] [--expect-aspect R]

The export script (export-board-art.mjs) renders each board side orthographically
(render_board.py -> kicad-cli pcb render) on a TRANSPARENT background, then trims +
squares + centres the result to a fixed square (1568^2). To register that PNG with
the copper/components frame (master viewBox = Edge.Cuts bbox) it needs the pixel
rectangle the *board substrate* occupies in the render.

WHY NOT THE FULL ALPHA BBOX (the previous method):
The copper layers and the UI's component-highlight boxes are all anchored to the
Edge.Cuts outline (the master viewBox). The full alpha bbox of every opaque pixel
ALSO includes 3D parts that stand PROUD of the routed board edge: USB shells, JST
connector bodies, U.FL connectors and antennas overhang the edge; castellated /
edge pads overshoot it (JLCPCB CNC-trims them flush in production). Registering the
face by that silhouette scales/centres it to the overhanging metal, not to
Edge.Cuts, so the face disagrees with every other layer by the overhang amount and
over-scales / clips on boards with large overhang. The user's symptom: "the
photoreal face doesn't line up with the copper layers; parts are cut off."

THE FIX -- register to the SOLDERMASK SUBSTRATE:
These boards are GREEN soldermask. The routed substrate is the green board area.
Overhanging METAL (gold/silver: USB shells, connector bodies, U.FL, edge pads) is
NOT green and sits OUTSIDE the routed edge, so it is excluded. Tall components that
sit ON the board are within the board footprint and so don't extend the substrate
bbox. The soldermask-region bbox therefore ~= the Edge.Cuts bbox, which is exactly
the frame the copper + highlights use.

DETECTION (deterministic, fixed thresholds):
A pixel is "board soldermask" when it is opaque, saturated, non-black, AND its HSV
hue lies in a band around the board's dominant mask hue. We pick the mask hue
generically (rather than hard-coding green): histogram the hues of the saturated
opaque pixels, smooth it circularly, and take the dominant peak -- soldermask is by
far the largest coloured area, so the peak is the mask hue (~72deg green on every
current OpenDrone board). The band runs from a little below the peak to well above
it (HUE_LO/HI_OFFSET), which merges the TWO mask shades these renders show -- mask
over bare FR4 (~hue 72, yellow-green) and mask over copper flood (~hue 152, a more
cyan green) -- without crossing the valley down into the gold (~hue 52) and copper
(~hue 22) peaks. So overhanging/edge metal is excluded: gold/copper pads sit below
the band, silver USB shells / pin headers are near-grey (filtered by saturation).
The soldermask bbox is therefore the routed substrate, not the silhouette of proud
parts. (An energy/dominant-channel pick was rejected: on gold-flooded ESC boards
red carries more total energy than green and the pick lands on the gold overhang,
re-introducing the original bug.)

CROSS-VALIDATION (`--expect-aspect`):
Pass the Edge.Cuts bbox aspect (width/height, from board-outline.py / pcbnew). If
the detected soldermask bbox aspect deviates from it by more than ASPECT_TOL, the
detection is presumed to have failed (a green component caught, mask too dark to
detect, wrong board) and we FAIL LOUDLY rather than emit a bad fit. Real boards with
castellated / scalloped edges legitimately render a hair narrower than their
Edge.Cuts bbox (the substrate min/max is the castellation inner wall, Edge.Cuts
traces the outer arc), so the tolerance is set above that real-geometry floor but
well below the gross error a detection failure produces.

`--mirror` flips the image horizontally first -- used for the bottom render so the
detected frame (and thus the embedded face) lands in the same un-mirrored
look-through top-down frame as the copper + components.

Output (stdout) JSON, pixel coordinates in the (optionally mirrored) image.
`left/top` are the first soldermask pixel; `right/bottom` are ONE PAST the last
(half-open, so right-left == covered pixel span). The caller maps
[left, right] -> [viewBox min, viewBox max]:
  {"imgW", "imgH", "left", "right", "top", "bottom", "mirror",
   "method", "maskHueDeg", "aspect", "expectAspect", "aspectDevPct"}
"""
import json
import sys

import numpy as np
from PIL import Image

# Fixed, deterministic thresholds.
ALPHA_THRESH = 128       # > this 8-bit alpha == opaque
SAT_THRESH = 0.18        # min HSV saturation to count as coloured soldermask
VAL_THRESH = 25          # min max-channel (brightness) to reject near-black
# Mask hue band, RELATIVE to the detected dominant mask-hue peak. Soldermask shows
# two shades on these renders (over bare FR4 ~hue 72, over copper flood ~hue 152,
# both green); a band from a little below the peak to well above it merges both
# shades while staying ABOVE the gold/copper valley (gold ~hue 52, copper ~hue 22).
# This adapts to whatever the dominant mask hue is rather than hard-coding green.
HUE_LO_OFFSET = -10.0    # degrees below the peak
HUE_HI_OFFSET = 100.0    # degrees above the peak
# Cross-validation tolerance. Real castellated/scalloped edges render up to ~1.3%
# narrower than the Edge.Cuts bbox (the substrate min/max is the castellation inner
# wall while Edge.Cuts traces the outer arc); a true detection failure is several %
# to tens of %. 3% rejects the latter without rejecting honest edge geometry.
ASPECT_TOL_PCT = 3.0


def main() -> int:
    raw = sys.argv[1:]
    mirror = "--mirror" in raw
    expect_aspect = None
    args = []
    i = 0
    while i < len(raw):
        a = raw[i]
        if a == "--mirror":
            i += 1
            continue
        if a == "--expect-aspect":
            expect_aspect = float(raw[i + 1])
            i += 2
            continue
        args.append(a)
        i += 1
    if len(args) != 1:
        sys.stderr.write(
            "usage: board-render-fit.py <render.png> [--mirror] "
            "[--expect-aspect R]\n"
        )
        return 2

    im = Image.open(args[0]).convert("RGBA")
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    a = np.asarray(im).astype(np.float64)
    h, w = a.shape[:2]
    op = a[:, :, 3] > ALPHA_THRESH
    if not op.any():
        sys.stderr.write("no opaque pixels found in render\n")
        return 1

    r = a[:, :, 0]
    g = a[:, :, 1]
    b = a[:, :, 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    diff = mx - mn
    sat = np.where(mx > 0, diff / np.maximum(mx, 1e-9), 0.0)

    # HSV hue in degrees [0,360), standard hexcone conversion.
    hue = np.zeros((h, w), dtype=np.float64)
    nz = diff > 1e-9
    rmax = nz & (mx == r)
    gmax = nz & (mx == g) & ~rmax
    bmax = nz & (mx == b) & ~rmax & ~gmax
    with np.errstate(invalid="ignore", divide="ignore"):
        hue[rmax] = ((g[rmax] - b[rmax]) / diff[rmax]) % 6.0
        hue[gmax] = (b[gmax] - r[gmax]) / diff[gmax] + 2.0
        hue[bmax] = (r[bmax] - g[bmax]) / diff[bmax] + 4.0
    hue = (hue * 60.0) % 360.0

    # Coloured (saturated, non-black, opaque) pixels are mask + silk + copper.
    coloured = op & (sat > SAT_THRESH) & (mx > VAL_THRESH)
    if coloured.sum() < 200:
        sys.stderr.write("too few coloured pixels to detect soldermask\n")
        return 1

    # Dominant mask hue = peak of the (circularly smoothed) hue histogram of the
    # coloured pixels. Soldermask is by far the largest coloured area, so the peak
    # is the mask hue (~72deg green here). Adapts to any single saturated mask hue.
    hist = np.bincount(hue[coloured].astype(int) % 360, minlength=360).astype(
        np.float64
    )
    win = 11
    pad = win // 2
    kern = np.ones(win) / win
    smooth = np.convolve(
        np.concatenate([hist[-pad:], hist, hist[:pad]]), kern, "same"
    )[pad:-pad]
    peak = int(np.argmax(smooth))

    # Soldermask = coloured AND hue within the band around the peak (circular). The
    # band reaches up across the second mask shade but not down into gold/copper.
    dh = ((hue - peak + 180.0) % 360.0) - 180.0  # signed circular distance
    mask = coloured & (dh >= HUE_LO_OFFSET) & (dh <= HUE_HI_OFFSET)

    cols = np.where(mask.any(axis=0))[0]
    rows = np.where(mask.any(axis=1))[0]
    if cols.size == 0 or rows.size == 0:
        sys.stderr.write("no soldermask pixels found in render\n")
        return 1

    left = int(cols.min())
    right = int(cols.max()) + 1
    top = int(rows.min())
    bottom = int(rows.max()) + 1
    aspect = (right - left) / (bottom - top)

    dev_pct = None
    if expect_aspect is not None and expect_aspect > 0:
        dev_pct = abs(aspect - expect_aspect) / expect_aspect * 100.0
        if dev_pct > ASPECT_TOL_PCT:
            sys.stderr.write(
                "soldermask-substrate cross-validation FAILED for "
                f"{args[0]}: detected aspect {aspect:.4f} vs Edge.Cuts "
                f"{expect_aspect:.4f} ({dev_pct:.2f}% > {ASPECT_TOL_PCT}% "
                "tol). Detection likely caught a non-substrate region or the "
                "mask hue was mis-identified -- refusing to emit a bad fit.\n"
            )
            return 1

    json.dump(
        {
            "imgW": w,
            "imgH": h,
            "left": left,
            "right": right,
            "top": top,
            "bottom": bottom,
            "mirror": mirror,
            "method": "soldermask-bbox",
            "maskHueDeg": peak,
            "aspect": round(aspect, 5),
            "expectAspect": expect_aspect,
            "aspectDevPct": None if dev_pct is None else round(dev_pct, 3),
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
