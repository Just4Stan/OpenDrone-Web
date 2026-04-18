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
  specs: Array<[string, string]>;
  footnote?: string;            // appears under the family card
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
  specs: [],
};
