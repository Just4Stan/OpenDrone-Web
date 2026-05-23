# OpenESC editorial — `/products/openesc`

> source: app/lib/product-content.ts (openesc entry)

Per-product editorial copy for the OpenESC 4-in-1 ESC PDP. Keys are
stable IDs — edit only the text after each colon, and edit prose blocks
freely under their `### prose:` anchors. Anything inside a `do-not-edit`
fence is structural data (file numbers, URLs, part refs, costs) — leave it.

```do-not-edit
handle: openesc
fileNumber: 01
firmware.project: AM32
firmware.projectUrl: https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware
repoUrl: https://github.com/incutec-hw/OpenESC_20X20
teardown.boardArt.src: /boards/openesc/board.svg
teardown.boardArt.inspectUrl: https://kicanvas.org/?github=https://github.com/incutec-hw/OpenESC_20X20
downloads: [] (none published yet)
optionAxis: Model
```

## Hero

- **family:** 4-in-1 ESC
- **hero_line1:** An ESC
- **hero_line2_italic:** is not
- **hero_line3:** a miracle.

### prose: hero_lead

Four half-bridges, a gate driver, a microcontroller running AM32, and a current-sense shunt. That is the list. Open schematic, open layout, open BOM — €1 of every order forwarded to the AM32 maintainers, tracked publicly.

## Teardown

- **teardown_title:** Four chips. One sheet, used four times.

### prose: teardown_body

The schematic is split into a main sheet (power, current sensing, 8-pin connector) and one sub-sheet reused for each of the four channels. Each channel carries the AT32F421 running AM32, the NSG2065Q 3-phase gate driver, and six SP40N03GNJ MOSFETs wired as three half-bridges. Back-EMF feedback handles sensorless commutation.

### Teardown pins (label text)

Ref glyphs (`①②③④`) and the `cost` ×N counts are structural; edit only the
part text. Counts shown for context.

```do-not-edit
pin_1.cost: ×4   pin_2.cost: ×4   pin_3.cost: ×24   pin_4.cost: ×4
```

- **pin_1:** AT32F421G8U7 — 120 MHz M4 MCU
- **pin_2:** NSG2065Q gate driver (FD6288Q-compatible)
- **pin_3:** SP40N03GNJ MOSFET, 40 V / 2.9 mΩ
- **pin_4:** INA186A3 + 0.2 mΩ shunt

## In the box

Edit the item and note text; `qty` codes are in the do-not-edit fence.

```do-not-edit
qty (in order): 1×, 2×, 1×, 4×, 1×
```

- **box_1_item:** OpenESC 4-in-1 board
- **box_1_note:** model selected at checkout
- **box_2_item:** 8-pin Betaflight signal cable
- **box_2_note:** JST SM08B-SRSS-TB, pre-crimped, 8 cm
- **box_3_item:** XT60 battery pigtail with 470 µF low-ESR cap
- **box_4_item:** M3 rubber soft-mount grommets
- **box_5_item:** Build card
- **box_5_note:** batch ID, QC initials, firmware flash command, GitHub rev

## Downloads

No download assets are published yet (`downloads: []`). Source carries a
TODO to publish schematic.pdf, bom.csv, gerbers.zip, manual.pdf,
wiring.pdf, flashing.md to the OpenESC_20X20 repo and re-add the cards.
Nothing editable here until they ship.

## Specs

`[label, value]` pairs. Both label and value are editable copy.

- **spec_firmware:** AM32
- **spec_protocol:** DShot (Betaflight)
- **spec_input:** 3–6S LiPo (11.1–25.2 V)
- **spec_mcu:** AT32F421G8U7, 120 MHz
- **spec_gate_driver:** NSG2065Q (QFN-24)
- **spec_current_sense:** INA186A3 + 0.2 mΩ shunt
- **spec_power_rails:** LMR51420 buck + TLV76733 LDO
- **spec_connector:** JST SM08B-SRSS-TB (8-pin BF)
- **spec_license:** CERN-OHL-S-2.0

The spec labels (left column) are:

- **spec_label_1:** Firmware
- **spec_label_2:** Protocol
- **spec_label_3:** Input
- **spec_label_4:** MCU
- **spec_label_5:** Gate driver
- **spec_label_6:** Current sense
- **spec_label_7:** Power rails
- **spec_label_8:** Connector
- **spec_label_9:** License

## Variants (comparison ladder)

Keyed by the Shopify option value. Edit `tagline`, the highlight
label/value text, and per-variant spec deltas. `boardArt` is structural.

```do-not-edit
optionAxis: Model
variant keys: 20×20, 30×30
30×30.boardArt.src: /boards/openesc-30x30/board.svg
```

### Variant: 20×20

- **variant_20x20_tagline:** 20×20 mount, 35 A per channel — the standard stack size.
- **variant_20x20_highlight_1_label:** Mount
- **variant_20x20_highlight_1_value:** 20×20 · 30.5 holes
- **variant_20x20_highlight_2_label:** MOSFET
- **variant_20x20_highlight_2_value:** SP40N03GNJ
- **variant_20x20_highlight_3_label:** Continuous
- **variant_20x20_highlight_3_value:** 35 A / channel

Per-tier spec deltas (label/value, merged over base specs):

- **variant_20x20_spec_1_label:** Continuous
- **variant_20x20_spec_1_value:** 35 A / channel
- **variant_20x20_spec_2_label:** MOSFETs
- **variant_20x20_spec_2_value:** SP40N03GNJ, 40 V / 2.9 mΩ
- **variant_20x20_spec_3_label:** PCB
- **variant_20x20_spec_3_value:** 6-layer, 20×20 mount

### Variant: 30×30

- **variant_30x30_tagline:** 30×30 mount with higher-current SP40N01GHNK MOSFETs.
- **variant_30x30_highlight_1_label:** Mount
- **variant_30x30_highlight_1_value:** 30×30
- **variant_30x30_highlight_2_label:** MOSFET
- **variant_30x30_highlight_2_value:** SP40N01GHNK

Per-tier spec deltas (label/value, merged over base specs):

- **variant_30x30_spec_1_label:** MOSFETs
- **variant_30x30_spec_1_value:** SP40N01GHNK
- **variant_30x30_spec_2_label:** PCB
- **variant_30x30_spec_2_value:** 6-layer, 30×30 mount

## Pair CTA (cross-sell)

```do-not-edit
pairCta.to: /products/openstack
```

- **pair_eyebrow:** Better together
- **pair_title:** OpenStack — board on board, zero solder, one checkout.
