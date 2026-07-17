# OSHWA Certification - fill-in packet (electronics)

Form: <https://application.oshwa.org/apply> - public, no login to fill. 4 sections.
Certification is **free**, **self-certified**, renewed **annually**.

> **I cannot submit these for you.** The final step accepts the *Certification Mark
> License Agreement* (a legal contract) and submits Incutec's business + your personal
> data. You click submit. Everything below is exact values to paste.

When each is approved OSHWA issues a **UID** with prefix `BE` (Belgium), e.g. `BE000001`.
Send me the three UIDs and I flip them on in the site (wiring already merged - see
`product-content.ts` `oshwaUid`).

---

## Section 1 - Basic information (SAME for all three)

| Field | Value |
|---|---|
| This certification is on behalf of a | **Company** |
| Name of Company Responsible for the Certified Item | **Incutec BV** |
| Individual with Authority to Bind the Company | **Stan Coene** |
| Country | **Belgium** |
| Street Address Line 1 | **Stapelhuisstraat 15** |
| Street Address Line 2 | *(blank)* |
| City/town/village | **Leuven** |
| State/Province/Region | **Vlaams-Brabant** |
| Zip/Postal code | **3000** |
| OSHWA Contact Email (private, OSHWA correspondence) | **contact@opendrone.be** ❓confirm |
| Public contact email (shown on the public cert page) | **contact@opendrone.be** ❓confirm |

---

## Section 2 - Project details (per product)

### 1) OpenFC Lite
| Field | Value |
|---|---|
| Project name | **OpenFC Lite** |
| Project version | **1.0** ❓confirm actual PCB rev |
| Builds on hardware already registered with OSHWA? | **No** |
| Project website | **https://opendrone.be/products/openfc-lite** |
| Primary Project Type | **Electronics** |
| Keywords | FPV, flight controller, Betaflight, RP2350, drone |
| Description | *An RP2354 dual-core M33 flight controller running Betaflight on a 6-layer board: 6-axis IMU, microSD blackbox, PIO-driven analog OSD, switchable 10 V VTX rail. No barometer, no onboard radio - bring your own RX over UART. Two mounts: 20×20 (RP2354A, "Mini") and 30×30 (RP2354B).* |
| Repo(s) | github.com/incutec-hw/OpenFC-Lite · /OpenFC-Lite-Mini |

### 2) OpenESC
| Field | Value |
|---|---|
| Project name | **OpenESC** |
| Project version | **1.0** ❓confirm |
| Builds on registered hardware? | **No** |
| Project website | **https://opendrone.be/products/openesc** ❓confirm handle |
| Primary Project Type | **Electronics** |
| Keywords | FPV, ESC, 4-in-1, BLDC, AM32, DShot |
| Description | *A 4-in-1 brushless ESC running AM32: 6 MOSFETs per motor (2 per phase), gate-driver + MCU per channel, ×4. 11.1–25.2 VDC. Two mounts: 20×20 and 30×30.* |
| Repo(s) | github.com/incutec-hw/OpenESC_20X20 · /OpenESC-30x30 |

### 3) OpenRX
| Field | Value |
|---|---|
| Project name | **OpenRX** |
| Project version | **1.0** ❓confirm |
| Builds on registered hardware? | **No** |
| Project website | **https://opendrone.be/products/openrx** ❓confirm handle |
| Primary Project Type | **Electronics** |
| Keywords | FPV, ExpressLRS, ELRS, receiver, 2.4 GHz, LR1121 |
| Description | *An ExpressLRS receiver, four board designs on one firmware: Lite (SX1281, 2.4 GHz, ceramic antenna), Lite-UFL (U.FL pigtail), Mono (single LR1121, multi-band), Gemini (dual LR1121, Xrossband frequency-diverse).* |
| Repo(s) | github.com/incutec-hw/OpenRX |

---

## Section 3 - Licenses (SAME for all three)

| Field | Value |
|---|---|
| Hardware license | **CERN-OHL-S-2.0** |
| Software license | **GPL-3.0** ❓or "No software" - see note |
| Documentation license | **CERN-OHL-S-2.0** ❓or CC-BY-4.0 |

**Software-license note:** the boards run upstream firmware (Betaflight / AM32 /
ExpressLRS, all GPL-3.0). If the hardware repo ships firmware targets/configs you
authored → **GPL-3.0**. If the repo is hardware-only and ships no software → pick
**"No software"** (like the IT000019 example). Your call, can differ per board.

---

## Section 4 - Compliance attestations (all **Yes** for all three)

| Statement | Answer |
|---|---|
| Licensed to allow modifications/derivatives without commercial restriction | **Yes** |
| No restriction (within your control) on selling/giving away the documentation | **Yes** |
| Used openly-licensed components where possible | **Yes** |
| Understand & comply with the Creator Contribution requirement | **Yes** |
| No restriction on use by persons, groups, or field of endeavor | **Yes** |
| *(final)* Agree to the Certification Mark License Agreement | **you accept** |

**Closed-component note (in case any "explain" box appears):** the only closed parts
are the MCU/radio silicon (RP2354, SX1281/LR1121) - third-party, not under our control,
and their datasheets are public. That satisfies OSHWA's "where possible / accessible
datasheets" rule. Answer **Yes** to the openly-licensed-components question.

---

## Open decisions (what I need from you)

1. **Public contact email** - `contact@opendrone.be`? (it's shown publicly on the cert)
2. **Documentation license** - CERN-OHL-S-2.0 (match hardware) or CC-BY-4.0?
3. **Software license** - GPL-3.0 or "No software", per board?
4. **PCB version string** - the rev to register (default "1.0")?
5. **Granularity** - this packet files **one cert per product line (3 total)**. The
   split variants (FC 20×20/30×30, ESC 20×20/30×30, RX ×4) are genuinely separate PCBs;
   OSHWA registers *unique products*, so you *can* file one per board (~8 UIDs) if you
   want a distinct UID per variant on the site. Recommend starting with 3.
6. **Official mark** - after approval, download the OSHWA "Certified" mark (SVG) from
   your cert dashboard and drop it at `public/oshwa-certified.svg` if you want the logo;
   otherwise the card renders a clean text badge + UID link.

Then: submit the 3 forms → send me the 3 UIDs → I flip them live.
