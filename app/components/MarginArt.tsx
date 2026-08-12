import type {ReactNode} from 'react';
import {useEffect, useRef} from 'react';

/**
 * Margin illustrations: one stroke-only drawing per editorial section,
 * floated into the right margin by .section-art. Style contract for every
 * drawing: viewBox 240x200, stroke currentColor at width 1.5, a single
 * optional dimmed group (strokeWidth 1, opacity 0.45) for secondary
 * linework, no text, no fills beyond tiny currentColor dots. The color
 * comes from CSS so the sketches stay subtle in both themes.
 *
 * Each drawing draws ITSELF when its section scrolls into view: every
 * geometry element gets pathLength=1 so one dash rule covers them all,
 * and a per-element index staggers the strokes so the sketch appears the
 * way a plotter would lay it down. All of it is armed here at runtime:
 * without JS (or with reduced motion, see the CSS) the art is simply
 * visible, complete, from the first paint.
 */
export function MarginArt({children}: {children: ReactNode}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const fig = ref.current;
    if (!fig) return;
    const parts = fig.querySelectorAll<SVGGeometryElement>(
      'path, rect, circle, line, polyline, polygon',
    );
    parts.forEach((p, i) => {
      p.setAttribute('pathLength', '1');
      p.style.setProperty('--art-i', String(i));
    });
    fig.classList.add('will-draw');
    // The draw cue (.is-drawn) comes from EditorialShell's reading cascade,
    // so the sketch starts exactly when its section's text starts appearing.
  }, []);
  return (
    <figure className="section-art" aria-hidden="true" ref={ref}>
      {children}
    </figure>
  );
}

/**
 * A partner's logo as margin art, for pages ABOUT that partner (the
 * firmware-partners page): their mark, not our sketch. Rendered as a
 * currentColor mask so it takes the same dim, theme-aware tint as the
 * hand-drawn emblems; `ratio` is the artwork's width/height so the
 * figure reserves the right box before the mask loads.
 */
export function PartnerLogoArt({src, ratio}: {src: string; ratio: number}) {
  return (
    <span
      className="section-art-logo"
      style={{
        aspectRatio: String(ratio),
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
      }}
    />
  );
}

/* ── Wholesale ─────────────────────────────────────────────────────────── */

/** Storefront with awning: who this is for. */
export function ShopfrontArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M66 64 H174 V70 a9 9 0 0 1 -18 0 a9 9 0 0 1 -18 0 a9 9 0 0 1 -18 0 a9 9 0 0 1 -18 0 a9 9 0 0 1 -18 0 a9 9 0 0 1 -18 0 Z" />
      <path d="M76 79 V150 H164 V79" />
      <rect x="84" y="96" width="44" height="32" />
      <circle cx="97" cy="109" r="6" />
      <circle cx="115" cy="109" r="6" />
      <path d="M97 115 L106 120 L115 115" />
      <rect x="136" y="112" width="20" height="38" />
      <circle cx="140" cy="132" r="1.5" fill="currentColor" stroke="none" />
      <g strokeWidth="1" opacity="0.45">
        <line x1="48" y1="150" x2="74" y2="150" />
        <line x1="166" y1="150" x2="192" y2="150" />
      </g>
    </svg>
  );
}

/** Three boards on a shelf: what you'd be stocking. */
export function ShelfArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="54" y="80" width="38" height="44" />
      <circle cx="60" cy="86" r="2" />
      <circle cx="86" cy="86" r="2" />
      <circle cx="60" cy="118" r="2" />
      <circle cx="86" cy="118" r="2" />
      <rect x="101" y="80" width="38" height="44" />
      <circle cx="107" cy="86" r="2" />
      <circle cx="133" cy="86" r="2" />
      <circle cx="107" cy="118" r="2" />
      <circle cx="133" cy="118" r="2" />
      <rect x="148" y="80" width="38" height="44" />
      <circle cx="154" cy="86" r="2" />
      <circle cx="180" cy="86" r="2" />
      <circle cx="154" cy="118" r="2" />
      <circle cx="180" cy="118" r="2" />
      <line x1="46" y1="124" x2="194" y2="124" />
      <g strokeWidth="1" opacity="0.45">
        <rect x="66" y="96" width="14" height="12" />
        <rect x="113" y="96" width="14" height="12" />
        <rect x="160" y="96" width="14" height="12" />
        <path d="M46 124 V130 H194 V124" />
      </g>
    </svg>
  );
}

