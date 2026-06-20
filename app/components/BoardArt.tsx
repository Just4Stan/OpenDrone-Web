import {useEffect, useMemo, useRef, useState} from 'react';
import {
  fetchJsonCached,
  fetchTextCached,
  peekJson,
  peekText,
} from '~/lib/asset-prefetch';

export type BoardArtProps = {
  /** Public path to the layered SVG, e.g. /boards/openesc/board.svg */
  src: string;
  /** Every tier's board SVG, so siblings can be warmed in the background and
   *  a variant toggle swaps in with no network and no blank frame. */
  srcs?: string[];
  /** Optional handle used for analytics / data attributes. */
  handle?: string;
  /** Optional "Inspect interactively" deep-dive link (e.g. KiCanvas hosted). */
  inspectUrl?: string;
  /** Per-layer function blurbs keyed by copper-layer slug (`f`, `in1`…`b`),
   *  shown beside each name in the rail. Slugs left unset fall back to a
   *  position-based guess (see {@link layerFunction}). */
  layerFns?: Record<string, string>;
  /** Public path to the component manifest (`components.json`) for the active
   *  board. Fetched lazily; when a `highlightRefs` ref matches a component its
   *  footprint is drawn as a gold highlight over the active sheet. */
  componentsSrc?: string;
  /** Refdes (case-sensitive) to highlight on the board — typically the refs of
   *  the teardown pin the visitor is hovering/focusing. */
  highlightRefs?: string[];
};

/** One component from `components.json` — coords already in the board viewBox. */
type BoardComponent = {
  ref: string;
  layer?: string;
  bbox?: {x: number; y: number; w: number; h: number};
  courtyard?: Array<[number, number]>;
};
type BoardManifest = {viewBox?: string; components?: BoardComponent[]};

/** Module cache of parsed component manifests, keyed by componentsSrc. */
const manifestCache = new Map<
  string,
  {viewBox: string; map: Map<string, BoardComponent>}
>();

function parseManifest(raw: unknown): {
  viewBox: string;
  map: Map<string, BoardComponent>;
} {
  const m = (raw ?? {}) as BoardManifest;
  const map = new Map<string, BoardComponent>();
  for (const c of m.components ?? []) {
    if (c?.ref) map.set(c.ref, c);
  }
  return {viewBox: m.viewBox ?? '', map};
}

/**
 * Short function blurb for a copper layer. A content-supplied `override` wins;
 * otherwise guess from the layer's position in the stack — the outermost pair
 * carries signals + components, the pair just inside them is almost always a
 * solid reference (ground) plane, and everything between is signal + power.
 */
function layerFunction(
  slug: string,
  index: number,
  total: number,
  override?: Record<string, string>,
): string {
  if (override?.[slug]) return override[slug];
  // The realistic composite faces describe the physical board side, not a
  // copper stack position — they must NOT get the position-based guess.
  if (slug === 'front') return 'Component side';
  if (slug === 'back') return 'Solder side';
  // The position guess applies to the copper sheets only. Front sits at index 0
  // and back at index total-1, so exclude those ends from the copper logic by
  // measuring position within the copper run (front=1st sheet, back=last).
  const copperFirst = index === 1; // first copper sheet (after front)
  const copperLast = index === total - 2; // last copper sheet (before back)
  if (copperFirst || copperLast) return 'Signal + components';
  if (index === 2 || index === total - 3) return 'Ground plane';
  return 'Signal + power';
}

/** Human label for each known layer slug, in physical top→bottom order. */
const LAYER_LABELS: Record<string, string> = {
  front: 'Front',
  f: 'F.Cu',
  in1: 'In1',
  in2: 'In2',
  in3: 'In3',
  in4: 'In4',
  b: 'B.Cu',
  back: 'Back',
  // legacy 3-layer boards (export-board-art.mjs pre-folder)
  copper: 'Top',
  'b-copper': 'Bottom',
};

/** Folder stack order: realistic front first, the copper stack top→bottom, the
 *  realistic back last. Any unknown layer slug falls in after the knowns. */
