# OpenRX editorial — `/products/openrx`

> source: app/lib/product-content.ts (openrx entry)

Per-product editorial copy for the OpenRX ELRS receiver line PDP. Keys are
stable IDs — edit only the text after each colon, and edit prose blocks
freely under their `### prose:` anchors. Anything inside a `do-not-edit`
fence is structural data (file numbers, URLs, part refs) — leave it.

```do-not-edit
handle: openrx
fileNumber: 03
firmware.project: ExpressLRS
firmware.projectUrl: https://github.com/ExpressLRS/ExpressLRS
repoUrl: https://github.com/OpenDrone-hw/OpenRX
teardown.boardArt: (none at base level)
optionAxis: Model
```

## Hero

- **family:** ELRS Receiver
- **hero_line1:** An ExpressLRS receiver,
- **hero_line2_italic:** open
- **hero_line3:** from antenna to firmware.

### prose: hero_lead

Four board designs, one firmware. Lite runs SX1281 on 2.4 GHz with a ceramic antenna. Lite-UFL swaps to a U.FL pigtail. Mono steps up to a single LR1121 for multi-band. Gemini runs dual LR1121 in ExpressLRS Xrossband mode for frequency-diverse links.

## Teardown

- **teardown_title:** One ESP32-C3, one (or two) radios, careful RF.

### prose: teardown_body

Every variant runs on the ESP32-C3 at the MCU layer. Lite uses Semtech SX1281 with the 2450FM07D0034 BPF; Mono and Gemini use Semtech LR1121 with the RFX2401C + SKY13414 + Johanson IPD front-end. Firmware targets upstream to ExpressLRS (Unified_ESP32C3_2400_RX for Lite, Unified_ESP32C3_LR1121_RX for Mono/Gemini).

### Teardown pins (label text)

Ref glyphs (`①②③④`) are structural; edit only the part text after each.

- **pin_1:** ESP32-C3 — Wi-Fi OTA + CRSF
- **pin_2:** SX1281 (Lite) or LR1121 (Mono/Gemini)
- **pin_3:** RFX2401C + SKY13414 front-end (Mono/Gemini)
- **pin_4:** U.FL or ceramic antenna

## In the box (shared)

Edit the item and note text; `qty` codes are in the do-not-edit fence.
Per-variant additions appear under each variant below.

```do-not-edit
qty (in order): 1×, 1×, 1×, 1×
```

- **box_1_item:** OpenRX board
- **box_1_note:** tier selected at checkout
- **box_2_item:** CRSF servo cable
- **box_2_note:** 3-pin JST-SH1.0, pre-crimped, 10 cm
- **box_3_item:** Heat-shrink sleeve + double-sided tape
- **box_4_item:** Build card
- **box_4_note:** batch ID, QC initials, ExpressLRS flash target, GitHub rev

## Downloads

Edit the `label` and `note` text. `kind` and `href` shown for context.

```do-not-edit
download_1: kind=schematic href=https://github.com/OpenDrone-hw/OpenRX/raw/main/hardware/schematic.pdf
download_2: kind=step      href=https://github.com/OpenDrone-hw/OpenRX/raw/main/hardware/boards.step
download_3: kind=bom       href=https://github.com/OpenDrone-hw/OpenRX/raw/main/hardware/bom.csv
download_4: kind=gerber    href=https://github.com/OpenDrone-hw/OpenRX/raw/main/hardware/gerbers.zip
download_5: kind=manual    href=https://github.com/OpenDrone-hw/OpenRX/raw/main/docs/manual.pdf
download_6: kind=flash     href=https://github.com/OpenDrone-hw/OpenRX/blob/main/docs/flashing.md
```

- **download_1_label:** Schematic (PDF)
- **download_1_note:** All four variants — Lite / Lite-UFL / Mono / Gemini
- **download_2_label:** 3D STEP — all variants
- **download_3_label:** BOM (CSV)
- **download_3_note:** Per-variant — front-end parts only on Mono/Gemini
- **download_4_label:** Gerbers (ZIP)
- **download_5_label:** User manual (PDF)
- **download_6_label:** ExpressLRS flash targets
- **download_6_note:** Unified_ESP32C3_2400_RX (Lite), Unified_ESP32C3_LR1121_RX (Mono/Gemini)

