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

export type ChapterPin = {
  ref: string;
  part: string;
  cost?: string;
  /** Refdes (case-sensitive, e.g. "U2", "Card1") this pin points at on the
   *  board. Hovering/focusing the pin highlights these footprints in BoardArt,
   *  matched against `/boards/<handle>/components.json`. */
  refs?: string[];
  /** How to draw the highlight box(es). 'each' (default) outlines every refdes;
   *  'union' draws ONE box around the whole group — use for dense arrays like the
   *  bulk ceramic-cap grid where individual boxes look like noise. */
  box?: 'each' | 'union';
  /** Draw one union box PER subarray (e.g. ESC motor pads grouped by motor → 4
   *  boxes of 3 phases). `refs` stays the flat union for matching + spotlight. */
  boxGroups?: string[][];
  /** Render this pin as a single row of horizontal I/O "chips" instead of plain
   *  text — each chip highlights its own refs on hover (e.g. the FC's UART / I2C
   *  / LED / CAM / VTX / BUZZER solder-pad groups in one row). `refs` should be
   *  the union of all chips so side-grouping + connector lines still work. */
  chips?: Array<{label: string; refs: string[]}>;
};

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
  /** EU Declaration of Conformity (GPSR/CE). Each SKU gets one `doc`
   *  download entry once CE conformity assessment closes — no files exist
   *  yet, the kind is reserved so the slot is first-class in the type. */
  | 'doc'
  | 'firmware_manifest'
  | 'other';

export type DownloadAsset = {
  kind: DownloadKind;
  label: string;
  href: string;
  note?: string;
  size?: string;
};

/**
 * "You asked, we changed" — a community-driven design change, rendered as
 * its own PDP chapter. HARD RULE: only entries backed by a real, public
 * GitHub issue or merged PR on the product's hardware repo. Verify the URL
 * resolves and the change actually landed on the board before adding one.
 * Never invent examples; an empty array renders nothing.
 */
export type CommunityChange = {
  /** The real GitHub issue/PR URL where the change was raised. */
  url: string;
  /** GitHub login of who raised or contributed it. */
  who: string;
  /** One line: what was asked / reported / contributed. */
  asked: string;
  /** One line: what changed on the board as a result (name the rev if known). */
  changed: string;
};

/**
 * "Complete the stack" cross-sell rendered inside the buy module. The buyer
 * toggles it on and the partner board is added to the cart in the same
 * add-to-cart submit; the stack discount itself is a Shopify automatic
 * Buy-X-Get-Y and applies at checkout. It discounts the "get Y" board
 * ONLY (today: 10% off the OpenESC when bought with an OpenFC Lite),
 * never the whole pair, so copy must name the discounted board.
 * `partners` is a list on purpose: one entry today renders as a fixed
 * line, several (e.g. a future OpenFC Pro next to OpenFC Lite) render
 * as a picker.
 */
