/**
 * Editorial content per Shopify product handle. Sourced from the real
 * product repos in iCloud (4in1ESC, 4in1ESC-30x30, OpenFC, OpenRX) —
 * NOT from the Shopify description field (which is currently a
 * placeholder). When a SKU gets real variants/metafields in Shopify
 * those take priority; this file fills the gaps the CMS doesn't cover.
 *
 * When you add a new product: add an entry keyed by the Shopify handle.
 * Missing entry = product renders with a minimal fallback layout.
 */

export type ChapterPin = {ref: string; part: string; cost?: string};

/**
 * Physical item that ships in the box. `qty` is free text so entries
 * can read "1×" or "kit" or "set". Keep items factual — only list
 * things that genuinely ship. No speculative filler.
 */
export type BoxItem = {qty?: string; item: string; note?: string};

/**
 * Downloadable asset rendered in the Downloads chapter. `kind` picks
 * the icon/label family; `href` can point anywhere — usually a file
 * in the product's GitHub repo (raw or releases), occasionally a
 * standalone CDN URL for heavy CAD.
 */
export type DownloadKind =
  | 'schematic'
  | 'step'
  | 'bom'
  | 'gerber'
  | 'manual'
  | 'wiring'
  | 'flash'
  | 'changelog'
  | 'sbom'
  | 'other';

export type DownloadAsset = {
  kind: DownloadKind;
  label: string;
  href: string;
  note?: string;
  size?: string;
};

/**
 * Playful cross-sell card rendered under the buy strip. Use it to point
 * one product at another — e.g. OpenFC ↔ OpenESC both pointing at
 * OpenStack. Keep line copy short: it's a wink, not a paragraph.
 */
export type PairCta = {
  eyebrow: string;     // small uppercase line above (e.g. "PAIR WITH")
  title: string;       // main line (e.g. "OpenStack — FC + ESC, one solder-free stack")
  to: string;          // href to the paired product PDP
};

/**
 * A component of a bundle product (OpenStack et al). Each entry points
 * at an existing PDP and names the firmware that the component carries,
 * so the bundle PDP can render a "what's in the box" chapter without
 * duplicating editorial copy.
 */
export type BundleComponent = {
  title: string;
  handle: string;              // /products/<handle>
  firmware: string;            // "Betaflight", "AM32", etc.
  firmwareUrl?: string;
  blurb: string;               // one-liner used in the bundle card
};

export type ProductContent = {
  fileNumber: string;           // "01" etc — shown in the eyebrow
  family: string;               // Category shown next to file number
  hero: {
    line1: string;
    line2Italic: string;        // middle line rendered in gold italic
    line3: string;
    lead: string;               // subhead paragraph in mono
  };
  firmware: {
    project: string;            // "AM32" / "Betaflight" / "ExpressLRS" / null
    projectUrl?: string;
  };
  repoUrl: string;
  teardown?: {
    title: string;
    body: string;
    pins: ChapterPin[];
  };
  inTheBox: BoxItem[];          // physical items shipped
  downloads: DownloadAsset[];   // schematic PDFs, STEP files, manuals, etc.
  specs: Array<[string, string]>;
  footnote?: string;            // appears under the family card
  pairCta?: PairCta;            // playful cross-sell under the buy strip
  bundle?: {                    // when set, the PDP renders as a bundle
    components: BundleComponent[];
  };
};