const SHEET_ORDER = ['front', 'f', 'in1', 'in2', 'in3', 'in4', 'b', 'back'];

type Sheet = {slug: string; label: string; html: string};

/**
 * Module-level cache of parsed layer sheets, keyed by board SVG src. Splitting a
 * multi-MB / 30k-path board SVG with DOMParser is the expensive step (~1 s) and
 * used to re-run on every variant click. Caching the parsed result — and
 * pre-parsing sibling tiers in the background the moment the section is in view —
 * turns a tier switch into an instant cache hit instead of a fetch + parse.
 */
const parsedCache = new Map<string, Sheet[]>();

/** Split the multi-layer board SVG into one sheet per copper layer. */
function parseSheets(raw: string): Sheet[] {
  if (!raw || typeof DOMParser === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return [];
    const viewBox = svg.getAttribute('viewBox') ?? '';
    const defs = svg.querySelector('defs')?.outerHTML ?? '';
    const edgeInner = doc.getElementById('layer-edge-cuts')?.innerHTML ?? '';
    // The folder shows the realistic faces (front/back) plus every copper layer;
    // `layer-edge-cuts` is the outline, drawn as a faint underlay, never a sheet.
    const layers = Array.from(svg.querySelectorAll('[id^="layer-"]')).filter(
      (g) => g.id !== 'layer-edge-cuts',
    ) as SVGElement[];
    // Order front → copper(f,in1…b) → back; unknown slugs sort after the knowns.
    layers.sort((a, b) => {
      const ia = SHEET_ORDER.indexOf(a.id.replace(/^layer-/, ''));
      const ib = SHEET_ORDER.indexOf(b.id.replace(/^layer-/, ''));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return layers.map((g) => {
      const slug = g.id.replace(/^layer-/, '');
      // The realistic faces have baked colours and an opaque board background;
      // the faint edge underlay would be hidden behind them, so skip it (and
      // tag the sheet so CSS can opt them out of any copper-only treatment).
      const isFace = slug === 'front' || slug === 'back';
      const edge = isFace
        ? ''
        : `<g class="board-sheet-edge">${edgeInner}</g>`;
      const faceClass = isFace ? ` board-sheet-svg-${slug}` : '';
      return {
        slug,
        label: LAYER_LABELS[slug] ?? slug.toUpperCase(),
        html:
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
          `preserveAspectRatio="xMidYMid meet" class="board-sheet-svg${faceClass}">` +
          `<defs>${defs}</defs>` +
          `${edge}` +
          `${g.outerHTML}</svg>`,
      };
    });
  } catch {
    return [];
  }
}

/** Fetch (text-cached) and parse a board SVG into {@link parsedCache}, so a
 *  later switch to it renders with no network and no parse. */
async function warmParsed(src: string): Promise<Sheet[]> {
  const hit = parsedCache.get(src);
  if (hit) return hit;
  const text = await fetchTextCached(src);
  const existing = parsedCache.get(src);
  if (existing) return existing;
  const parsed = parseSheets(text);
  if (parsed.length) parsedCache.set(src, parsed);
  return parsed;
}

/**
 * Render every copper layer of a KiCad board as a stack of sheets in a folder.
 *
 * The asset is one SVG (scripts/export-board-art.mjs) with a `<g id="layer-…">`
 * per copper layer plus `layer-edge-cuts` as the board outline. We split it into
 * one self-contained `<svg>` "sheet" per copper layer — each carries the shared
 * clip + a faint board silhouette + that one layer's copper. CSS fans the sheets
 * back like files in a folder; selecting a layer floats its sheet up and forward.
 *
 * Fetched lazily (only as the section nears the viewport).
 */
export function BoardArt({
  src,
  srcs,
  handle,
  inspectUrl,
  layerFns,
  componentsSrc,
  highlightRefs,
}: BoardArtProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  // `raw` is the SVG text currently on screen. Seed from cache so a tier that
  // was warmed earlier paints immediately with no blank frame.
  const [raw, setRaw] = useState<string | null>(() => peekText(src) ?? null);
  const [revealed, setRevealed] = useState<boolean>(() => peekText(src) != null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  // Which src the current `raw` text belongs to, and the last non-empty parsed
  // board — so a tier switch keeps the prior board on screen until the new one
  // is parsed, and never re-parses a board the cache already holds.
  const rawSrcRef = useRef<string | null>(peekText(src) != null ? src : null);
  const lastSheetsRef = useRef<Sheet[]>([]);
  const overlayRef = useRef<SVGSVGElement | null>(null);
  // Parsed component manifest for the active board (viewBox + ref→component
  // map). Seeded from cache so a warmed tier highlights with no fetch.
  const [manifest, setManifest] = useState<{
    viewBox: string;
    map: Map<string, BoardComponent>;
  } | null>(() => {
    if (!componentsSrc) return null;
    const cached = manifestCache.get(componentsSrc);
    if (cached) return cached;
    const peeked = peekJson(componentsSrc);
    return peeked ? parseManifest(peeked) : null;
  });

  // Lazy gate: fetch nothing until the section nears the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            setInView(true);
            return;
          }
        }
      },
      {rootMargin: '400px 0px', threshold: 0.01},
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Lazily fetch + parse the component manifest for the active board (reuses the
  // shared JSON cache + a parsed-manifest cache), so hovering a teardown pin can
  // resolve refdes → footprint geometry without a per-hover round-trip.
  useEffect(() => {
    if (!inView || !componentsSrc) return;
    const cached = manifestCache.get(componentsSrc);
    if (cached) {
      setManifest(cached);
      return;
    }
    let alive = true;
    fetchJsonCached<unknown>(componentsSrc)
      .then((data) => {
        if (!alive) return;
        const parsed =
          manifestCache.get(componentsSrc) ?? parseManifest(data);
        manifestCache.set(componentsSrc, parsed);
        setManifest(parsed);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [inView, componentsSrc]);

  // Load the active board once in view and warm every sibling tier in the
  // background. The previously shown board stays on screen until the new SVG
  // resolves, so a tier toggle swaps cleanly instead of flashing empty.
  useEffect(() => {
    if (!inView) return;
    let alive = true;
    let warmId: number | undefined;
    fetchTextCached(src)
      .then((text) => {
        if (!alive) return;
        // Parse + cache the active board if not already cached, so the memo
        // serves it (and any later return to it) instantly.
        const parsed = parsedCache.get(src) ?? parseSheets(text);
        if (parsed.length) parsedCache.set(src, parsed);
        rawSrcRef.current = src;
        setRaw(text);
        setFailed(parsed.length === 0);
        // Pre-parse every sibling tier in the background so a click is an
        // instant cache hit. Kicked off on idle (with a short timeout cap) so it
        // never competes with the active board's first paint, but still lands
        // well before the user finishes reading and clicks a tier.
        if (srcs) {
          const warm = () => {
            for (const s of srcs) {
              if (s !== src && !parsedCache.has(s)) {
                void warmParsed(s).catch(() => {});
              }
            }
          };
          warmId =
            typeof requestIdleCallback !== 'undefined'
              ? requestIdleCallback(warm, {timeout: 1500})
              : (setTimeout(warm, 250) as unknown as number);
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (warmId != null) {
        if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(warmId);
        else clearTimeout(warmId);
      }
    };
  }, [inView, src, srcs]);

  // Fade the board in once its SVG is in hand — driven off `raw`, not the fetch
  // effect's `alive` flag. A large SVG's parse can block the main thread long
  // enough that an effect re-run (e.g. a fresh `srcs` array) flips `alive` false
  // before a reveal scheduled inside the fetch effect ever fires, leaving the
  // board stuck at opacity 0. Keying on `raw` makes the reveal independent.
  useEffect(() => {
    if (raw == null) return;
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => setRevealed(true)),
    );
    return () => cancelAnimationFrame(r);
  }, [raw]);

  // Resolve the layer sheets for the active board: a cache hit (the active board
  // or a pre-parsed sibling) renders instantly; otherwise parse the freshly
  // fetched text for THIS src; while a not-yet-parsed tier is loading, keep the
  // prior board on screen instead of flashing empty.
  const sheets = useMemo<Sheet[]>(() => {
    const cached = parsedCache.get(src);
    if (cached) {
      lastSheetsRef.current = cached;
      return cached;
    }
    if (rawSrcRef.current === src && raw) {
      const parsed = parseSheets(raw);
      if (parsed.length) {
        parsedCache.set(src, parsed);
        lastSheetsRef.current = parsed;
      }
      return parsed;
    }
    return lastSheetsRef.current;
  }, [src, raw]);

  // Keep the active index in range when sheets (re)load.
  useEffect(() => {
    if (sheets.length && active >= sheets.length) setActive(0);
  }, [sheets, active]);

  // Fit the layer rail into the gutter between the teardown copy and the board,
  // measuring where the *text* and the *board* actually are (not their grid
  // columns). The board is blown up past its column and bleeds left for drama,
  // so its left edge sits at/past the text column's right edge — but the copy
  // rarely fills that column, leaving a real gutter to its right. Priority,
  // matching how a reader expects it to degrade:
  //   1. Park the full rail in the gutter, a margin clear of the board (the
  //      roomy default — untouched on wide screens).
  //   2. When the gutter is too tight, shrink the board (`--board-w`, down to
  //      MIN_W) just enough to reopen a full-rail gutter — the board gives up
  //      size to keep the whole menu visible.
  //   3. Only when even the smallest board can't free the room: drop the rail
  //      to names-only (`is-compact`) and, if still tight, slide it over the
  //      board — always floored so it clears the copy.
  // The board's right edge is pinned (CSS keeps width + margin = 125%), so
  // shrinking only pulls its left edge rightward. Re-runs (rAF-coalesced) on
  // resize; the active sheet's settled left edge is the same for every layer,
  // so we don't key it on `active` (which would measure mid-float-animation).
  useEffect(() => {
    const rail = railRef.current;
    const body = bodyRef.current;
    const root = ref.current;
    if (!rail || !body || !root) return;
    const GAP = 18; // clearance between the rail and the board's left edge
    const MARGIN = 22; // clearance between the rail and the text content
    const DEFAULT_W = 2.45; // board blow-up factor at full size (matches CSS)
    const MIN_W = 1.7; // smallest the board shrinks to before the rail compacts
    const chapter = root.closest('.chapter');
    const activeSvg = () =>
      body.querySelector('.board-sheet.is-active svg') as SVGElement | null;
    const leftOf = (el: Element) => el.getBoundingClientRect().left;
    const widthOf = (el: Element) => el.getBoundingClientRect().width;
    const setBoardW = (w: number) =>
      root.style.setProperty('--board-w', `${w * 100}%`);
    // Rightmost edge of the actual rendered teardown copy — a Range gives the
    // tight text bounds (longest wrapped line), not the full column box.
    const contentRight = () => {
      const els = chapter?.querySelectorAll(
        '.chapter-title, .chapter-body, .teardown-pins li, .board-art-inspect',
      );
      if (!els?.length) {
        const col = chapter?.querySelector('.chapter-body-col');
        return col?.getBoundingClientRect().right ?? -Infinity;
      }
      let max = -Infinity;
      for (const el of els) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rect = range.getBoundingClientRect();
        if (rect.width) max = Math.max(max, rect.right);
      }
      return max;
    };
    const place = () => {
      // Below the breakpoint the rail is a full-width top bar — reset both.
      if (!window.matchMedia('(min-width: 1025px)').matches) {
        rail.classList.remove('is-compact');
        rail.style.transform = '';
        root.style.removeProperty('--board-w');
        return;
      }
      rail.classList.remove('is-compact');
      rail.style.transform = '';
      setBoardW(DEFAULT_W);
      let svg = activeSvg();
      if (!svg) return;
      const railFull = widthOf(rail);
      const textRight = contentRight();
      // Board's left edge must clear this for the full rail to sit in the gutter.
      const fullFloor = textRight + MARGIN + railFull + GAP;
      // The board's left edge decreases as `--board-w` grows, so "full rail
      // fits" holds at small w and fails at large w. Binary-search the largest
      // w that still fits — the biggest board that keeps the whole menu. (The
      // active sheet's scale bleed makes the exact relationship non-obvious, so
      // we search rather than solve.)
      const fitsAt = (w: number) => {
        setBoardW(w);
        const s = activeSvg();
        return s ? leftOf(s) >= fullFloor : true;
      };
      let needCompact = false;
      if (fitsAt(DEFAULT_W)) {
        setBoardW(DEFAULT_W); // roomy — no shrink needed
      } else if (!fitsAt(MIN_W)) {
        setBoardW(MIN_W); // even the smallest board can't free the gutter
        needCompact = true;
      } else {
        let lo = MIN_W;
        let hi = DEFAULT_W;
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          if (fitsAt(mid)) lo = mid;
          else hi = mid;
        }
        setBoardW(lo);
      }
      svg = activeSvg();
      if (!svg) return;
      let target: number;
      if (!needCompact) {
        target = leftOf(svg) - GAP - railFull; // full rail, in the gutter
      } else {
        // Names-only rail; hug the (minimum) board if it now fits, else overlay
        // it — never crossing the copy.
        rail.classList.add('is-compact');
        const compactWidth = widthOf(rail);
        const boardLeft = leftOf(svg);
        target = Math.max(textRight + MARGIN, boardLeft - GAP - compactWidth);
      }
      rail.style.transform = `translateX(${target - leftOf(rail)}px)`;
    };
    // Coalesce resize bursts into one placement per frame — `place` forces a
    // handful of layout reads against the large board SVG.
    let scheduled = 0;
    const schedule = () => {
      if (scheduled) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        place();
      });
    };
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      if (scheduled) cancelAnimationFrame(scheduled);
      window.removeEventListener('resize', schedule);
    };
  }, [sheets, revealed]);

  // Resolve the hovered refdes to drawable footprint outlines. Coords are
  // already in the board viewBox frame, so each becomes a courtyard polygon (or
  // a bbox rect when no courtyard is present) drawn directly — no math. Drawn
  // regardless of which sheet is active: a back-side part highlighted while the
  // front face is up is the intended x-ray look-through.
  const highlights = useMemo(() => {
    if (!manifest || !highlightRefs?.length) return [];
    const out: Array<{ref: string; points?: string; rect?: number[]}> = [];
    for (const r of highlightRefs) {
      const c = manifest.map.get(r);
      if (!c) continue;
      if (c.courtyard?.length) {
        out.push({
          ref: r,
          points: c.courtyard.map(([x, y]) => `${x},${y}`).join(' '),
        });
      } else if (c.bbox) {
        out.push({ref: r, rect: [c.bbox.x, c.bbox.y, c.bbox.w, c.bbox.h]});
      }
    }
    return out;
  }, [manifest, highlightRefs]);
  const overlayViewBox = manifest?.viewBox ?? '';
  const hasHighlights = highlights.length > 0;

  // Register the highlight overlay pixel-exactly over the ACTIVE sheet. The
  // active sheet floats up/forward via CSS transform, so we can't rely on the
  // static layout box: measure the active sheet's rendered <svg> rect relative
  // to the stack and size/position the overlay to match. Because both the
  // overlay and the sheet use the SAME viewBox + xMidYMid meet, matching the box
  // guarantees the drawn footprints align to the parts. Re-runs on active
  // change, reveal, sheets reload, and resize (rAF-coalesced); a short rAF chain
  // lets the float transition settle before the final measure.
  useEffect(() => {
    const overlay = overlayRef.current;
    const stack = bodyRef.current?.querySelector(
      '.board-folder-stack',
    ) as HTMLElement | null;
    if (!overlay || !stack || !overlayViewBox) return;
    const measure = () => {
      const svg = stack.querySelector(
        '.board-sheet.is-active svg',
      ) as SVGSVGElement | null;
      if (!svg) return;
      const s = svg.getBoundingClientRect();
      const base = stack.getBoundingClientRect();
      overlay.style.left = `${s.left - base.left}px`;
      overlay.style.top = `${s.top - base.top}px`;
      overlay.style.width = `${s.width}px`;
      overlay.style.height = `${s.height}px`;
    };
    // Measure now, again next frame, and once more after the float settles, so
    // the overlay lands on the final transformed box rather than mid-animation.
    let raf1 = 0;
    let raf2 = 0;
    measure();
    raf1 = requestAnimationFrame(() => {
      measure();
      raf2 = requestAnimationFrame(measure);
    });
    const settle = window.setTimeout(measure, 650);
    let scheduled = 0;
    const schedule = () => {
      if (scheduled) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        measure();
      });
    };
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      if (scheduled) cancelAnimationFrame(scheduled);
      window.clearTimeout(settle);
      window.removeEventListener('resize', schedule);
    };
  }, [active, revealed, sheets, overlayViewBox]);

  // Step through the stack, clamped to its ends (used by chevrons / keys / wheel).
  const step = (delta: number) =>
    setActive((i) => Math.min(sheets.length - 1, Math.max(0, i + delta)));

  return (
    <div
      ref={ref}
      className={`board-art board-folder${revealed ? ' is-revealed' : ''}`}
      data-board={handle}
    >
      {sheets.length ? (
        <div className="board-folder-body" ref={bodyRef}>
          {/* Roving keyboard-nav group: arrows/wheel step the layer stack.
              The interactive controls (buttons) live inside; the group itself
              is focusable to capture arrow/wheel nav. */}
          {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div
            className="board-folder-rail"
            ref={railRef}
            role="group"
            aria-label="Copper layer"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                step(1);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                step(-1);
              }
            }}
            onWheel={(e) => {
              if (Math.abs(e.deltaY) < 2) return;
              step(e.deltaY > 0 ? 1 : -1);
            }}
          >
            <span className="board-folder-rail-head">
              Layer
              <span className="board-folder-rail-count">
                {active + 1}/{sheets.length}
              </span>
            </span>
            <div className="board-folder-tabs">
              {sheets.map((s, i) => (
                <button
                  type="button"
                  key={s.slug}
                  className={i === active ? 'is-active' : undefined}
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                >
                  <span className="board-folder-tab-name">{s.label}</span>
                  <span className="board-folder-tab-fn">
                    {layerFunction(s.slug, i, sheets.length, layerFns)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
          <div className="board-folder-stack">
            {sheets.map((s, i) => (
              <button
                type="button"
                key={s.slug}
                className={`board-sheet${i === active ? ' is-active' : ''}`}
                style={{['--depth' as string]: i}}
                aria-label={`Show ${s.label} layer`}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{__html: s.html}}
              />
            ))}
            {/* Highlight overlay — an absolutely-positioned svg sharing the
                board viewBox + xMidYMid meet, sized/placed (by the measuring
                effect) to cover the active sheet's rendered box, so footprint
                outlines register pixel-exactly. Coordinates come straight from
                components.json. */}
            {overlayViewBox ? (
              <svg
                ref={overlayRef}
                className={`board-highlight-overlay${
                  hasHighlights ? ' is-on' : ''
                }`}
                viewBox={overlayViewBox}
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                {highlights.map((h) =>
                  h.points ? (
                    <polygon
                      key={h.ref}
                      className="board-highlight-shape"
                      points={h.points}
                    />
                  ) : h.rect ? (
                    <rect
                      key={h.ref}
                      className="board-highlight-shape"
                      x={h.rect[0]}
                      y={h.rect[1]}
                      width={h.rect[2]}
                      height={h.rect[3]}
                    />
                  ) : null,
                )}
              </svg>
            ) : null}
          </div>
        </div>
      ) : null}
      {!revealed && !failed ? (
        <div className="board-art-skeleton" aria-hidden="true">
          <span className="board-art-skeleton-spinner" />
          <span className="board-art-skeleton-label">Rendering board…</span>
        </div>
      ) : null}
      {failed ? (
        <p className="board-art-fallback">
          Board art unavailable.{' '}
          {inspectUrl ? (
            <a href={inspectUrl} target="_blank" rel="noopener noreferrer">
              Open on KiCanvas ↗
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