/** Envelope with a reply arrow: talk to us. */
export function EnvelopeArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="54" y="78" width="84" height="56" />
      <path d="M54 78 L96 108 L138 78" />
      <path d="M146 108 C180 108 194 90 186 72 C179 56 160 50 147 58" />
      <polyline points="157,56 147,58 152,50" />
      <g strokeWidth="1" opacity="0.45">
        <path d="M54 134 L88 110" />
        <path d="M138 134 L104 110" />
      </g>
    </svg>
  );
}

/* ── Firmware partners ─────────────────────────────────────────────────── */

/** One euro from the board, split three ways upstream. */
export function SplitFlowArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="76" cy="50" r="5" />
      <circle cx="120" cy="42" r="5" />
      <circle cx="164" cy="50" r="5" />
      <path d="M120 74 C120 62 76 68 76 55" />
      <path d="M120 74 V47" />
      <path d="M120 74 C120 62 164 68 164 55" />
      <path d="M120 92 V74" />
      <path d="M115 84 L120 79 L125 84" />
      <circle cx="120" cy="103" r="11" />
      <path d="M117 102 L121 98 V109" />
      <path d="M120 132 V116" />
      <rect x="94" y="132" width="52" height="34" />
      <circle cx="101" cy="139" r="2" />
      <circle cx="139" cy="139" r="2" />
      <circle cx="101" cy="159" r="2" />
      <circle cx="139" cy="159" r="2" />
      <g strokeWidth="1" opacity="0.45">
        <circle cx="120" cy="103" r="8" />
      </g>
    </svg>
  );
}

/** Three chips on one bus: the projects the boards run. */
export function ChipsArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="53" y="75" width="30" height="30" />
      <circle cx="60" cy="82" r="2" />
      <rect x="105" y="75" width="30" height="30" />
      <circle cx="112" cy="82" r="2" />
      <rect x="157" y="75" width="30" height="30" />
      <circle cx="164" cy="82" r="2" />
      <path d="M63 105 V126 M73 105 V126" />
      <path d="M115 105 V126 M125 105 V126" />
      <path d="M167 105 V126 M177 105 V126" />
      <line x1="46" y1="126" x2="194" y2="126" />
      <g strokeWidth="1" opacity="0.45">
        <path d="M63 69 V75 M73 69 V75 M47 85 H53 M47 95 H53 M83 85 H89 M83 95 H89" />
        <path d="M115 69 V75 M125 69 V75 M99 85 H105 M99 95 H105 M135 85 H141 M135 95 H141" />
        <path d="M167 69 V75 M177 69 V75 M151 85 H157 M151 95 H157 M187 85 H193 M187 95 H193" />
      </g>
    </svg>
  );
}

/* ── Open source ───────────────────────────────────────────────────────── */

/** Branch graph merging into a board: the community designs it. */
export function BranchMergeArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M36 100 H132" />
      <path d="M52 100 C62 100 62 76 72 76 H77" />
      <path d="M87 76 H92 C102 76 102 100 112 100" />
      <path d="M52 100 C62 100 62 124 72 124 H77" />
      <path d="M87 124 H92 C102 124 102 100 112 100" />
      <circle cx="82" cy="76" r="4" />
      <circle cx="82" cy="124" r="4" />
      <circle cx="44" cy="100" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="120" cy="100" r="2.5" fill="currentColor" stroke="none" />
      <rect x="132" y="64" width="72" height="72" rx="6" />
      <rect x="156" y="88" width="24" height="24" />
      <g strokeWidth="1" opacity="0.45">
        <circle cx="144" cy="76" r="4" />
        <circle cx="192" cy="76" r="4" />
        <circle cx="144" cy="124" r="4" />
        <circle cx="192" cy="124" r="4" />
      </g>
    </svg>
  );
}

/** Sealed box, QC check, rollers: brought to market. */
export function PackagedBoardArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="88" y="96" width="64" height="52" />
      <path d="M88 96 L104 78 H168 L152 96" />
      <path d="M168 78 V130 L152 148" />
      <circle cx="120" cy="122" r="11" />
      <path d="M114 122 L118.5 127 L127 116.5" />
      <path d="M70 148 H88" />
      <path d="M152 148 H184" />
      <circle cx="100" cy="157" r="9" />
      <circle cx="140" cy="157" r="9" />
      <circle cx="100" cy="157" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="140" cy="157" r="1.5" fill="currentColor" stroke="none" />
      <g strokeWidth="1" opacity="0.45">
        <path d="M120 96 L136 78" />
      </g>
    </svg>
  );
}