export const PRODUCT_CONTENT: Record<string, ProductContent> = {
  openesc: {
    fileNumber: '01',
    family: '4-in-1 ESC',
    hero: {
      line1: 'An ESC',
      line2Italic: 'is not',
      line3: 'a miracle.',
      lead:
        'Four half-bridges, a gate driver, a microcontroller running AM32, and a current-sense shunt. That is the list. Open schematic, open layout, open BOM — €1 of every order forwarded to the AM32 maintainers, tracked publicly.',
    },
    firmware: {
      project: 'AM32',
      projectUrl:
        'https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware',
    },
    repoUrl: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC',
    teardown: {
      title: 'Four chips. One sheet, used four times.',
      body:
        'The schematic is split into a main sheet (power, current sensing, 8-pin connector) and one sub-sheet reused for each of the four channels. Each channel carries the AT32F421 running AM32, the NSG2065Q 3-phase gate driver, and six SP40N03GNJ MOSFETs wired as three half-bridges. Back-EMF feedback handles sensorless commutation.',
      pins: [
        {ref: '①', part: 'AT32F421G8U7 — 120 MHz M4 MCU', cost: '×4'},
        {ref: '②', part: 'NSG2065Q gate driver (FD6288Q-compatible)', cost: '×4'},
        {ref: '③', part: 'SP40N03GNJ MOSFET, 40 V / 2.9 mΩ', cost: '×24'},
        {ref: '④', part: 'INA186A3 + 0.2 mΩ shunt', cost: '×4'},
      ],
    },
    inTheBox: [
      {qty: '1×', item: 'OpenESC 4-in-1 board', note: '20×20 carrier, 30.5×30.5 mount pattern'},
      {qty: '2×', item: '8-pin Betaflight signal cable', note: 'JST SM08B-SRSS-TB, pre-crimped, 8 cm'},
      {qty: '1×', item: 'XT60 battery pigtail with 470 µF low-ESR cap'},
      {qty: '4×', item: 'M3 rubber soft-mount grommets'},
      {qty: '1×', item: 'Build card', note: 'batch ID, QC initials, firmware flash command, GitHub rev'},
    ],
    downloads: [
      {
        kind: 'schematic',
        label: 'Schematic (PDF)',
        href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC/raw/main/hardware/schematic.pdf',
        note: 'Current rev — main sheet + 4× per-channel sub-sheet',
      },
      {
        kind: 'step',
        label: '3D STEP',
        href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC/raw/main/hardware/board.step',
        note: 'Full board assembly including connectors',
      },
      {
        kind: 'bom',
        label: 'BOM (CSV)',
        href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC/raw/main/hardware/bom.csv',
        note: 'Manufacturer part numbers, LCSC refs, per-unit price',
      },
      {
        kind: 'gerber',
        label: 'Gerbers (ZIP)',
        href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC/raw/main/hardware/gerbers.zip',
        note: 'Fabrication package — JLCPCB-ready',
      },
      {
        kind: 'manual',
        label: 'User manual (PDF)',
        href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC/raw/main/docs/manual.pdf',
        note: 'Installation, wiring, first-flash',
      },
      {
        kind: 'wiring',
        label: 'Wiring diagram (PDF)',
        href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC/raw/main/docs/wiring.pdf',
        note: 'FC pinout, battery, telemetry',
      },
      {
        kind: 'flash',
        label: 'Flashing guide',
        href: 'https://github.com/Just4Stan/Open-4in1-AM32-ESC/blob/main/docs/flashing.md',
        note: 'AM32 via ESC-Configurator + passthrough',
      },
    ],
    specs: [
      ['Firmware', 'AM32'],
      ['Protocol', 'DShot (Betaflight)'],
      ['Input', '3–6S LiPo (11.1–25.2 V)'],
      ['Continuous', '35 A / channel'],
      ['MCU', 'AT32F421G8U7, 120 MHz'],
      ['Gate driver', 'NSG2065Q (QFN-24)'],
      ['MOSFETs', 'SP40N03GNJ, 40 V / 2.9 mΩ'],
      ['Current sense', 'INA186A3 + 0.2 mΩ shunt'],
      ['Power rails', 'LMR51420 buck + TLV76733 LDO'],
      ['Connector', 'JST SM08B-SRSS-TB (8-pin BF)'],
      ['PCB', '6-layer, 20×20 mount'],
      ['License', 'CERN-OHL-S-2.0'],
    ],
    footnote:
      'A 30×30 mount variant with higher-current SP40N01GHNK MOSFETs is a separate product (OpenESC 30×30, coming soon).',
    pairCta: {
      eyebrow: 'Better together',
      title: 'OpenStack — board on board, zero solder, one checkout.',
      to: '/products/openstack',
    },
  },

  openfc: {
    fileNumber: '02',
    family: 'Flight Controller',
    hero: {
      line1: 'A flight controller',
      line2Italic: 'is mostly',
      line3: 'an IMU and a radio.',
      lead:
        'RP2354B dual-core M33 running Betaflight, a TDK-Invensense LSM6DSV16X IMU, barometer, blackbox flash, and a break-off 2.4 GHz ExpressLRS receiver on the same PCB. Snap the RX off when you want to mount it elsewhere.',
    },
    firmware: {
      project: 'Betaflight',
      projectUrl: 'https://github.com/betaflight/betaflight',
    },
    repoUrl: 'https://github.com/Just4Stan/OpenFC',
    teardown: {
      title: 'An MCU, an IMU, a radio, and enough UARTs for the rest.',
      body:
        'The RP2354B carries 520 KB of SRAM, integrated flash, and two PIO blocks. One PIO drives the analog OSD (opamp + mux detect the video syncs and switch between white and black pixels); the other provides two extra software UARTs. The ELRS module is a physical break-off on the same board — snap it off or fly with it attached.',
      pins: [
        {ref: '①', part: 'RP2354B — dual M33 @ 150 MHz'},
        {ref: '②', part: 'LSM6DSV16XTR IMU'},
        {ref: '③', part: 'BMP388 barometer'},
        {ref: '④', part: 'BY25Q128AS — 128 Mbit blackbox'},
        {ref: '⑤', part: 'Break-off ESP32-C3 ELRS RX'},
      ],
    },
    inTheBox: [
      {qty: '1×', item: 'OpenFC board', note: 'break-off 2.4 GHz ELRS RX attached; snap off if you want to relocate it'},
      {qty: '1×', item: '8-pin Betaflight signal cable', note: 'JST SM08B-SRSS-TB, pre-crimped, FC → ESC'},
      {qty: '1×', item: 'DJI/HD camera pigtail', note: 'JST-SH1.0 6-pin ↔ GHR 10-pin'},
      {qty: '4×', item: 'M3 rubber soft-mount grommets'},
      {qty: '1×', item: 'Build card', note: 'batch ID, QC initials, firmware flash command, GitHub rev'},
    ],
    downloads: [
      {
        kind: 'schematic',
        label: 'Schematic (PDF)',
        href: 'https://github.com/Just4Stan/OpenFC/raw/main/hardware/schematic.pdf',
        note: 'MCU, IMU, baro, blackbox, break-off RX sub-sheet',
      },
      {
        kind: 'step',
        label: '3D STEP',
        href: 'https://github.com/Just4Stan/OpenFC/raw/main/hardware/board.step',
        note: 'Board with RX attached (before snap-off)',
      },
      {
        kind: 'bom',
        label: 'BOM (CSV)',
        href: 'https://github.com/Just4Stan/OpenFC/raw/main/hardware/bom.csv',
      },
      {
        kind: 'gerber',
        label: 'Gerbers (ZIP)',
        href: 'https://github.com/Just4Stan/OpenFC/raw/main/hardware/gerbers.zip',
      },
      {
        kind: 'manual',
        label: 'User manual (PDF)',
        href: 'https://github.com/Just4Stan/OpenFC/raw/main/docs/manual.pdf',
      },
      {
        kind: 'wiring',
        label: 'Wiring diagram (PDF)',
        href: 'https://github.com/Just4Stan/OpenFC/raw/main/docs/wiring.pdf',
        note: 'ESC, VTX, camera, RX, motor LEDs',
      },
      {
        kind: 'flash',
        label: 'Betaflight target + flash guide',
        href: 'https://github.com/Just4Stan/OpenFC/blob/main/docs/flashing.md',
      },
    ],
    specs: [
      ['Firmware', 'Betaflight'],
      ['MCU', 'RP2354B (dual M33 @ 150 MHz)'],
      ['IMU', 'LSM6DSV16XTR'],
      ['Barometer', 'BMP388'],
      ['Blackbox', 'BY25Q128AS (16 MB)'],
      ['Motor outputs', '4× PWM / DShot'],
      ['RX', 'Break-off 2.4 GHz ExpressLRS'],
      ['OSD', 'Analog, PIO-driven (software WIP)'],
      ['UARTs', '2 hardware + 2 PIO'],
      ['USB', 'USB-C (config + flash)'],
      ['Power', '2–6S, 12 V switchable + 5 V'],
      ['Extras', '16 corner LEDs, buzzer, LED strip out'],
      ['License', 'CERN-OHL-S-2.0'],
    ],
    footnote:
      'The ELRS receiver break-off lets you relocate the RX without cutting traces. Solder onto the pads when reattaching.',
    pairCta: {
      eyebrow: 'Better together',
      title: 'OpenStack — OpenFC + OpenESC, one 30.5 mm stack, one checkout.',
      to: '/products/openstack',
    },
  },

  openrx: {
    fileNumber: '03',
    family: 'ELRS Receiver',
    hero: {
      line1: 'An ExpressLRS receiver,',
      line2Italic: 'open',
      line3: 'from antenna to firmware.',
      lead:
        'Four board designs, one firmware. Lite runs SX1281 on 2.4 GHz with a ceramic antenna. Lite-UFL swaps to a U.FL pigtail. Mono steps up to a single LR1121 for multi-band. Gemini runs dual LR1121 in ExpressLRS Xrossband mode for frequency-diverse links.',
    },
    firmware: {
      project: 'ExpressLRS',
      projectUrl: 'https://github.com/ExpressLRS/ExpressLRS',
    },
    repoUrl: 'https://github.com/Just4Stan/OpenRX',
    teardown: {
      title: 'One ESP32-C3, one (or two) radios, careful RF.',
      body:
        'Every variant runs on the ESP32-C3 at the MCU layer. Lite uses Semtech SX1281 with the 2450FM07D0034 BPF; Mono and Gemini use Semtech LR1121 with the RFX2401C + SKY13414 + Johanson IPD front-end. Firmware targets upstream to ExpressLRS (Unified_ESP32C3_2400_RX for Lite, Unified_ESP32C3_LR1121_RX for Mono/Gemini).',
      pins: [
        {ref: '①', part: 'ESP32-C3 — Wi-Fi OTA + CRSF'},
        {ref: '②', part: 'SX1281 (Lite) or LR1121 (Mono/Gemini)'},
        {ref: '③', part: 'RFX2401C + SKY13414 front-end (Mono/Gemini)'},
        {ref: '④', part: 'U.FL or ceramic antenna'},
      ],
    },
    inTheBox: [
      {qty: '1×', item: 'OpenRX board', note: 'variant selected at checkout (Lite, Lite-UFL, Mono, Gemini)'},
      {qty: '1×', item: 'CRSF servo cable', note: '3-pin JST-SH1.0, pre-crimped, 10 cm'},
      {qty: '1–2×', item: 'U.FL dipole antenna', note: 'Lite-UFL/Mono: 1×; Gemini: 2× diversity. Lite ships without (ceramic antenna on-board).'},
      {qty: '1×', item: 'Heat-shrink sleeve + double-sided tape'},
      {qty: '1×', item: 'Build card', note: 'batch ID, QC initials, ExpressLRS flash target, GitHub rev'},
    ],
    downloads: [
      {
        kind: 'schematic',
        label: 'Schematic (PDF)',
        href: 'https://github.com/Just4Stan/OpenRX/raw/main/hardware/schematic.pdf',
        note: 'All four variants — Lite / Lite-UFL / Mono / Gemini',
      },
      {
        kind: 'step',
        label: '3D STEP — all variants',
        href: 'https://github.com/Just4Stan/OpenRX/raw/main/hardware/boards.step',
      },
      {
        kind: 'bom',
        label: 'BOM (CSV)',
        href: 'https://github.com/Just4Stan/OpenRX/raw/main/hardware/bom.csv',
        note: 'Per-variant — front-end parts only on Mono/Gemini',
      },
      {
        kind: 'gerber',
        label: 'Gerbers (ZIP)',
        href: 'https://github.com/Just4Stan/OpenRX/raw/main/hardware/gerbers.zip',
      },
      {
        kind: 'manual',
        label: 'User manual (PDF)',
        href: 'https://github.com/Just4Stan/OpenRX/raw/main/docs/manual.pdf',
      },
      {
        kind: 'flash',
        label: 'ExpressLRS flash targets',
        href: 'https://github.com/Just4Stan/OpenRX/blob/main/docs/flashing.md',
        note: 'Unified_ESP32C3_2400_RX (Lite), Unified_ESP32C3_LR1121_RX (Mono/Gemini)',
      },
    ],
    specs: [
      ['Firmware', 'ExpressLRS'],
      ['Telemetry', 'CRSF'],
      ['Variants', 'Lite, Lite-UFL, Mono, Gemini'],
      ['Bands', '2.4 GHz (Lite), multi-band (Mono/Gemini)'],
      ['Radio — Lite', 'Semtech SX1281'],
      ['Radio — Mono/Gemini', 'Semtech LR1121'],
      ['MCU', 'ESP32-C3'],
      ['Front-end', 'RFX2401C + SKY13414 (Mono/Gemini)'],
      ['Antenna — Lite', 'Ceramic'],
      ['Antenna — Lite-UFL', 'U.FL × 1'],
      ['Antenna — Mono', 'U.FL × 1'],
      ['Antenna — Gemini', 'U.FL × 2 (diversity)'],
      ['Flashing', 'UART first, then Wi-Fi OTA / BF passthrough'],
      ['License', 'CERN-OHL-S-2.0'],
    ],
    footnote:
      'Variants will land as Shopify options once the test batch of Mono and Gemini returns. Lite and Lite-UFL ship first.',
  },

  openframe: {
    fileNumber: '04',
    family: 'Carbon Frame',
    hero: {
      line1: 'The body',
      line2Italic: 'the rest',
      line3: 'bolts into.',
      lead:
        'CNC carbon-fibre 5" freestyle frame with a 30.5×30.5 stack pattern. OEM-built from a Chinese partner to start; the design files open up once the partnership matures. OpenFC and OpenESC drop in without spacers.',
    },
    firmware: {
      project: '—',
    },
    repoUrl: 'https://github.com/Just4Stan',
    inTheBox: [
      {qty: '1×', item: 'Top plate + bottom plate', note: 'CNC carbon fibre, 5 mm'},
      {qty: '4×', item: '5" arms', note: 'CNC carbon fibre, 5 mm'},
      {qty: '1×', item: 'Hardware kit', note: 'M3 bolts + aluminium standoffs + locknuts for a full build'},
      {qty: '1×', item: 'Camera mount', note: '19 mm micro, TPU-printed'},
      {qty: '1×', item: 'VTX antenna tube clamp'},
      {qty: '1×', item: 'Build card', note: 'batch ID, torque spec, GitHub rev (once design files open)'},
    ],
    downloads: [
      {
        kind: 'manual',
        label: 'Assembly guide (PDF)',
        href: 'https://github.com/Just4Stan/OpenFrame/raw/main/docs/assembly.pdf',
        note: 'Build order, torque spec, camera tilt jig',
      },
      {
        kind: 'step',
        label: '3D STEP',
        href: 'https://github.com/Just4Stan/OpenFrame/raw/main/hardware/frame.step',
        note: 'Plates + arms + hardware — for stack planning',
      },
      {
        kind: 'other',
        label: 'DXF cutting files',
        href: 'https://github.com/Just4Stan/OpenFrame/raw/main/hardware/dxf.zip',
        note: 'Released once the OEM partnership matures',
      },
    ],
    specs: [
      ['Class', '5-inch freestyle'],
      ['Mount', '30.5 × 30.5'],
      ['Arm thickness', '5 mm carbon'],
      ['Camera', '19 mm micro'],
      ['VTX bay', '20 × 20'],
      ['Status', 'OEM partnership, design files pending'],
    ],
    footnote:
      'The frame is the one piece of the stack we do not yet source in the EU. Partner selection and design hand-off are underway.',
  },

  openstack: {
    fileNumber: '05',
    family: 'FC + ESC Bundle',
    hero: {
      line1: 'The stack,',
      line2Italic: 'pre-stacked.',
      line3: 'Two boards, one checkout.',
      lead:
        'OpenFC and OpenESC built on the same 30.5 × 30.5 pattern. Buy them together, skip the courier round-trip, and bring-up is soldering headers, flashing once, and bolting it into OpenFrame. Two open firmwares, two maintainers paid — from one order.',
    },
    // Firmware set to empty so the single-project €N+€1 chapter is
    // suppressed. The bundle chapter replaces it with a per-component
    // breakdown and shows the double contribution explicitly.
    firmware: {
      project: '',
    },
    repoUrl: 'https://github.com/Just4Stan',
    inTheBox: [
      {qty: '1×', item: 'OpenFC board', note: 'break-off 2.4 GHz ELRS RX attached'},
      {qty: '1×', item: 'OpenESC 4-in-1 board'},
      {qty: '1×', item: '8-pin Betaflight signal cable', note: 'JST SM08B-SRSS-TB, pre-crimped both ends — FC ↔ ESC, length matched for a 30.5 × 30.5 stack'},
      {qty: '1×', item: 'DJI/HD camera pigtail', note: 'JST-SH1.0 6-pin ↔ GHR 10-pin'},
      {qty: '1×', item: 'XT60 battery pigtail with 470 µF low-ESR cap'},
      {qty: '4×', item: 'M3 rubber soft-mount grommets'},
      {qty: '1×', item: 'Build card', note: 'batch IDs for both boards, QC initials, firmware flash commands (Betaflight + AM32), GitHub revs'},
    ],
    downloads: [
      {
        kind: 'schematic',
        label: 'Schematics — FC + ESC',
        href: 'https://github.com/Just4Stan/OpenFC/raw/main/hardware/schematic.pdf',
        note: 'Combined link — individual boards have their own repo',
      },
      {
        kind: 'step',
        label: '3D STEP — stacked assembly',
        href: 'https://github.com/Just4Stan/OpenStack/raw/main/hardware/stack.step',
        note: 'Both boards, 30.5 × 30.5 soft-mounted',
      },
      {
        kind: 'manual',
        label: 'Stack guide (PDF)',
        href: 'https://github.com/Just4Stan/OpenStack/raw/main/docs/guide.pdf',
        note: 'Wire harness routing, first-flash order, UART assignments',
      },
      {
        kind: 'flash',
        label: 'Flash commands — Betaflight + AM32',
        href: 'https://github.com/Just4Stan/OpenStack/blob/main/docs/flashing.md',
      },
    ],
    specs: [
      ['Includes', 'OpenFC + OpenESC'],
      ['Mount', '30.5 × 30.5'],
      ['FC firmware', 'Betaflight (RP2354B)'],
      ['ESC firmware', 'AM32 (AT32F421 × 4)'],
      ['Continuous', '35 A / channel'],
      ['Input', '3–6S LiPo'],
      ['Contribution', '€1 → Betaflight, €1 → AM32'],
      ['License', 'CERN-OHL-S-2.0'],
    ],
    footnote:
      'Bundle price is OpenFC + OpenESC minus the courier/handling saved by shipping together. Firmware splits stay intact — Betaflight and AM32 each get their €1.',
    bundle: {
      components: [
        {
          title: 'OpenFC',
          handle: 'openfc',
          firmware: 'Betaflight',
          firmwareUrl: 'https://github.com/betaflight/betaflight',
          blurb:
            'RP2354B dual-core M33 with LSM6DSV16X IMU, BMP388 barometer, 16 MB blackbox and a break-off ExpressLRS RX on the same PCB.',
        },
        {
          title: 'OpenESC',
          handle: 'openesc',
          firmware: 'AM32',
          firmwareUrl:
            'https://github.com/AlkaMotors/AM32-MultiRotor-ESC-firmware',
          blurb:
            'Four AT32F421 channels, NSG2065Q gate drivers, 35 A continuous, INA186A3 + 0.2 mΩ current sensing. 20 × 20 carrier, 30.5 × 30.5 mount holes to match OpenFC.',
        },
      ],
    },
  },
};

/** Fallback when a handle has no editorial content yet. */
export const PRODUCT_CONTENT_FALLBACK: ProductContent = {
  fileNumber: '—',
  family: 'Product',
  hero: {
    line1: '',
    line2Italic: '',
    line3: '',
    lead: '',
  },
  firmware: {project: ''},
  repoUrl: 'https://github.com/Just4Stan',
  inTheBox: [],
  downloads: [],
  specs: [],
};