export type StackConfig = {
  /** What the partner adds, for copy: 'flight controller', 'ESC'. */
  adds: string;
  /** Candidate partner products, by Shopify handle. */
  partners: Array<{handle: string; label?: string}>;
  /** Option name matched between the two products' variants so the sizes
   *  pair up (20×20 FC with 20×20 ESC). Defaults to 'Model'. */
  matchOption?: string;
  /** Advertised discount percent. Display only: the real discount is the
   *  automatic BXGY configured in Shopify. */
  discountPct?: number;
  /** Handle of the board the BXGY actually discounts (its "get Y" side).
   *  The pct is off THIS board only, not the pair. Surfaces use it to word
   *  the badge and to derive the discounted price they display. */
  discountedHandle?: string;
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

/**
 * One tier in a product line. OpenRX (Lite/Lite-UFL/Mono/Gemini) and
 * OpenESC (20×20/30×30) are lines, not single products: the buyer picks
 * one tier on a comparison ladder that doubles as the variant selector.
 *
 * Editorial here is the source of truth for *which tiers exist and how
 * they differ*. The PDP cross-references the Shopify product's option
 * values (matched by `optionAxis` name + the key of this map) to wire
 * each card to a real, purchasable variant — price, stock, add-to-cart.
 * Until those Shopify variants exist the ladder still renders for preview
 * and the cart falls back to the single default variant.
 */
export type VariantContent = {
  /** Display name on the ladder card. Defaults to the variant key (which is
   *  what Shopify matches against); set this when the shown name should differ
   *  from the matched key (e.g. key "20×20" shown as "20×20 (mini)"). */
  label?: string;
  /** Per-tier GitHub repo, when a line splits its mounts across separate repos
   *  (OpenFC-Lite vs OpenFC-Lite-Mini, OpenESC_20X20 vs OpenESC-30x30). The PDP
   *  points the repo card, issues link and latest-commit card at this when the
   *  tier is selected; tiers without their own repo fall back to the product's
   *  `repoUrl`. Lines whose tiers share one repo (OpenRX subfolders) leave it
   *  unset. */
  repoUrl?: string;
  /** One-line role under the tier name in the ladder card. */
  tagline?: string;
  /** The 3–4 cells that differ between tiers, shown in the card body. */
  highlights: Array<[string, string]>;
  /** Per-tier spec deltas merged over the shared `specs` by row key: a
   *  value replaces the base row, `null` hides it (a cost-down tier dropping
   *  a sensor), and an unknown key appends. See `mergeSpecs` in the PDP. */
  specs?: Array<[string, string | null]>;
  /** Box lines specific to this tier, appended to the shared inTheBox. */
  inTheBox?: BoxItem[];
  /** Per-tier layered board SVG (same shape as `teardown.boardArt`). When the
   *  ladder selects this tier the teardown swaps to this art; tiers without
   *  their own art fall back to `teardown.boardArt`. Generated by
   *  `scripts/export-board-art.mjs <kicad_pcb> <handle>` — one handle per
   *  physical PCB (see scripts/boards.config.json). */
  boardArt?: {
    src: string;
    /** KiCanvas deep-link to the board (`…/blob/<branch>/…/<board>.kicad_pcb`).
     *  Must point at a single `.kicad_pcb`/`.kicad_sch` file — KiCanvas's
     *  `?github=` param does NOT resolve a repo root, a directory, or a
     *  `.kicad_pro`. Drives the teardown "Inspect interactively" link. */
    inspectUrl?: string;
    /** KiCanvas deep-link to the root `.kicad_sch` — drives the schematic
     *  chapter's "Open schematic" link. Same single-file rule as `inspectUrl`. */
    schematicUrl?: string;
    layers?: Record<string, string>;
  };
  /** Per-tier teardown component list. Each board in a line has its own
   *  refdes layout, so the pin list + hover-highlight must follow the tier the
   *  same way `boardArt` does. When set, these override `teardown.pins` for the
   *  selected tier; tiers without their own pins fall back to `teardown.pins`.
   *  Keep the `refs` keyed to the tier's `/boards/<handle>/components.json`. */
  pins?: ChapterPin[];
  /** Per-tier exploded 3D model (same shape as `teardown.frameViewer`). The
   *  CAD analogue of `boardArt` for frames: the 3" and 5" tiers each carry
   *  their own GLB so the teardown viewer explodes the selected model. Tiers
   *  without their own model fall back to `teardown.frameViewer`. */
  frameViewer?: {src: string; inspectUrl?: string};
  /** When true the tier renders as a greyed, non-selectable "Coming soon"
   *  card — a designed model that is not yet a purchasable Shopify variant.
   *  It shows on the ladder for line completeness but can't be added to cart. */
  comingSoon?: boolean;
  /** OSHWA open-source-hardware certification UID for this specific tier (each
   *  certified board has its own UID, e.g. "BE000026"). The PDP renders a
   *  certification chip linking to `certification.oshwa.org/<uid>.html` for the
   *  selected tier; falls back to the product-level `oshwaUid` when unset. */
  oshwaUid?: string;
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
    /** Optional project wordmark shown in the "The €1" chapter media slot
     *  (public path, e.g. `/logos/betaflight.svg`). Falls back to the
     *  geometric placeholder glyph when unset. */
    logo?: string;
    /** Set when the wordmark is white-on-transparent (e.g. AM32) so it gets
     *  rendered on a fixed dark tile that reads in both light and dark themes,
     *  instead of the transparent slot a multi-colour mark uses. */
    logoDark?: boolean;
  };
  repoUrl: string;
  /** A "build video" for the product — the JustFPV teardown films. When set, the
   *  "Open for learning" chapter swaps its second card from the GitHub-issues
   *  bubble to a Watch card (real YouTube thumbnail + in-page lightbox player).
   *  Only products that actually have a film carry this; the rest fall back to
   *  the issues card. `title`/`channel` come from the video's oEmbed metadata. */
  video?: {id: string; title: string; channel?: string};
  teardown?: {
    pins: ChapterPin[];
    /** Optional layered SVG of the board, generated by
     *  `scripts/export-board-art.mjs <kicad_pcb> <handle>`. The component
     *  fetches `/boards/<handle>/board.svg`, inlines it, and reveals
     *  layers on scroll. Set `inspectUrl` to link out to KiCanvas's
     *  hosted viewer for users who want pan/zoom. */
    /** `layers` maps a copper-layer slug (`f`, `in1`…`in4`, `b`) to a short
     *  function blurb shown beside its name in the layer rail (e.g. "Ground
     *  plane", "Signal · 5V"). Optional — {@link BoardArt} falls back to a
     *  position-based guess (outer = signal+components, second = ground plane,
     *  middle = signal+power) when a slug is unset. */
    boardArt?: {
      src: string;
      /** KiCanvas deep-link to the `.kicad_pcb` (single file only — a repo
       *  root, directory, or `.kicad_pro` will NOT load). Teardown layers link. */
      inspectUrl?: string;
      /** KiCanvas deep-link to the root `.kicad_sch` (single file only).
       *  Schematic chapter link. */
      schematicUrl?: string;
      layers?: Record<string, string>;
    };
    /** Optional exploded 3D model — the CAD analogue of `boardArt`, for
     *  products that are an OnShape assembly rather than a KiCad board
     *  (the frame, later motors). `src` is a public GLB whose nodes follow
     *  the top/base/arm naming the {@link FrameViewer} explodes by; set
     *  `inspectUrl` to the public OnShape document. When present the
     *  teardown renders FrameViewer instead of BoardArt. */
    frameViewer?: {src: string; inspectUrl?: string};
  };
  inTheBox: BoxItem[];          // physical items shipped
  /** Schematic PDFs, STEP files, manuals, etc. Each SKU also carries its
   *  EU Declaration of Conformity here (kind: 'doc') once CE closes —
   *  don't add DoC entries before the signed PDF exists. */
  downloads: DownloadAsset[];
  specs: Array<[string, string]>;
  footnote?: string;            // appears under the family card
  /** When set, the PDP renders a comparison-ladder selector. `optionAxis`
   *  is the Shopify option NAME that carries the line's variants
   *  (standardised to "Model"); `variants` is keyed by the option VALUE. See
   *  {@link VariantContent}. */
  optionAxis?: string;
  variants?: Record<string, VariantContent>;
  /** OSHWA certification UID for a single-board product (no per-tier split).
   *  Lines whose tiers each carry their own UID set it on the variant instead. */
  oshwaUid?: string;
  pairCta?: PairCta;            // playful cross-sell under the buy strip
  stack?: StackConfig;          // "complete the stack" cross-sell in the buy box
  bundle?: {                    // when set, the PDP renders as a bundle
    components: BundleComponent[];
  };
  /** Per-product coming-soon override. Unset = follow the global
   *  PUBLIC_COMING_SOON flag. `false` unlocks this SKU for sale while the
   *  global flag is still on; `true` keeps teasing it after the flag drops. */
  comingSoon?: boolean;
  /** Community-driven design changes with receipts — see
   *  {@link CommunityChange} for the verification rule. Renders as a
   *  "You asked, we changed" PDP chapter; empty/unset renders nothing. */
  communityChanges?: CommunityChange[];
};

