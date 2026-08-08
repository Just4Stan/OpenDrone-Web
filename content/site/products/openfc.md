# OpenFC editorial — `/products/openfc`

> source: app/lib/product-content.ts (openfc entry)

Per-product editorial copy for the OpenFC flight controller PDP. Keys are
stable IDs — edit only the text after each colon, and edit prose blocks
freely under their `### prose:` anchors. Anything inside a `do-not-edit`
fence is structural data (file numbers, URLs, part refs) — leave it.

```do-not-edit
handle: openfc
fileNumber: 02
firmware.project: Betaflight
firmware.projectUrl: https://github.com/betaflight/betaflight
firmware.logo: /logos/betaflight.svg
repoUrl: https://github.com/OpenDrone-hw/OpenFC
teardown.boardArt: (none)
optionAxis: Model
```

## Hero

- **family:** Flight Controller
- **hero_line1:** A flight controller
- **hero_line2_italic:** is mostly
- **hero_line3:** an IMU and a radio.

### prose: hero_lead

RP2354B dual-core M33 running Betaflight, a TDK-Invensense LSM6DSV16X IMU, barometer, blackbox flash, and a break-off 2.4 GHz ExpressLRS receiver on the same PCB. Snap the RX off when you want to mount it elsewhere.

## Teardown

- **teardown_title:** An MCU, an IMU, a radio, and enough UARTs for the rest.

### prose: teardown_body

The RP2354B carries 520 KB of SRAM, integrated flash, and two PIO blocks. One PIO drives the analog OSD (opamp + mux detect the video syncs and switch between white and black pixels); the other provides two extra software UARTs. The ELRS module is a physical break-off on the same board — snap it off or fly with it attached.

### Teardown pins (label text)

The `①②③④⑤` ref glyphs are structural; edit only the part text after each.

- **pin_1:** RP2354B — dual M33 @ 150 MHz
- **pin_2:** LSM6DSV16XTR IMU
- **pin_3:** BMP388 barometer
- **pin_4:** BY25Q128AS — 128 Mbit blackbox
- **pin_5:** Break-off ESP32-C3 ELRS RX

## In the box

Each line is `qty` + `item` + optional `note`. Edit the item and note text;
the `qty` codes are in the do-not-edit fence.

```do-not-edit
qty (in order): 1×, 1×, 1×, 4×, 1×
```

- **box_1_item:** OpenFC board
- **box_1_note:** break-off 2.4 GHz ELRS RX attached; snap off if you want to relocate it
- **box_2_item:** 8-pin Betaflight signal cable
- **box_2_note:** JST SM08B-SRSS-TB, pre-crimped, FC → ESC
- **box_3_item:** DJI/HD camera pigtail
- **box_3_note:** JST-SH1.0 6-pin ↔ GHR 10-pin
- **box_4_item:** M3 rubber soft-mount grommets
- **box_5_item:** Build card
- **box_5_note:** batch ID, QC initials, firmware flash command, GitHub rev

## Downloads

Edit the `label` and `note` text. `kind` and `href` shown for context.

```do-not-edit
download_1: kind=schematic href=https://github.com/OpenDrone-hw/OpenFC/raw/main/hardware/schematic.pdf
download_2: kind=step      href=https://github.com/OpenDrone-hw/OpenFC/raw/main/hardware/board.step
download_3: kind=bom       href=https://github.com/OpenDrone-hw/OpenFC/raw/main/hardware/bom.csv
download_4: kind=gerber    href=https://github.com/OpenDrone-hw/OpenFC/raw/main/hardware/gerbers.zip
download_5: kind=manual    href=https://github.com/OpenDrone-hw/OpenFC/raw/main/docs/manual.pdf
download_6: kind=wiring    href=https://github.com/OpenDrone-hw/OpenFC/raw/main/docs/wiring.pdf
download_7: kind=flash     href=https://github.com/OpenDrone-hw/OpenFC/blob/main/docs/flashing.md
```

- **download_1_label:** Schematic (PDF)
- **download_1_note:** MCU, IMU, baro, blackbox, break-off RX sub-sheet
- **download_2_label:** 3D STEP
- **download_2_note:** Board with RX attached (before snap-off)
- **download_3_label:** BOM (CSV)
- **download_4_label:** Gerbers (ZIP)
- **download_5_label:** User manual (PDF)
- **download_6_label:** Wiring diagram (PDF)
- **download_6_note:** ESC, VTX, camera, RX, motor LEDs
- **download_7_label:** Betaflight target + flash guide

## Specs

`[label, value]` pairs. Both label and value are editable copy.

- **spec_firmware:** Betaflight
- **spec_mcu:** RP2354B (dual M33 @ 150 MHz)
- **spec_imu:** LSM6DSV16XTR
- **spec_barometer:** BMP388
- **spec_blackbox:** BY25Q128AS (16 MB)
- **spec_motor_outputs:** 4× PWM / DShot
- **spec_rx:** Break-off 2.4 GHz ExpressLRS
- **spec_osd:** Analog, PIO-driven (software WIP)
- **spec_uarts:** 2 hardware + 2 PIO
- **spec_usb:** USB-C (config + flash)
- **spec_power:** 2–6S, 12 V switchable + 5 V
- **spec_extras:** 16 corner LEDs, buzzer, LED strip out
- **spec_license:** CERN-OHL-S-2.0

The spec labels (left column) are:

- **spec_label_1:** Firmware
- **spec_label_2:** MCU
- **spec_label_3:** IMU
- **spec_label_4:** Barometer
- **spec_label_5:** Blackbox
- **spec_label_6:** Motor outputs
- **spec_label_7:** RX
- **spec_label_8:** OSD
- **spec_label_9:** UARTs
- **spec_label_10:** USB
- **spec_label_11:** Power
- **spec_label_12:** Extras
- **spec_label_13:** License

## Footnote

### prose: footnote

The ELRS receiver break-off lets you relocate the RX without cutting traces. Solder onto the pads when reattaching.

## Variants (comparison ladder)

Keyed by the Shopify option value. Edit `tagline` and the highlight
label/value text. `comingSoon` and `boardArt` are structural.

```do-not-edit
optionAxis: Model
variant keys: Lite, 20×20, 30×30
Lite.boardArt: /boards/openfc-lite/board.svg
20×20.comingSoon: true   30×30.comingSoon: true
```

### Variant: 20×20

- **variant_20x20_tagline:** OpenFC Lite on the 20×20 / 30.5 mount — the compact stack size.
- **variant_20x20_highlight_1_label:** Mount
- **variant_20x20_highlight_1_value:** 20×20 · 30.5 holes
- **variant_20x20_highlight_2_label:** Model
- **variant_20x20_highlight_2_value:** Lite

### Variant: 30×30

- **variant_30x30_tagline:** OpenFC Lite on the 30×30 mount.
- **variant_30x30_highlight_1_label:** Mount
- **variant_30x30_highlight_1_value:** 30×30
- **variant_30x30_highlight_2_label:** Model
- **variant_30x30_highlight_2_value:** Lite

## Pair CTA (cross-sell)

```do-not-edit
pairCta.to: /products/openstack
```

- **pair_eyebrow:** Better together
- **pair_title:** OpenStack — OpenFC + OpenESC, one 30.5 mm stack, one checkout.
