# OpenStack editorial — `/products/openstack`

> source: app/lib/product-content.ts (openstack entry)

Per-product editorial copy for the OpenStack FC + ESC bundle PDP. Keys are
stable IDs — edit only the text after each colon, and edit prose blocks
freely under their `### prose:` anchors. Anything inside a `do-not-edit`
fence is structural data (file numbers, URLs, part refs, handles) — leave it.

```do-not-edit
handle: openstack
fileNumber: 05
firmware.project: ""  (empty — single-project chapter suppressed; the
                       bundle chapter shows the per-component breakdown)
repoUrl: https://github.com/incutec-hw
bundle: renders the PDP as a bundle of openfc + openesc
```

## Hero

- **family:** FC + ESC Bundle
- **hero_line1:** The stack,
- **hero_line2_italic:** pre-stacked.
- **hero_line3:** Two boards, one checkout.

### prose: hero_lead

OpenFC and OpenESC built on the same 30.5 × 30.5 pattern. Buy them together, skip the courier round-trip, and bring-up is soldering headers, flashing once, and bolting it into OpenFrame. Two open firmwares, two maintainers paid — from one order.

## In the box

Edit the item and note text; `qty` codes are in the do-not-edit fence.

```do-not-edit
qty (in order): 1×, 1×, 1×, 1×, 1×, 4×, 1×
```

- **box_1_item:** OpenFC board
- **box_1_note:** break-off 2.4 GHz ELRS RX attached
- **box_2_item:** OpenESC 4-in-1 board
- **box_3_item:** 8-pin Betaflight signal cable
- **box_3_note:** JST SM08B-SRSS-TB, pre-crimped both ends — FC ↔ ESC, length matched for a 30.5 × 30.5 stack
- **box_4_item:** DJI/HD camera pigtail
- **box_4_note:** JST-SH1.0 6-pin ↔ GHR 10-pin
- **box_5_item:** XT60 battery pigtail with 470 µF low-ESR cap
- **box_6_item:** M3 rubber soft-mount grommets
- **box_7_item:** Build card
- **box_7_note:** batch IDs for both boards, QC initials, firmware flash commands (Betaflight + AM32), GitHub revs

## Downloads

Edit the `label` and `note` text. `kind` and `href` shown for context.

```do-not-edit
download_1: kind=schematic href=https://github.com/incutec-hw/OpenFC/raw/main/hardware/schematic.pdf
download_2: kind=step      href=https://github.com/incutec-hw/OpenStack/raw/main/hardware/stack.step
download_3: kind=manual    href=https://github.com/incutec-hw/OpenStack/raw/main/docs/guide.pdf
download_4: kind=flash     href=https://github.com/incutec-hw/OpenStack/blob/main/docs/flashing.md
```

- **download_1_label:** Schematics — FC + ESC
- **download_1_note:** Combined link — individual boards have their own repo
- **download_2_label:** 3D STEP — stacked assembly
- **download_2_note:** Both boards, 30.5 × 30.5 soft-mounted
- **download_3_label:** Stack guide (PDF)
- **download_3_note:** Wire harness routing, first-flash order, UART assignments
- **download_4_label:** Flash commands — Betaflight + AM32

## Specs

`[label, value]` pairs. Both label and value are editable copy.

- **spec_includes:** OpenFC + OpenESC
- **spec_mount:** 30.5 × 30.5
- **spec_fc_firmware:** Betaflight (RP2354B)
- **spec_esc_firmware:** AM32 (AT32F421 × 4)
- **spec_continuous:** 35 A / channel
- **spec_input:** 3–6S LiPo
- **spec_contribution:** €1 → Betaflight, €1 → AM32
- **spec_license:** CERN-OHL-S-2.0

The spec labels (left column) are:

- **spec_label_1:** Includes
- **spec_label_2:** Mount
- **spec_label_3:** FC firmware
- **spec_label_4:** ESC firmware
- **spec_label_5:** Continuous
- **spec_label_6:** Input
- **spec_label_7:** Contribution
- **spec_label_8:** License

## Footnote

### prose: footnote

Bundle price is OpenFC + OpenESC minus the courier/handling saved by shipping together. Firmware splits stay intact — Betaflight and AM32 each get their €1.

## Bundle components

Each component points at an existing PDP. Edit `title`, `firmware` name,
and the `blurb` prose. `handle` and `firmwareUrl` are structural.

```do-not-edit
component_1.handle: openfc    component_1.firmwareUrl: https://github.com/betaflight/betaflight
component_2.handle: openesc   component_2.firmwareUrl: https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware
```

### Component 1

- **component_1_title:** OpenFC
- **component_1_firmware:** Betaflight

### prose: component_1_blurb

RP2354B dual-core M33 with LSM6DSV16X IMU, BMP388 barometer, 16 MB blackbox and a break-off ExpressLRS RX on the same PCB.

### Component 2

- **component_2_title:** OpenESC
- **component_2_firmware:** AM32

### prose: component_2_blurb

Four AT32F421 channels, NSG2065Q gate drivers, 35 A continuous, INA186A3 + 0.2 mΩ current sensing. 20 × 20 carrier, 30.5 × 30.5 mount holes to match OpenFC.
