# OpenFrame editorial — `/products/openframe`

> source: app/lib/product-content.ts (openframe entry)

Per-product editorial copy for the OpenFrame carbon frame PDP. Keys are
stable IDs — edit only the text after each colon, and edit prose blocks
freely under their `### prose:` anchors. Anything inside a `do-not-edit`
fence is structural data (file numbers, URLs, part refs, costs) — leave it.

```do-not-edit
handle: openframe
fileNumber: 04
firmware.project: —   (no firmware; the €N+€1 chapter is suppressed)
repoUrl: https://github.com/OpenDrone-hw
teardown.frameViewer.src: /models/frame.glb   (inspectUrl omitted)
downloads: [] (none — frame is an OnShape doc, not a GitHub repo)
optionAxis: Model
```

## Hero

- **family:** Carbon Frame
- **hero_line1:** The body
- **hero_line2_italic:** the rest
- **hero_line3:** bolts into.

### prose: hero_lead

CNC carbon-fibre freestyle frame on a 30.5×30.5 stack pattern. Designed in-house and OEM-built to start, with our own machining planned for 2027. OpenFC and OpenESC drop in without spacers.

## Teardown

- **teardown_title:** It comes apart the way it goes together.

Note: `teardown.body` is currently an empty string in source — no prose to
edit. (Marked TODO/placeholder editorial in source.)

### Teardown pins (label text)

Ref glyphs (`①②③④`) and the `cost` ×N counts are structural; edit only the
part text. Counts shown for context.

```do-not-edit
pin_2.cost: ×4
```

- **pin_1:** Top plate — carbon, carries the camera + VTX bay
- **pin_2:** Arms — 5 mm carbon, replaced individually
- **pin_3:** Bottom plate — 30.5 × 30.5 stack pattern
- **pin_4:** M3 aluminium standoffs + hardware kit

## In the box

Edit the item text; `qty` codes are in the do-not-edit fence. (No notes on
any item.)

```do-not-edit
qty (in order): 1×, 4×, 1×, 1×, 1×, 1×
```

- **box_1_item:** Top plate + bottom plate
- **box_2_item:** 5" arms
- **box_3_item:** Hardware kit
- **box_4_item:** Camera mount
- **box_5_item:** VTX antenna tube clamp
- **box_6_item:** Build card

## Downloads

No download assets (`downloads: []`). Source notes the frame is an OnShape
document, not a GitHub repo; placeholder STEP/DXF/assembly links were
removed. DXF cutting files are not released. Nothing editable here until
the OnShape integration lands.

## Specs

`[label, value]` pairs. Both label and value are editable copy.

- **spec_arm_thickness:** 5 mm carbon
- **spec_camera:** 19 mm micro
- **spec_vtx_bay:** 20 × 20
- **spec_video_systems:** Analog · DJI O3/O4 · Walksnail · HDZero

The spec labels (left column) are:

- **spec_label_1:** Arm thickness
- **spec_label_2:** Camera
- **spec_label_3:** VTX bay
- **spec_label_4:** Video systems

## Footnote

### prose: footnote

We're looking into setting up our own in-house machining for 2027.

## Variants (comparison ladder)

Keyed by the Shopify option value. Both taglines are currently empty
strings in source — only the highlight label/value text is editable.
(Marked placeholder variant editorial in source.)

```do-not-edit
optionAxis: Model
variant keys: 5" Freestyle, 3" Freestyle
5" Freestyle.tagline: (empty)
3" Freestyle.tagline: (empty)
```

### Variant: 5" Freestyle

- **variant_5in_highlight_1_label:** Stack mounts
- **variant_5in_highlight_1_value:** 20×20 · 25×25 · 30×30
- **variant_5in_highlight_2_label:** Motor mount
- **variant_5in_highlight_2_value:** 16×16 · 19×19 (M3)

### Variant: 3" Freestyle

- **variant_3in_highlight_1_label:** Stack mounts
- **variant_3in_highlight_1_value:** 20×20 · 25×25
- **variant_3in_highlight_2_label:** Motor mount
- **variant_3in_highlight_2_value:** 9×9 · 12×12 (M2)