## Specs (shared)

`[label, value]` pairs. Both label and value are editable copy.

- **spec_firmware:** ExpressLRS
- **spec_telemetry:** CRSF
- **spec_mcu:** ESP32-C3
- **spec_flashing:** UART first, then Wi-Fi OTA / BF passthrough
- **spec_license:** CERN-OHL-S-2.0

The spec labels (left column) are:

- **spec_label_1:** Firmware
- **spec_label_2:** Telemetry
- **spec_label_3:** MCU
- **spec_label_4:** Flashing
- **spec_label_5:** License

## Footnote

### prose: footnote

Variants will land as Shopify options once the test batch of Mono and Gemini returns. Lite and Lite-UFL ship first.

## Variants (comparison ladder)

Keyed by the Shopify option value. Edit `tagline`, highlight label/value
text, and any per-variant box item/note text. `boardArt` is structural.

```do-not-edit
optionAxis: Model
variant keys: Lite, Lite-UFL, Mono, Gemini
Lite.boardArt.src: /boards/openrx-lite/board.svg
Lite-UFL.boardArt.src: /boards/openrx-lite-ufl/board.svg
Mono.boardArt.src: /boards/openrx-mono/board.svg
Gemini.boardArt.src: /boards/openrx-gemini/board.svg
```

### Variant: Lite

- **variant_lite_tagline:** SX1281 on 2.4 GHz with an on-board ceramic antenna — the low-cost default.
- **variant_lite_highlight_1_label:** Radio
- **variant_lite_highlight_1_value:** Semtech SX1281
- **variant_lite_highlight_2_label:** Band
- **variant_lite_highlight_2_value:** 2.4 GHz
- **variant_lite_highlight_3_label:** Antenna
- **variant_lite_highlight_3_value:** Ceramic, on-board

### Variant: Lite-UFL

- **variant_lite_ufl_tagline:** Same SX1281 radio, swapped to a U.FL pigtail for an external antenna.
- **variant_lite_ufl_highlight_1_label:** Radio
- **variant_lite_ufl_highlight_1_value:** Semtech SX1281
- **variant_lite_ufl_highlight_2_label:** Band
- **variant_lite_ufl_highlight_2_value:** 2.4 GHz
- **variant_lite_ufl_highlight_3_label:** Antenna
- **variant_lite_ufl_highlight_3_value:** U.FL × 1

In the box (added for this tier):

```do-not-edit
qty: 1×
```

- **variant_lite_ufl_box_1_item:** U.FL dipole antenna

### Variant: Mono

- **variant_mono_tagline:** Single LR1121 for multi-band links, with the RF front-end.
- **variant_mono_highlight_1_label:** Radio
- **variant_mono_highlight_1_value:** Semtech LR1121
- **variant_mono_highlight_2_label:** Band
- **variant_mono_highlight_2_value:** Multi-band
- **variant_mono_highlight_3_label:** Front-end
- **variant_mono_highlight_3_value:** RFX2401C + SKY13414
- **variant_mono_highlight_4_label:** Antenna
- **variant_mono_highlight_4_value:** U.FL × 1

In the box (added for this tier):

```do-not-edit
qty: 1×
```

- **variant_mono_box_1_item:** U.FL dipole antenna

### Variant: Gemini

- **variant_gemini_tagline:** Dual LR1121 in ExpressLRS Xrossband mode for frequency-diverse links.
- **variant_gemini_highlight_1_label:** Radio
- **variant_gemini_highlight_1_value:** Semtech LR1121 × 2
- **variant_gemini_highlight_2_label:** Band
- **variant_gemini_highlight_2_value:** Multi-band, diversity
- **variant_gemini_highlight_3_label:** Front-end
- **variant_gemini_highlight_3_value:** RFX2401C + SKY13414
- **variant_gemini_highlight_4_label:** Antenna
- **variant_gemini_highlight_4_value:** U.FL × 2

In the box (added for this tier):

```do-not-edit
qty: 2×
```

- **variant_gemini_box_1_item:** U.FL dipole antenna
- **variant_gemini_box_1_note:** diversity pair