/** Scattered contributors funneled into one shipped product. */
export function FunnelArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="78" cy="46" r="3" />
      <circle cx="104" cy="38" r="3" />
      <circle cx="132" cy="44" r="3" />
      <circle cx="160" cy="38" r="3" />
      <circle cx="90" cy="60" r="3" />
      <circle cx="150" cy="58" r="3" />
      <circle cx="120" cy="54" r="3" />
      <g strokeWidth="1" opacity="0.45">
        <path d="M83 44.5 L99 39.5" />
        <path d="M109 39 L127 43" />
        <path d="M137 43 L155 39" />
        <path d="M101 42 L93 56" />
        <path d="M136 47 L146 55" />
        <path d="M116.5 50.5 L107.5 41.5" />
        <path d="M124 51 L128 47" />
      </g>
      <path d="M72 74 L110 112 V128" />
      <path d="M168 74 L130 112 V128" />
      <rect x="98" y="136" width="44" height="32" />
      <path d="M120 136 V168" />
    </svg>
  );
}

/** Vinyl grooves feeding traces: a record label for hardware. */
export function RecordTracesArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="120" cy="100" r="52" />
      <circle cx="120" cy="100" r="10" />
      <circle cx="120" cy="100" r="2" fill="currentColor" stroke="none" />
      <g strokeWidth="1" opacity="0.45">
        <path d="M120 56 A44 44 0 0 0 120 144" />
        <path d="M120 64 A36 36 0 0 0 120 136" />
        <path d="M120 72 A28 28 0 0 0 120 128" />
        <path d="M120 80 A20 20 0 0 0 120 120" />
      </g>
      <path d="M131 92 H143 L155 80 H158" />
      <circle cx="162" cy="80" r="3.5" />
      <path d="M133 100 H162" />
      <circle cx="166.5" cy="100" r="3.5" />
      <path d="M131 108 H143 L155 120 H158" />
      <circle cx="162" cy="120" r="3.5" />
    </svg>
  );
}

/** Board lifting out of its box: what you buy. */
export function UnboxArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="88" y="58" width="64" height="36" rx="2" />
      <rect x="100" y="68" width="16" height="16" />
      <rect x="126" y="64" width="12" height="7" />
      <rect x="126" y="82" width="12" height="7" />
      <rect x="76" y="118" width="88" height="50" />
      <path d="M76 118 L60 100" />
      <path d="M164 118 L180 100" />
      <g strokeWidth="1" opacity="0.45">
        <path d="M84 110 H156" />
        <path d="M96 102 V112" />
        <path d="M120 100 V112" />
        <path d="M144 102 V112" />
      </g>
    </svg>
  );
}

/** Copies cascading, each carrying its sources: copyleft. */
export function CopyleftCascadeArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="38" y="34" width="42" height="34" rx="3" />
      <circle cx="45" cy="41" r="2.5" />
      <path d="M46 56 H58 L66 48 H72" />
      <path d="M84 70 L93 77" />
      <polyline points="87.5 76 93 77 90.5 72" />
      <rect x="96" y="80" width="42" height="34" rx="3" />
      <circle cx="103" cy="87" r="2.5" />
      <path d="M104 102 H116 L124 94 H130" />
      <path d="M142 116 L151 123" />
      <polyline points="145.5 122 151 123 148.5 118" />
      <rect x="154" y="126" width="42" height="34" rx="3" />
      <circle cx="161" cy="133" r="2.5" />
      <path d="M162 148 H174 L182 140 H188" />
    </svg>
  );
}

/** One board forked into two variants, one being modified. */
export function ForkVariantsArt() {
  return (
    <svg viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="40" y="82" width="44" height="36" rx="3" />
      <circle cx="47" cy="89" r="2.5" />
      <path d="M48 106 H60 L66 100 H74" />
      <path d="M84 100 H104" />
      <path d="M104 100 C116 100 112 62 124 62 H128" />
      <polyline points="124.5 57.5 130 62 124.5 66.5" />
      <path d="M104 100 C116 100 112 138 124 138 H128" />
      <polyline points="124.5 133.5 130 138 124.5 142.5" />
      <rect x="136" y="44" width="44" height="36" rx="3" />
      <circle cx="143" cy="51" r="2.5" />
      <path d="M144 68 H156 L162 62 H170" />
      <rect x="136" y="120" width="44" height="36" rx="3" />
      <circle cx="143" cy="127" r="2.5" />
      <path d="M160 138 L150 148" />
      <path d="M169.4 133 A5.5 5.5 0 1 1 165 128.6" />
    </svg>
  );
}