export const PRODUCT_CONTENT: Record<string, ProductContent> = {
  openesc: {
    fileNumber: '01',
    family: '4-in-1 ESC',
    hero: {
      line1: 'An ESC (or 4)',
      line2Italic: '',
      line3: '',
      lead:
        "6 mosfets per motor, 2 for each phase. Driven by a gate driver, controlled by a microcontroller. Duplicate that 4 times et voila, 'An ESC'.",
    },
    firmware: {
      project: 'AM32',
      projectUrl:
        'https://github.com/am32-firmware/AM32',
      logo: '/logos/am32.svg',
      logoDark: true,
    },
    repoUrl: 'https://github.com/incutec-hw/OpenESC_20X20',
    video: {id: 'TwAmmPxOpTM', title: 'How Drone ESCs Work (so I built my own)'},
    teardown: {
      // refs keyed to /boards/openesc/components.json (20×20 board, the default
      // tier). The 30×30 tier overrides these in its variant `pins`.
      pins: [
        {ref: '①', part: 'AT32F421 motor MCU', cost: '×4', refs: ['U2', 'U6', 'U8', 'U10']},
        {ref: '②', part: 'NSG2065Q gate driver', cost: '×4', refs: ['U3', 'U7', 'U9', 'U11']},
        {
          ref: '③',
          part: 'DOY180N03 power MOSFET',
          cost: '×24',
          refs: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20', 'Q21', 'Q22', 'Q23', 'Q24'],
        },
        {ref: '④', part: 'INA186A3 current sense', refs: ['U12']},
        {ref: '⑤', part: '0.2 mΩ sense shunt', refs: ['Rsense1']},
        {ref: '⑥', part: 'TLV767 3.3 V LDO', refs: ['U1']},
        {ref: '⑦', part: 'LMR54406 buck', refs: ['U13']},
        {ref: '⑧', part: 'JST-SH FC connector', refs: ['J1']},
        {
          ref: '⑨',
          part: 'Motor solder pads',
          refs: [
            'U4~ESC1_MotorA_1', 'U4~ESC1_MotorA_2', 'U4~ESC1_MotorB_1', 'U4~ESC1_MotorB_2', 'U4~ESC1_MotorC_1', 'U4~ESC1_MotorC_2',
            'U4~ESC2_MotorA_1', 'U4~ESC2_MotorA_2', 'U4~ESC2_MotorB_1', 'U4~ESC2_MotorB_2', 'U4~ESC2_MotorC_1', 'U4~ESC2_MotorC_2',
            'U4~ESC3_MotorA_1', 'U4~ESC3_MotorA_2', 'U4~ESC3_MotorB_1', 'U4~ESC3_MotorB_2', 'U4~ESC3_MotorC_1', 'U4~ESC3_MotorC_2',
            'U4~ESC4_MotorA_1', 'U4~ESC4_MotorA_2', 'U4~ESC4_MotorB_1', 'U4~ESC4_MotorB_2', 'U4~ESC4_MotorC_1', 'U4~ESC4_MotorC_2',
          ],
          // one box per motor (3 phases × 2 pads each)
          boxGroups: [
            ['U4~ESC1_MotorA_1', 'U4~ESC1_MotorA_2', 'U4~ESC1_MotorB_1', 'U4~ESC1_MotorB_2', 'U4~ESC1_MotorC_1', 'U4~ESC1_MotorC_2'],
            ['U4~ESC2_MotorA_1', 'U4~ESC2_MotorA_2', 'U4~ESC2_MotorB_1', 'U4~ESC2_MotorB_2', 'U4~ESC2_MotorC_1', 'U4~ESC2_MotorC_2'],
            ['U4~ESC3_MotorA_1', 'U4~ESC3_MotorA_2', 'U4~ESC3_MotorB_1', 'U4~ESC3_MotorB_2', 'U4~ESC3_MotorC_1', 'U4~ESC3_MotorC_2'],
            ['U4~ESC4_MotorA_1', 'U4~ESC4_MotorA_2', 'U4~ESC4_MotorB_1', 'U4~ESC4_MotorB_2', 'U4~ESC4_MotorC_1', 'U4~ESC4_MotorC_2'],
          ],
        },
        {
          ref: '⑩',
          part: 'Battery pads',
          // The two big PTH lugs where the battery leads solder: CSA+ is the
          // post-shunt B+ terminal, GND_1 is the B− terminal. +BATT is the raw
          // pre-shunt rail tap. The 4 corner mounting holes are NOT here (they
          // were the old wrong highlight).
          refs: ['U4~CSA+', 'U4~+BATT', 'U4~GND_1'],
        },
        {
          ref: '⑪',
          part: 'Signal pads',
          // CURR = current-sense output; M1–M4 = per-motor telemetry; GND_2 the
          // small signal-row ground. NOT the +BATT power rail or the CSA+ lug.
          refs: ['U4~CURR', 'U4~M1', 'U4~M2', 'U4~M3', 'U4~M4', 'U4~GND_2'],
        },
        {
          ref: '⑫',
          part: 'Bulk ceramic capacitor array',
          cost: '×20',
          box: 'union',
          refs: ['CL32', 'CL33', 'CL34', 'CL35', 'CL36', 'CL38', 'CL39', 'CL40', 'CL42', 'CL43', 'CL44', 'CL45', 'CL46', 'CL47', 'CL48', 'CL49', 'CL50', 'CL51', 'CL54', 'CL55'],
        },
      ],
      boardArt: {
        src: '/boards/openesc/board.svg',
        inspectUrl:
          'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenESC_20X20/blob/main/hardware/4in1-mini.kicad_pcb',
        schematicUrl:
          'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenESC_20X20/blob/main/hardware/4in1-mini.kicad_sch',
        layers: {
          f: 'Signal + components',
          in1: 'Ground plane',
          in2: 'Signal · 10V · 3V3',
          in3: 'Signal',
          in4: 'Ground plane',
          b: 'Signal + components',
        },
      },
    },
    inTheBox: [
      {qty: '1×', item: 'OpenESC'},
      {qty: '2×', item: '8-pin JST cable'},
      {qty: '1×', item: 'XT battery pigtail'},
      {qty: '4×', item: 'M3 grommets'},
      {qty: '1×', item: 'Low-ESR Electrolytic Capacitor'},
    ],
    // TODO(downloads): publish schematic.pdf, bom.csv, gerbers.zip, manual.pdf,
    // wiring.pdf, flashing.md to the OpenESC_20X20 repo and re-add the cards.
    // The KiCanvas viewer above + the GitHub link cover "study the design"
    // until the release artifacts ship.
    downloads: [],
    specs: [
      ['Firmware', 'AM32'],
      ['Protocol', 'DShot · bidirectional DShot telemetry · PWM'],
      ['Input', '3–6S LiPo (11.1–25.2 V)'],
      ['MCU', 'AT32F421G8U7, 120 MHz'],
      ['Gate driver', 'NSG2065Q (QFN-24)'],
      ['Current sense', 'INA186A3 high-side, board-level'],
      ['Power rails', 'LMR54406DBVR buck + TLV76733 LDO'],
      ['Connector', 'JST SM08B-SRSS-TB (8-pin BF)'],
      ['License', 'CERN-OHL-S-2.0'],
    ],
    // Launching with the 20×20 and 30×30 models. Pro (higher-current)
    // variants land later as additional values on the same "Model" axis.
    optionAxis: 'Model',
    variants: {
      '20×20': {
        oshwaUid: 'BE000028',
        highlights: [
          ['Mount', '20×20'],
          ['MOSFET', 'DOY180N03T'],
          ['Continuous', '30 A / channel*'],
        ],
        specs: [
          ['Continuous', '30 A / channel (preliminary, bench characterization pending)'],
          ['MOSFETs', 'DOY180N03T, 30 V / 1.0 mΩ'],
          ['Input', '3–6S LiPo, 6S hard maximum (30 V FETs, TVS-clamped)'],
          ['Current sense', 'INA186A3 + 0.2 mΩ shunt · 20 mV/A, 165 A full-scale'],
          ['PCB', '6-layer, 2 oz outer copper, 20×20 mount'],
        ],
      },
      '30×30': {
        oshwaUid: 'BE000029',
        // The 30×30 ESC is a separate repo from the 20×20 (the product default).
        repoUrl: 'https://github.com/incutec-hw/OpenESC-30x30',
        highlights: [
          ['Mount', '30×30'],
          ['MOSFET', 'SP40N01GHNK'],
          ['Continuous', '50 A / channel*'],
        ],
        specs: [
          ['Continuous', '50 A / channel (preliminary, bench characterization pending)'],
          ['MOSFETs', 'SP40N01GHNK, 40 V / 1.2 mΩ'],
          ['Current sense', 'INA186A3 + 2× 0.2 mΩ shunt · 10 mV/A, 330 A full-scale'],
          ['PCB', '6-layer, 30×30 mount'],
        ],
        // refs keyed to /boards/openesc-30x30/components.json.
        pins: [
          {ref: '①', part: 'AT32F421 motor MCU', cost: '×4', refs: ['U2', 'U5', 'U7', 'U9']},
          {ref: '②', part: 'NSG2065Q gate driver', cost: '×4', refs: ['U4', 'U6', 'U8', 'U10']},
          {
            ref: '③',
            part: 'SP40N01 power MOSFET (both sides)',
            cost: '×24',
            // 10 on the front, 14 on the back — the FET array spans both faces
            // on the 30×30. All 24 are listed; the viewer shows each side's
            // subset on its own face.
            refs: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20', 'Q21', 'Q22', 'Q23', 'Q24'],
          },
          {ref: '④', part: 'INA186A3 current sense', refs: ['U12']},
          {ref: '⑤', part: '0.2 mΩ sense shunt', cost: '×2', refs: ['Rsense1', 'Rsense2']},
          {ref: '⑥', part: 'TLV767 3.3 V LDO', refs: ['U15']},
          {ref: '⑦', part: 'LMR54406 buck', refs: ['U13']},
          {ref: '⑧', part: 'JST-SH FC connector', refs: ['J1']},
          {
            ref: '⑨',
            part: 'Motor solder pads',
            refs: [
              'U3~ESC1_MotorA_1', 'U3~ESC1_MotorA_2', 'U3~ESC1_MotorB_1', 'U3~ESC1_MotorB_2', 'U3~ESC1_MotorC_1', 'U3~ESC1_MotorC_2',
              'U3~ESC2_MotorA_1', 'U3~ESC2_MotorA_2', 'U3~ESC2_MotorB_1', 'U3~ESC2_MotorB_2', 'U3~ESC2_MotorC_1', 'U3~ESC2_MotorC_2',
              'U3~ESC3_MotorA_1', 'U3~ESC3_MotorA_2', 'U3~ESC3_MotorB_1', 'U3~ESC3_MotorB_2', 'U3~ESC3_MotorC_1', 'U3~ESC3_MotorC_2',
              'U3~ESC4_MotorA_1', 'U3~ESC4_MotorA_2', 'U3~ESC4_MotorB_1', 'U3~ESC4_MotorB_2', 'U3~ESC4_MotorC_1', 'U3~ESC4_MotorC_2',
            ],
            // one box per motor (3 phases × 2 pads each)
            boxGroups: [
              ['U3~ESC1_MotorA_1', 'U3~ESC1_MotorA_2', 'U3~ESC1_MotorB_1', 'U3~ESC1_MotorB_2', 'U3~ESC1_MotorC_1', 'U3~ESC1_MotorC_2'],
              ['U3~ESC2_MotorA_1', 'U3~ESC2_MotorA_2', 'U3~ESC2_MotorB_1', 'U3~ESC2_MotorB_2', 'U3~ESC2_MotorC_1', 'U3~ESC2_MotorC_2'],
              ['U3~ESC3_MotorA_1', 'U3~ESC3_MotorA_2', 'U3~ESC3_MotorB_1', 'U3~ESC3_MotorB_2', 'U3~ESC3_MotorC_1', 'U3~ESC3_MotorC_2'],
              ['U3~ESC4_MotorA_1', 'U3~ESC4_MotorA_2', 'U3~ESC4_MotorB_1', 'U3~ESC4_MotorB_2', 'U3~ESC4_MotorC_1', 'U3~ESC4_MotorC_2'],
            ],
          },
          {
            ref: '⑩',
            part: 'Battery pads',
            // Big PTH lugs for the battery leads: CSA+ post-shunt B+, GND_1 B−,
            // +BATT the raw pre-shunt rail tap. Corner mounting holes excluded.
            refs: ['U3~CSA+', 'U3~+BATT', 'U3~GND_1'],
          },
          {
            ref: '⑪',
            part: 'Signal pads',
            // CURR = current-sense; M1–M4 = telemetry; GND_2 the signal-row
            // ground. Not the +BATT rail or the CSA+ lug.
            refs: ['U3~CURR', 'U3~M1', 'U3~M2', 'U3~M3', 'U3~M4', 'U3~GND_2'],
          },
          {
            ref: '⑫',
            part: 'Bulk ceramic capacitor array',
            cost: '×48',
            box: 'union',
            refs: ['C2', 'C3', 'C6', 'C7', 'C8', 'C9', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30', 'C31', 'C43', 'C44', 'C45', 'C69', 'C70', 'C71', 'C72', 'C79', 'C80', 'C82', 'C83', 'C84', 'C85', 'C87', 'C88', 'C95', 'C96', 'C97', 'C98', 'C99', 'C100', 'C101', 'C105', 'C106', 'C107', 'C108'],
          },
        ],
        boardArt: {
          src: '/boards/openesc-30x30/board.svg',
          inspectUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenESC-30x30/blob/main/hardware/4in1.kicad_pcb',
          schematicUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenESC-30x30/blob/main/hardware/4in1.kicad_sch',
          layers: {
            f: 'Signal + components',
            in1: 'Ground plane',
            in2: 'Signal · 10V · 3V3',
            in3: 'Signal',
            in4: 'Ground plane',
            b: 'Signal + components',
          },
        },
      },
    },
    stack: {
      adds: 'flight controller',
      partners: [{handle: 'openfc-lite', label: 'OpenFC Lite'}],
      matchOption: 'Model',
      discountPct: 10,
      // The BXGY discounts the ESC itself (this product) when the FC joins.
      discountedHandle: 'openesc',
    },
    // Verified 2026-07-06: PR #1 on OpenESC_20X20 by Vishal01Mehra, merged
    // 2026-03-11 — the shipping design's JST-SH FC connector (SM08B-SRSS-TB,
    // see specs above) traces back to this community PR.
    // TODO(copy-stan): placeholder wording on both lines — facts are right,
    // voice is yours.
    communityChanges: [
      {
        url: 'https://github.com/incutec-hw/OpenESC_20X20/pull/1',
        who: 'Vishal01Mehra',
        asked:
          'The FC connector and pinout didn’t follow the Betaflight connector standard — and he sent the fix as a PR, not just a complaint.',
        changed:
          'Merged. The board switched to the JST-SH connector with the corrected Betaflight-standard pinout; that’s the connector on every OpenESC since.',
      },
    ],
  },

  // The shipping cost-down flight controller. One design, two mount sizes
  // (20×20 / 30×30) that share nearly the whole BOM. Spec drawn from the
  // OpenFC-Lite / OpenFC-Lite-Mini READMEs. The Shopify product
  // (handle `openfc-lite`, Model: "20×20" / "30×30") is ACTIVE — this is the
  // live FC PDP; the old `openfc` product is archived in Shopify.
  'openfc-lite': {
    fileNumber: '02',
    family: 'Flight Controller',
    hero: {
      line1: 'A flight controller,',
      line2Italic: 'minus',
      line3: 'what you don’t need.',
      lead:
        'An RP2354 dual-core M33 running Betaflight on a 6-layer board: a 6-axis IMU, microSD blackbox, PIO-driven analog OSD (in development), and a switchable 10 V VTX rail. No barometer, no onboard radio. Bring your own RX over UART and keep the board small and cheap.',
    },
    firmware: {
      project: 'Betaflight',
      projectUrl: 'https://github.com/betaflight/betaflight',
      logo: '/logos/betaflight.svg',
    },
    repoUrl: 'https://github.com/incutec-hw/OpenFC-Lite',
    video: {
      id: 'XDYZoMRJFeQ',
      title: 'How Flight Controllers Work (so I built my own)',
    },
    teardown: {
      // `refs` keyed to the live components.json so hovering a pin highlights
      // the real footprint(s) on the board (case-sensitive refdes).
      pins: [
        {ref: '①', part: 'RP2354B · dual M33 @ 150 MHz', refs: ['U2']},
        {ref: '②', part: 'LSM6DSV16X · 6-axis IMU', refs: ['U9']},
        {ref: '③', part: 'microSD blackbox (SPI)', refs: ['Card1']},
        {
          ref: '④',
          part: 'Analog OSD',
          refs: ['U12', 'U11', 'U10'],
        },
        {
          ref: '⑤',
          part: 'Switchable VTX / 5 V buck',
          refs: ['U3', 'U4'],
          // One enlarged box per buck region: the IC + its inductor + in/out caps,
          // so it reads as "the whole buck", not just the chip.
          boxGroups: [
            ['U3', 'L2', 'C22', 'C24'],
            ['U4', 'L3', 'C23', 'C25'],
          ],
        },
        {ref: '⑥', part: 'Gyro 1.8 V LDO', refs: ['U6']},
        {ref: '⑥b', part: '3.3 V logic LDO', refs: ['U7']},
        {ref: '⑦', part: 'USB-C + power mux', refs: ['USB1', 'U5']},
        {
          ref: '⑧',
          part: 'JST-SH I/O connectors',
          refs: ['P1', 'U8', 'U13', 'U14', 'CN1'],
        },
        {
          ref: '⑨',
          part: 'I/O solder pads',
          refs: ['J35', 'J37', 'J39', 'J41', 'J9', 'J13', 'J43', 'J44', 'J48', 'J49', 'J52', 'J54', 'J15', 'J18', 'J10', 'J11', 'J23', 'J24', 'J2', 'J32', 'J33', 'J34', 'J21'],
          chips: [
            {label: 'DSHOT', refs: ['J35', 'J37', 'J39', 'J41']},
            {label: 'UART', refs: ['J9', 'J13', 'J43', 'J44', 'J48', 'J49', 'J52', 'J54']},
            {label: 'I2C', refs: ['J15', 'J18']},
            {label: 'LED', refs: ['J10', 'J11', 'J23', 'J24']},
            {label: 'CAM', refs: ['J2', 'J32']},
            {label: 'VTX', refs: ['J33', 'J34']},
            {label: 'BUZZER', refs: ['J21']},
          ],
        },
      ],
      // boardArt is supplied per variant (openfc-lite-mini / openfc-lite); the
      // PDP swaps the layer reveal as the ladder selects a mount size.
    },
    inTheBox: [
      {qty: '1×', item: 'OpenFC Lite board'},
      {qty: '1×', item: '8-pin JST SH ESC harness'},
      {qty: '4×', item: 'M3 rubber soft-mount grommets'},
      {qty: '1×', item: 'Build card', note: 'batch ID, QC initials, firmware flash command, GitHub rev'},
    ],
    // TODO(downloads): publish schematic.pdf / bom.csv / gerbers.zip / manual.pdf
    // to the OpenFC-Lite repos and wire the cards here.
    downloads: [],
    specs: [
      ['Firmware', 'Betaflight, custom RP2350 target (upstreaming in progress)'],
      ['MCU', 'RP2354, dual M33 @ 150 MHz, 2 MB flash'],
      ['IMU', 'ST LSM6DSV16X on SPI; LGA-14 footprint also takes TDK ICM-426xx'],
      ['Blackbox', 'microSD card (TF-021B)'],
      ['OSD', 'Analog, PIO-driven (in development); digital OSD via MSP DisplayPort'],
      ['Motor outputs', '4× DShot, bidirectional telemetry'],
      ['RX', 'External, over UART (CRSF/SBUS)'],
      ['Power', '3S–6S; switchable 10 V + always-on 5 V (3 A-rated bucks)'],
      ['USB', 'USB-C (config + UF2 flash)'],
      ['Layers', '6'],
      ['License', 'CERN-OHL-S-2.0'],
    ],
    optionAxis: 'Model',
    variants: {
      '20×20': {
        oshwaUid: 'BE000027',
        // The 20×20 (Mini) is its own repo; the 30×30 uses the product default.
        repoUrl: 'https://github.com/incutec-hw/OpenFC-Lite-Mini',
        tagline: 'The 20×20 mount: RP2354A, QFN-60. The compact stack size.',
        highlights: [
          ['Mount', '20×20'],
          ['Size', '20×20 mm'],
        ],
        specs: [
          ['MCU', 'RP2354A, dual M33 @ 150 MHz, QFN-60 (30 GPIO)'],
          ['Betaflight target', 'OPENFC_LITE_MINI_RP2350A'],
          ['UARTs', '3: 2 hardware + 1 PIO'],
          ['Size', '20×20 mm, 6-layer'],
        ],
        // The mini has its own refdes layout (RP2354A QFN-60, no op-amp in the
        // OSD front end). refs keyed to /boards/openfc-lite-mini/components.json.
        pins: [
          {ref: '①', part: 'RP2354A · dual M33 @ 150 MHz', refs: ['U10']},
          {ref: '②', part: 'LSM6DSV16X · 6-axis IMU', refs: ['U9']},
          {ref: '③', part: 'microSD blackbox (SPI)', refs: ['Card1']},
          {
            ref: '④',
            part: 'Analog OSD',
            refs: ['U2', 'U1', 'U18'],
          },
          {
            ref: '⑤',
            part: 'Switchable VTX / 5 V buck',
            refs: ['U3', 'U4'],
            // One enlarged box per buck region: IC + inductor + in/out caps.
            boxGroups: [
              ['U3', 'L2', 'C24', 'C26'],
              ['U4', 'L3', 'C25', 'C29'],
            ],
          },
          {ref: '⑥', part: 'Gyro 1.8 V LDO', refs: ['U6']},
          {ref: '⑥b', part: '3.3 V logic LDO', refs: ['U7']},
          {ref: '⑦', part: 'USB-C + power mux', refs: ['USB1', 'U5']},
          {
            ref: '⑧',
            part: 'JST-SH I/O connectors',
            refs: ['P1', 'U8'],
          },
          {
            ref: '⑨',
            part: 'I/O solder pads',
            refs: ['J35', 'J37', 'J39', 'J41', 'J8', 'J12', 'J43', 'J44', 'J48', 'J49', 'J15', 'J18', 'J10', 'J24', 'J32', 'J33', 'J34', 'J21'],
            chips: [
              {label: 'DSHOT', refs: ['J35', 'J37', 'J39', 'J41']},
              {label: 'UART', refs: ['J8', 'J12', 'J43', 'J44', 'J48', 'J49']},
              {label: 'I2C', refs: ['J15', 'J18']},
              {label: 'LED', refs: ['J10', 'J24']},
              {label: 'CAM', refs: ['J32']},
              {label: 'VTX', refs: ['J33', 'J34']},
              {label: 'BUZZER', refs: ['J21']},
            ],
          },
        ],
        boardArt: {
          src: '/boards/openfc-lite-mini/board.svg',
          inspectUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenFC-Lite-Mini/blob/main/hardware/OpenFC.kicad_pcb',
          schematicUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenFC-Lite-Mini/blob/main/hardware/OpenFC.kicad_sch',
        },
      },
      '30×30': {
        oshwaUid: 'BE000026',
        tagline: 'The 30×30 mount: bigger pads and more I/O.',
        highlights: [
          ['Mount', '30×30'],
          ['Size', '30.5×30.5 mm'],
        ],
        specs: [
          ['UARTs', '4: 2 hardware + 2 PIO'],
          ['Size', '30.5×30.5 mm, 6-layer'],
        ],
        boardArt: {
          src: '/boards/openfc-lite/board.svg',
          inspectUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenFC-Lite/blob/main/hardware/OpenFC.kicad_pcb',
          schematicUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenFC-Lite/blob/main/hardware/OpenFC.kicad_sch',
        },
      },
    },
    stack: {
      adds: 'ESC',
      partners: [{handle: 'openesc', label: 'OpenESC'}],
      matchOption: 'Model',
      discountPct: 10,
      // The BXGY discounts the added ESC, not this FC and not the pair.
      discountedHandle: 'openesc',
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
    repoUrl: 'https://github.com/incutec-hw/OpenRX',
    teardown: {
      // Fallback set (matches the Lite tier); each variant overrides with its
      // own refs keyed to that board's components.json. NOTE the Wi-Fi antenna
      // and the ELRS link antenna are SEPARATE (council net-trace: AE1 is on the
      // /WIFI net to the ESP32-C3; the link path is AE2 / U.FL).
      pins: [
        {ref: '①', part: 'SX1281 · 2.4 GHz LoRa radio', refs: ['U3']},
        {ref: '②', part: 'ESP32-C3 · Wi-Fi MCU', refs: ['U1']},
        {ref: '③', part: '2.4 GHz SAW band-pass filter', refs: ['FL1']},
        {ref: '④', part: 'ELRS link antenna (Molex 47948)', refs: ['AE2']},
        {ref: '⑤', part: 'Wi-Fi antenna (ESP32-C3)', refs: ['AE1']},
        {ref: '⑥', part: '52 MHz radio TCXO', refs: ['OSC1']},
        {ref: '⑦', part: 'TLV75533 · 3.3 V LDO', refs: ['U2']},
        {ref: '⑧', part: 'Solder pad I/O · CRSF UART', refs: ['TP1', 'TP2', 'TP3', 'TP4', 'TP5']},
      ],
    },
    inTheBox: [
      {qty: '1×', item: 'OpenRX board', note: 'tier selected at checkout'},
      {qty: '1×', item: 'CRSF servo cable', note: '3-pin JST-SH1.0, pre-crimped, 10 cm'},
      {qty: '1×', item: 'Heat-shrink sleeve + double-sided tape'},
      {qty: '1×', item: 'Build card', note: 'batch ID, QC initials, ExpressLRS flash target, GitHub rev'},
    ],
    // TODO(downloads): every previous card 404'd — the artifacts were never
    // published to the OpenRX repo. Publish schematic.pdf / boards.step /
    // bom.csv / gerbers.zip / manual.pdf / flashing.md, then re-add the cards.
    downloads: [],
    specs: [
      ['Firmware', 'ExpressLRS (3.5.0+)'],
      ['Telemetry', 'CRSF'],
      ['MCU', 'ESP32-C3, 4 MB flash'],
      ['Wi-Fi antenna', 'Dedicated on-board ceramic, separate from the link antenna'],
      ['Flashing', 'UART first, then Wi-Fi OTA / BF passthrough'],
      ['License', 'CERN-OHL-S-2.0'],
    ],
    optionAxis: 'Model',
    variants: {
      Lite: {
        oshwaUid: 'BE000030',
        tagline: 'SX1281 on 2.4 GHz with an on-board ceramic antenna: the low-cost default.',
        highlights: [
          ['Radio', 'Semtech SX1281'],
          ['Band', '2.4 GHz'],
          ['Antenna', 'Ceramic, on-board'],
        ],
        specs: [
          ['Radio', 'Semtech SX1281, 2.4 GHz'],
          ['Flash target', 'Unified_ESP32C3_2400_RX'],
          ['Telemetry power', '13 dBm (~20 mW)'],
          ['Antenna', 'On-board ceramic chip, no antenna wire to tear off'],
          ['Size', '10.05 × 10.55 mm, 6-layer'],
        ],
        pins: [
          {ref: '①', part: 'SX1281 · 2.4 GHz LoRa radio', refs: ['U3']},
          {ref: '②', part: 'ESP32-C3 · Wi-Fi MCU', refs: ['U1']},
          {ref: '③', part: '2.4 GHz SAW band-pass filter', refs: ['FL1']},
          {ref: '④', part: 'ELRS link antenna (Molex 47948)', refs: ['AE2']},
          {ref: '⑤', part: 'Wi-Fi antenna (ESP32-C3)', refs: ['AE1']},
          {ref: '⑥', part: '52 MHz radio TCXO', refs: ['OSC1']},
          {ref: '⑦', part: 'TLV75533 · 3.3 V LDO', refs: ['U2']},
          {ref: '⑧', part: 'Solder pad I/O · CRSF UART', refs: ['TP1', 'TP2', 'TP3', 'TP4', 'TP5']},
        ],
        boardArt: {
          src: '/boards/openrx-lite/board.svg',
          inspectUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Lite/OpenRX-Lite.kicad_pcb',
          schematicUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Lite/OpenRX-Lite.kicad_sch',
        },
      },
      'Lite-UFL': {
        oshwaUid: 'BE000031',
        tagline: 'Same SX1281 radio, swapped to a U.FL pigtail for an external antenna.',
        highlights: [
          ['Radio', 'Semtech SX1281'],
          ['Band', '2.4 GHz'],
          ['Antenna', 'U.FL × 1'],
        ],
        specs: [
          ['Radio', 'Semtech SX1281, 2.4 GHz'],
          ['Flash target', 'Unified_ESP32C3_2400_RX'],
          ['Telemetry power', '13 dBm (~20 mW)'],
          ['Antenna', 'U.FL, run the dipole of your choice'],
          ['Size', '10.05 × 10.55 mm, 6-layer'],
        ],
        inTheBox: [{qty: '1×', item: 'U.FL dipole antenna'}],
        pins: [
          {ref: '①', part: 'SX1281 · 2.4 GHz LoRa radio', refs: ['U3']},
          {ref: '②', part: 'ESP32-C3 · Wi-Fi MCU', refs: ['U1']},
          {ref: '③', part: '2.4 GHz SAW band-pass filter', refs: ['FL1']},
          {ref: '④', part: 'ELRS link antenna · U.FL connector', refs: ['J1']},
          {ref: '⑤', part: 'Wi-Fi antenna (on-board ceramic)', refs: ['AE1']},
          {ref: '⑥', part: '52 MHz radio TCXO', refs: ['OSC1']},
          {ref: '⑦', part: 'TLV75533 · 3.3 V LDO', refs: ['U2']},
          {ref: '⑧', part: 'Solder pad I/O · CRSF UART', refs: ['TP1', 'TP2', 'TP3', 'TP4', 'TP5']},
        ],
        boardArt: {
          src: '/boards/openrx-lite-ufl/board.svg',
          inspectUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Lite-UFL/OpenRX-Lite-UFL.kicad_pcb',
          schematicUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Lite-UFL/OpenRX-Lite-UFL.kicad_sch',
        },
      },
      Mono: {
        oshwaUid: 'BE000032',
        tagline: 'Single LR1121 for multi-band links, with the RF front-end.',
        highlights: [
          ['Radio', 'Semtech LR1121'],
          ['Band', '2.4 GHz + sub-GHz'],
          ['Front-end', 'RFX2401C + SKY13373'],
          ['Antenna', 'U.FL × 1'],
        ],
        specs: [
          ['Radio', 'Semtech LR1121, dual-band from one antenna'],
          ['Flash target', 'Unified_ESP32C3_LR1121_RX'],
          ['Telemetry power', '12–22 dBm selectable (~158 mW max), 12 dB RX LNA'],
          ['Antenna', 'U.FL, both bands through one RF switch'],
          ['Size', '10.05 × 16.35 mm, 6-layer'],
        ],
        inTheBox: [{qty: '1×', item: 'U.FL dipole antenna'}],
        pins: [
          {ref: '①', part: 'LR1121 · dual-band LoRa radio', refs: ['U3']},
          {ref: '②', part: 'ESP32-C3 · Wi-Fi MCU', refs: ['U1']},
          {ref: '③', part: 'RFX2401C · PA / LNA front-end', refs: ['U4']},
          {ref: '④', part: 'SKY13373 · RF switch', refs: ['U5']},
          {ref: '⑤', part: 'ELRS link antenna · U.FL connector', refs: ['J1']},
          {ref: '⑥', part: 'Wi-Fi antenna (on-board ceramic)', refs: ['AE1']},
          {ref: '⑦', part: '32 MHz radio TCXO', refs: ['OSC1']},
          {ref: '⑧', part: 'Solder pad I/O · CRSF UART (BOOT pad on back)', refs: ['TP1', 'TP2', 'TP3', 'TP4', 'TP5']},
        ],
        boardArt: {
          src: '/boards/openrx-mono/board.svg',
          inspectUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Mono/OpenRX-Mono.kicad_pcb',
          schematicUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Mono/OpenRX-Mono.kicad_sch',
        },
      },
      Gemini: {
        oshwaUid: 'BE000033',
        tagline: 'Dual LR1121 in ExpressLRS Xrossband mode for frequency-diverse links.',
        highlights: [
          ['Radio', 'Semtech LR1121 × 2'],
          ['Band', '2.4 GHz + sub-GHz, diversity'],
          ['Front-end', 'RFX2401C + SKY13373'],
          ['Antenna', 'U.FL × 2'],
        ],
        specs: [
          ['Radio', '2× Semtech LR1121, two complete radio chains'],
          ['Flash target', 'Unified_ESP32C3_LR1121_RX'],
          ['Telemetry power', '12–22 dBm per radio (~158 mW), 12 dB RX LNA per chain'],
          ['Antenna', '2× U.FL, one per radio'],
          ['Flashing', 'UART with on-board BOOT button, Wi-Fi OTA, BF passthrough'],
          ['Size', '17.05 × 15.75 mm, 6-layer'],
        ],
        inTheBox: [
          {qty: '2×', item: 'U.FL dipole antenna', note: 'diversity pair'},
        ],
        pins: [
          {ref: '①', part: 'LR1121 · dual-band LoRa radio', cost: '×2', refs: ['U3', 'U6']},
          {ref: '②', part: 'ESP32-C3 · Wi-Fi MCU', refs: ['U1']},
          {ref: '③', part: 'RFX2401C · PA / LNA front-end', cost: '×2', refs: ['U4', 'U7']},
          {ref: '④', part: 'SKY13373 · RF switch', cost: '×2', refs: ['U5', 'U8']},
          {ref: '⑤', part: 'ELRS link antennas · U.FL', cost: '×2', refs: ['J1', 'J2']},
          {ref: '⑥', part: 'Wi-Fi antenna (on-board ceramic)', refs: ['AE1']},
          {ref: '⑦', part: '32 MHz radio TCXO', refs: ['OSC1']},
          {ref: '⑧', part: 'Solder pad I/O · CRSF UART', refs: ['TP1', 'TP2', 'TP3', 'TP4']},
        ],
        boardArt: {
          src: '/boards/openrx-gemini/board.svg',
          inspectUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Gemini/OpenRX-Gemini.kicad_pcb',
          schematicUrl:
            'https://kicanvas.org/?github=https://github.com/incutec-hw/OpenRX/blob/main/OpenRX-Gemini/OpenRX-Gemini.kicad_sch',
        },
      },
    },
  },

  openframe: {
    fileNumber: '04',
    family: 'Carbon Frame',
    hero: {
      line1: 'The body',
      line2Italic: 'everything else',
      line3: 'mounts to.',
      lead:
        'Fast, strong and optimized. CNC carbon-fibre freestyle frame on a 30.5×30.5 stack pattern. Designed in-house, OEM-machined. OpenFC Lite and OpenESC drop in without spacers.',
    },
    firmware: {
      project: '—',
    },
    repoUrl: 'https://github.com/incutec-hw',
    // TODO(copy): placeholder teardown editorial. The exploded viewer is the
    // CAD analogue of the boards' KiCanvas layer reveal; pin text reflects
    // only known specs (5 mm arms, 30.5 × 30.5 pattern) — no invented
    // material grades. inspectUrl omitted until the OnShape doc is public.
    teardown: {
      pins: [
        {ref: '①', part: 'Top plate: carbon, carries the camera + VTX bay'},
        {ref: '②', part: 'Arms: 5 mm carbon, replaced individually', cost: '×4'},
        {ref: '③', part: 'Bottom plate: 30.5 × 30.5 stack pattern'},
        {ref: '④', part: 'M3 aluminium standoffs + hardware kit'},
      ],
      // Fallback model when a tier defines none. Both tiers (3"/5") override
      // this, so it also seeds the viewer's preload set — point it at a current
      // model (the 5") rather than the stale generic frame.glb.
      frameViewer: {
        src: '/models/frame5.glb',
      },
    },
    inTheBox: [
      {qty: '1×', item: 'Top plate + bottom plate'},
      {qty: '4×', item: '5" arms'},
      {qty: '1×', item: 'Hardware kit'},
      {qty: '1×', item: 'Camera mount'},
      {qty: '1×', item: 'VTX antenna tube clamp'},
      {qty: '1×', item: 'Build card'},
    ],
    // TODO(onshape): the frame is an OnShape document, not a GitHub repo. The
    // STEP/DXF/assembly links above were placeholders pointing at a non-existent
    // GitHub repo and have been removed. Wire real artifacts (OnShape embedded
    // viewer + STEP export) once the OnShape integration lands. We do not
    // release DXF cutting files.
    downloads: [],
    specs: [
      ['Arm thickness', '5 mm carbon'],
      ['Camera', '19 mm micro'],
      ['VTX bay', '20 × 20'],
      ['Video systems', 'Analog · DJI O3/O4 · Walksnail · HDZero'],
    ],
    // TODO(copy): placeholder variant editorial — wires the "Model" axis +
    // ladder. Shared specs above still read 5-inch; reconcile once the 3"
    // (OpenFrame3) specs land.
    optionAxis: 'Model',
    variants: {
      '5" Freestyle': {
        tagline: '',
        highlights: [
          ['Stack mounts', '20×20 · 25×25 · 30×30'],
          ['Motor mount', '16×16 · 19×19 (M3)'],
        ],
        frameViewer: {src: '/models/frame5.glb'},
      },
      '3" Freestyle': {
        tagline: '',
        highlights: [
          ['Stack mounts', '20×20 · 25×25'],
          ['Motor mount', '9×9 · 12×12 (M2)'],
        ],
        frameViewer: {src: '/models/frame3.glb'},
      },
    },
  },

};

/**
 * Resolve whether a product renders as coming soon (no prices, notify-me
 * signup instead of add-to-cart). Per-product `comingSoon` in
 * {@link PRODUCT_CONTENT} wins; otherwise the global PUBLIC_COMING_SOON
 * flag (root loader `comingSoon`) decides. Callers without a handle
 * (e.g. a generic surface) pass only the flag.
 */
export function isComingSoon(
  handle: string | null | undefined,
  globalFlag: boolean,
): boolean {
  const override = handle ? PRODUCT_CONTENT[handle]?.comingSoon : undefined;
  return override ?? globalFlag;
}

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
  repoUrl: 'https://github.com/incutec-hw',
  inTheBox: [],
  downloads: [],
  specs: [],
};
