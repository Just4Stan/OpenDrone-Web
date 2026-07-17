# OSHWA certification - application prep

Goal: get an OSHWA-certified UID for each OpenDrone board so the PDP can link the
official certification page (e.g. `https://certification.oshwa.org/be000xxx.html`)
**instead of / alongside** the raw CERN-OHL-S license link.

Apply per board at <https://certification.oshwa.org/create.html>. Each approved
board gets a UID of the form `BE000NNN` (BE = Belgium) and a public cert page at
`https://certification.oshwa.org/be000nnn.html`.

> The license stays as-is until UIDs exist - we do **not** link a cert page that
> isn't live yet. Once you have the UIDs, give them to me and I'll wire each
> board's provenance/spec link to its cert page.

---

## Shared fields (same for every board)

| Field | Value |
|---|---|
| Country of origin | Belgium |
| Responsible party | [FILL: legal name - you or the entity] |
| Public contact email | [FILL] |
| Responsible-party address | [FILL: required by OSHWA, can be the business address] |
| Primary type | Electronics |
| Hardware license | CERN-OHL-S-2.0 |
| Software/firmware license | [FILL per board - see note below] |
| Documentation license | [FILL: pick one - CC-BY-4.0 or CC-BY-SA-4.0 recommended for docs] |
| Certify the OSHWA mark agreement | Yes |

**Compliance self-check (must all be true to certify):**
- Design files are public in a preferred-editable format (KiCad sources, not just gerbers/PDF). ✅ repos carry `.kicad_sch` / `.kicad_pcb`.
- Anyone may study, modify, make, and sell the hardware. ✅ CERN-OHL-S.
- Documentation is available and openly licensed. [VERIFY: confirm a docs license is stated in each repo - add a LICENSE/README note if missing.]
- Firmware/software, where included, is openly licensed. See per-board note.

> **Firmware note:** OpenDrone hardware runs *partner* firmware (Betaflight, AM32,
> ExpressLRS) under those projects' own licenses (GPL etc.). For the OSHWA software
> field, cite the firmware actually shipped/recommended for that board and its
> upstream license - don't claim it as your own.

---

## Per-board applications

### 1. OpenESC (4-in-1 ESC, 20×20 + 30×30)
- Project name: OpenESC
- Project website: https://opendrone.be/products/openesc
- Documentation / design files: https://github.com/incutec-hw/OpenESC_20X20  (also: https://github.com/incutec-hw/OpenESC-30x30)
- Firmware shipped: AM32 - https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware (GPL - [VERIFY exact AM32 license])
- Version: [FILL: hardware rev]
- → UID once approved: `BE000___`

### 2. OpenFC (flight controller)
- Project name: OpenFC
- Project website: https://opendrone.be/products/openfc
- Documentation / design files: https://github.com/incutec-hw/OpenFC
- Firmware: Betaflight - https://github.com/betaflight/betaflight (GPLv3)
- Version: [FILL]
- → UID once approved: `BE000___`

### 3. OpenFC-Lite (flight controller, 20×20 + 30×30)
- Project name: OpenFC-Lite
- Project website: https://opendrone.be/products/openfc-lite
- Documentation / design files: https://github.com/incutec-hw/OpenFC-Lite  (also: https://github.com/incutec-hw/OpenFC-Lite-Mini)
- Firmware: Betaflight - https://github.com/betaflight/betaflight (GPLv3)
- Version: [FILL]
- → UID once approved: `BE000___`

### 4. OpenRX (receiver)
- Project name: OpenRX
- Project website: https://opendrone.be/products/openrx
- Documentation / design files: https://github.com/incutec-hw/OpenRX
- Firmware: ExpressLRS - [VERIFY upstream + license]
- Version: [FILL]
- → UID once approved: `BE000___`

### 5. OpenFrame (carbon frame)
- Project name: OpenFrame
- Project website: https://opendrone.be/products/openframe
- Documentation / design files: [FILL: dedicated repo URL - product currently points at the org root https://github.com/incutec-hw; create/point to the OpenFrame repo before applying]
- Type: Electronics → **change to the closest non-electronic category** (it's a mechanical part). OSHWA type for a frame is likely "Other"/mechanical. [VERIFY available types]
- Hardware license: CERN-OHL-S-2.0
- Design files: CAD sources (STEP + editable source), not just exports. [VERIFY repo has editable CAD]
- Version: [FILL]
- → UID once approved: `BE000___`

> OpenStack is a *bundle* of OpenFC-Lite + OpenESC, not a separate board - it
> doesn't need its own cert. It inherits the two component UIDs.

---

## After approval - what I'll do

Give me the UIDs and I'll:
1. Add an OSHWA cert link per board (provenance card and/or the spec-table "License" row).
2. Keep the CERN-OHL-S link too - the cert page proves OSHWA compliance; the license is still the legal grant.
3. Optionally add the OSHWA certified-mark badge to the open-source page.
