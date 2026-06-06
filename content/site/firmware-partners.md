# Firmware partners — `/firmware-partners`

> source: app/routes/firmware-partners.tsx

Editorial page explaining the €1-per-order firmware contribution and
listing the upstream projects OpenDrone forwards funds to. Fully static
copy — no Shopify or loader data. (The PDP `FirmwareSplit` component is
NOT used on this route; its copy lives with the product page, not here.)

## Meta (browser tab + search/social)

- **title:** Firmware partners · Where your €1 goes
- **description:** OpenDrone ships on Betaflight, AM32 and ExpressLRS. We forward €1 of every order to the upstream maintainers — here is the list.

## Hero

- **eyebrow:** €1 per order · forwarded
- **title:** The firmware makes the hardware fly. 
- **title_em:** We pay the people who wrote it.

### prose: lead

Every OpenDrone board runs on firmware we didn't write. For every unit sold we forward €1 to the upstream project — one contribution, one transaction, one line item in our books. Here's the list, with links so you can double-dip if you want.

## Section 01 — How the split works

- **section_title:** 01 · How the split works

### prose: split_p1

When you buy a board, the checkout total covers the hardware price plus a €1 firmware contribution baked in. We batch those contributions and forward them to the upstream project — GitHub Sponsors, OpenCollective, or a direct bank transfer depending on what the maintainers have set up. We publish the totals on each release so you can see what went where.

### prose: split_p2

On the OpenStack bundle (OpenFC + OpenESC) the split doubles: €1 to Betaflight, €1 to AM32. The bundle price is still lower than the two boards bought separately — the maintainers don't lose their cut.

## Section 02 — The projects

- **section_title:** 02 · The projects
- **card_label_prefix:** Runs on · 
- **card_link_source:** Source ↗
- **card_link_donate:** Donate directly ↗

### Partner — Betaflight

- **runs_on:** OpenFC
- **project:** Betaflight

### prose: partner_betaflight

Betaflight is the flight controller firmware used in most mini-quad freestyle builds. OpenFC is a Betaflight-target board — the RP2354B port is being upstreamed.

### Partner — AM32

- **runs_on:** OpenESC
- **project:** AM32

### prose: partner_am32

AM32 is a multi-MCU ESC firmware alternative to BLHeli, MIT-licensed. OpenESC runs AM32 on AT32F421 channels — same firmware as other AM32 ESCs, no custom fork, no vendor lock-in.

### Partner — ExpressLRS

- **runs_on:** OpenRX · OpenFC break-off RX
- **project:** ExpressLRS

### prose: partner_expresslrs

ExpressLRS is the open long-range 2.4 GHz / sub-GHz radio protocol. OpenRX targets are upstream (Unified_ESP32C3_2400_RX for Lite, Unified_ESP32C3_LR1121_RX for Mono/Gemini) so you flash with the standard ExpressLRS configurator.

```do-not-edit
Partner links (open in new tab):
- Betaflight   source → https://github.com/betaflight/betaflight
               donate → https://opencollective.com/betaflight
- AM32         source → https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware
               (no donate link)
- ExpressLRS   source → https://github.com/ExpressLRS/ExpressLRS
               donate → https://opencollective.com/expresslrs
```

## Section 03 — Want to double the €1?

- **section_title:** 03 · Want to double the €1?

### prose: double_p1

At checkout you'll see an optional donation step — pick €1, €3, €5, €10 or skip. 100% of that line is forwarded on top of the baked-in €1. We don't keep a cut.

### prose: double_p2

If you'd rather give directly, every project above links to their own donation page. We'd honestly prefer that to a 1% processor fee skimming our route — but the checkout option is there if it's more convenient.

## Page footer CTAs

- **cta_primary:** Read why we open-source everything →
- **cta_secondary:** Browse the boards →

```do-not-edit
CTA targets → /open-source, /collections/all
```
