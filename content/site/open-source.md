# Open source — `/open-source`

> source: app/routes/open-source.tsx

Editorial page explaining why every OpenDrone board is open hardware
(CERN-OHL-S-2.0) and how the business funds itself. Fully static copy —
no Shopify or loader data.

## Meta (browser tab + search/social)

- **title:** Open source · How OpenDrone makes money
- **description:** Why every OpenDrone board is fully open source — and how we pay the bills without closing the hardware.

## Hero

- **eyebrow:** Open source · CERN-OHL-S-2.0
- **title:** We sell hardware. 
- **title_em:** The designs are yours.

### prose: lead

Every OpenDrone board ships with the schematic, PCB, BOM and 3D STEP on GitHub under CERN-OHL-S v2. You can read them, fork them, order your own copies, ship a variant. That's not a marketing promise — it's the license. What you're paying for here is the production run.

## Section 01 — What you buy

- **section_title:** 01 · What you buy

### prose: what_you_buy

A finished, tested, packaged board. Manufactured in the EU where we can, assembled at JLCPCB where we can't, inspected, flashed, and shipped from Belgium. The price covers the PCBs, the components, the assembly, the QC time, the packaging, the courier, the VAT, support, and — increasingly — the next revision's engineering time.

## Section 02 — What stays open

- **section_title:** 02 · What stays open
- **open_item_schematics_label:** Schematics
- **open_item_schematics_body:**  — KiCad 9 project files, not just PDF exports. Every net and value is rebuildable from source.
- **open_item_pcb_label:** PCB layout
- **open_item_pcb_body:**  — the same Gerbers and CPL files we ship to the fab. Not a “reference” — the actual production artefacts.
- **open_item_bom_label:** BOM
- **open_item_bom_body:**  — distributor part numbers (LCSC, Mouser, Digi-Key where relevant), not just generic MPNs.
- **open_item_step_label:** 3D STEP
- **open_item_step_body:**  — so you can check clearance against your frame before you buy.
- **open_item_fab_label:** Fab notes
- **open_item_fab_body:**  — stackup, impedance targets, assembly quirks, any hack that made rev-N work.

## Section 03 — Why CERN-OHL-S and not MIT

- **section_title:** 03 · Why CERN-OHL-S and not MIT

### prose: why_cern_p1

CERN-OHL-S-2.0 is a reciprocal (“copyleft”) open hardware licence. It keeps the design open: if you modify an OpenDrone board, ship your own version, and someone asks for your sources, you hand them over on the same terms. The goal isn't to stop clones — we can't, and wouldn't want to. The goal is to make sure every clone carries its sources forward to the next maker.

### prose: why_cern_p2

Firmware is usually GPL or MIT depending on the upstream project we build on (Betaflight, AM32, ExpressLRS). We don't relicense any of them.

## Section 04 — How the business stays solvent

- **section_title:** 04 · How the business stays solvent

### prose: solvent_p1

Four sources in rough order of size: retail margin on the boards we make, volume orders from schools and teams, paid consulting on custom variants, and the firmware split — €1 per unit forwarded to the upstream firmware project the board runs. That last line exists because we build on decades of other people's open source; paying a little of it back is the cheap, honest thing to do.

### prose: solvent_p2

We do *not* make money from: ads, affiliate trackers, reselling analytics data, bundled apps, or SKU-locking features behind firmware keys. The site runs cookieless (Plausible) and the product works without the web store existing.

## Section 05 — What this means for you

- **section_title:** 05 · What this means for you
- **means_item_1:** If OpenDrone vanishes tomorrow, you still have the files. Someone else — including you — can order a rev and keep it alive.
- **means_item_2:** If you want a 4" version, a 3S-only version, a heavier-copper variant: fork, change, fab. If it's good, open a PR upstream.
- **means_item_3:** If you're a teacher or a club, we'd rather you copy the design than buy a cheap closed alternative.

## Page footer CTAs

- **cta_primary:** See who the €1 goes to →
- **cta_secondary:** Browse the repos on GitHub ↗

```do-not-edit
CTA targets → /firmware-partners, https://github.com/incutec-hw
(GitHub link opens in new tab)
```
