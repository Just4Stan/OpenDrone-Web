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

Notes: github and repuUrl is the same?
## Hero

- **family:** 4-in-1 ESC
- **hero_line1:** An ESC (or 4)

### prose: hero_lead

6 mosfets per motor, 2 for each phase. Driven by a gate driver, controlled by a microcontroller. Duplicate that 4 times et voila, 'An ESC'.

## Teardown

- **teardown_title:** Isn't it beautiful? 

### prose: teardown_body

ESC have to carry a lot of current so optimized power routing matters. You can see it right here or check the interactive KiCAD viewer. Each AT32 microcontroller is running AM32. A large array of low-ESR, high capacitance ceramic capacitors feed the fast switching time of the MOSFET's to reduce voltage spikes. TVS diodes clamp any spikes that still get too high.

### Teardown pins (label text)

Ref glyphs (`①②③④`) and the `cost` ×N counts are structural; edit only the
part text. Counts shown for context.

```do-not-edit
pin_1.cost: ×4   pin_2.cost: ×4   pin_3.cost: ×24   pin_4.cost: ×1
```

- **pin_1:** AT32F421 MCU
- **pin_2:** NSG2065Q gate driver
- **pin_3:** Low Rds(on) MOSFET
- **pin_4:** INA186A3 + 0.2 mΩ shunt
  Notes:   add pin 5: Low ESR Caps

## In the box

Edit the item and note text; `qty` codes are in the do-not-edit fence.

Note: fix the qty with my changes

```do-not-edit
qty (in order): 1×, 2×, 1×, 4×, 1×
```

- **box_1_item:** OpenESC
- **box_2_item:** 8-pin JST cable
- **box_3_item:** XT battery pigtai
- **box_4_item:** M3 grommets
- **box_5_item:** Low-ESR Electrolytic Capacitor

## Downloads

Notes: There are no downloads, they are on github. Only a manual and maybe later a youtube video on how to flash and change settings for optimal performance.

## Specs

`[label, value]` pairs. Both label and value are editable copy.

- **spec_firmware:** AM32
- **spec_protocol:** DShot, PWM...
- **spec_input:** 3–6S LiPo (11.1–25.2 V)
- **spec_mcu:** AT32F421G8U7, 120 MHz
- **spec_gate_driver:** NSG2065Q (QFN-24)
- **spec_current_sense:** INA186A3 + 0.2 mΩ shunt
- **spec_power_rails:** LMR54406DBVR buck + TLV76733 LDO
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
