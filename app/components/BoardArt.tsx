import {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';

// useLayoutEffect on the server logs a warning; fall back to useEffect there.
// The board swap it drives is a client-only interaction, so this never matters
// functionally — it just silences the SSR noise.
const useIsoLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;
import {
  fetchJsonCached,
  fetchTextCached,
  peekJson,
  peekText,
} from '~/lib/asset-prefetch';
import {BOARD_ART_VERSION} from '~/data/board-art-version';
import {useIsMobile} from '~/lib/use-media-query';
import {useLayerSwipe} from '~/lib/use-layer-swipe';

// `?v=` busts Oxygen's 1-year immutable cache when board art is regenerated in
// place — the token is the content hash of every board.svg + front/back PNG,
// baked into the bundle by scripts/export-board-art.mjs. We version BOTH the
// board.svg fetch URL AND the face <image> hrefs (front.png/back.png) it
// references, so a re-render (e.g. an IC-less → IC-full face) refetches both the
// markup and the bitmaps instead of serving the stale cached render forever.
const versioned = (url: string) =>
  BOARD_ART_VERSION ? `${url}?v=${BOARD_ART_VERSION}` : url;

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
  /** When true, draw ONE box around the union of all `highlightRefs` instead of a
   *  box per refdes — for dense arrays (e.g. the bulk ceramic-cap grid). */
  highlightUnion?: boolean;
  /** Draw one union box per subarray (e.g. ESC motor pads grouped by motor → 4
   *  boxes). Each entry is a list of refdes; takes precedence over union/each. */
  highlightGroups?: string[][];
  /** Called with `true` while the first-reveal fly-in is animating and `false`
   *  when it finishes, so the parent can lock part-list interaction meanwhile. */
  onFlying?: (active: boolean) => void;
  /** Reports whether a part highlight is actually drawn on the visible layer, so
   *  the parent's tap-toggle can re-assert a part hidden behind another layer
   *  instead of toggling it off invisibly. */
  onHighlightVisible?: (visible: boolean) => void;
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
  front: 'Top',
  f: 'Top Cu',
  in1: 'In1',
  in2: 'In2',
  in3: 'In3',
  in4: 'In4',
  b: 'Bottom Cu',
  back: 'Bottom',
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
    // Version the face <image> hrefs (front.png/back.png) so a re-render busts
    // the PNGs' immutable cache too — the same content hash as the svg fetch, so
    // markup and bitmaps refetch together. Done on the parsed DOM before
    // serialization; copper layers carry no <image> so they're unaffected.
    for (const img of Array.from(svg.querySelectorAll('image'))) {
      const href =
        img.getAttribute('href') ?? img.getAttribute('xlink:href');
      if (href && !href.includes('?v=')) {
        const v = versioned(href);
        if (img.hasAttribute('href')) img.setAttribute('href', v);
        if (img.hasAttribute('xlink:href')) img.setAttribute('xlink:href', v);
      }
    }
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
  // Fetch the versioned URL (shared asset cache key) but key parsedCache by the
  // bare src so the rest of the component addresses boards by their stable path.
  const text = await fetchTextCached(versioned(src));
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
  highlightUnion,
  highlightGroups,
  onFlying,
  onHighlightVisible,
}: BoardArtProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  // Instance-unique suffix for the spotlight SVG ids, so two mounted BoardArts
  // can never collide on `od-dim`/`od-bright`/`od-spot` (SVG id resolution would
  // otherwise pick the first in document order → wrong board masked).
  const uid = useId().replace(/:/g, '');
  // Whether the previous render already had a highlight group on the board — so a
  // row-to-row move (highlight→highlight) skips the fade-in and just repositions
  // the spotlight, while a fresh entry (none→highlight) still fades in.
  const hadHilite = useRef(false);
  // One spotlight group per board FACE (keyed by that face's <svg> node), built
  // ONCE and then only repositioned/hidden. Re-cloning the board <image> on
  // every hover — to dim + re-light the board — is what flashed the spotlight;
  // caching per face means the dim veil and the decoded image clone are never
  // rebuilt, so neither a row-to-row move nor a front/back flip can flash. The
  // group is hidden (not destroyed) when nothing is highlighted, so re-entering
  // the list is instant too. Entries whose <svg> leaves the DOM (tier swap) are
  // pruned each run.
  const spotCache = useRef<
    Map<Element, {g: Element; brightClip: Element | null}>
  >(new Map());
  // `raw` is the SVG text currently on screen. Seed from cache so a tier that
  // was warmed earlier paints immediately with no blank frame.
  const [raw, setRaw] = useState<string | null>(
    () => peekText(versioned(src)) ?? null,
  );
  const [revealed, setRevealed] = useState<boolean>(
    () => peekText(versioned(src)) != null,
  );
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const isMobile = useIsMobile();
  // True while a variant swap is mid-flight. The rail-placement effect reads the
  // active sheet's box to position the layer textbox; measuring it WHILE the new
  // board is flying in (translated off to the side) placed the rail wrong and
  // made it jump. So we hold the rail where it is during the swap and re-place it
  // once — via `placeNonce` — when the swap has settled.
  const swapActiveRef = useRef(false);
  const [placeNonce, setPlaceNonce] = useState(0);
  // Which src the current `raw` text belongs to, and the last non-empty parsed
  // board — so a tier switch keeps the prior board on screen until the new one
  // is parsed, and never re-parses a board the cache already holds.
  const rawSrcRef = useRef<string | null>(
    peekText(versioned(src)) != null ? src : null,
  );
  const lastSheetsRef = useRef<Sheet[]>([]);
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
    fetchTextCached(versioned(src))
      .then((text) => {
        if (!alive) return;
        // Parse + cache the active board if not already cached, so the memo
        // serves it (and any later return to it) instantly.
        const parsed = parsedCache.get(src) ?? parseSheets(text);
        if (parsed.length) parsedCache.set(src, parsed);
        rawSrcRef.current = src;
        setRaw(text);
        setFailed(parsed.length === 0);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [inView, src]);

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

  // Trigger the layer fly-in only once the board reaches the centre band of the
  // viewport (not the moment the chapter scrolls in) so it reads as a deliberate
  // reveal. One-shot; the sheets sit off-screen (paused) until it fires.
  const [flyIn, setFlyIn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setFlyIn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setFlyIn(true);
        }
      },
      {rootMargin: '-38% 0px -38% 0px', threshold: 0},
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // `flyDone` ends the entrance: it strips the animation so a SKU swap (the
  // component stays mounted, new sheets inherit the classes) shows the new board
  // instantly at full scale instead of re-flying. While the fly runs we tell the
  // parent (to lock part selection) and the CSS drops the heavy filters.
  const [flyDone, setFlyDone] = useState(false);
  useEffect(() => {
    if (!flyIn || flyDone) return;
    // Honour reduced-motion: no animation, no lock — settle immediately.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setFlyDone(true);
      return;
    }
    onFlying?.(true);
    // animation 1.2s + last layer's stagger (7 × 0.11s) + a small buffer
    const t = setTimeout(() => {
      setFlyDone(true);
      onFlying?.(false);
    }, 1200 + 7 * 110 + 250);
    return () => clearTimeout(t);
  }, [flyIn, flyDone, onFlying]);

  // Pre-parse sibling tiers ONLY after the entrance finishes — parsing every
  // other board's multi-thousand-path SVG is heavy main-thread work that, if it
  // landed mid-fly, janked the compositor animation. Deferring it to flyDone
  // gives the entrance the main thread to itself; the warm still lands long
  // before a tier click.
  useEffect(() => {
    if (!flyDone || !srcs) return;
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      for (const s of srcs) {
        if (s !== src && !parsedCache.has(s)) void warmParsed(s).catch(() => {});
      }
    };
    const id: number =
      typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback(warm, {timeout: 1500})
        : (setTimeout(warm, 250) as unknown as number);
    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, [flyDone, srcs, src]);

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
  // so its visible left edge sits at/past the text column's right edge — but the
  // copy at the rail's vertical level rarely fills that column, leaving a real
  // gutter to its right. Priority, matching how a reader expects it to degrade:
  //   1. Full rail centred in the gutter, clear of both copy and board (the
  //      roomy default — wide screens).
  //   2. When the gutter is too tight for the full pill, drop the rail to
  //      names-only (`is-compact`) and centre that in the gutter instead.
  //   3. When even the names-only pill can't fit, floor it at the copy (so it
  //      never crosses the text) and let it overlay the board's edge — the
  //      last-resort overlay.
  // Re-runs (rAF-coalesced) on resize; the active sheet's settled left edge is
  // the same for every layer, so we don't key it on `active` (which would
  // measure mid-float-animation).
  useEffect(() => {
    const rail = railRef.current;
    const body = bodyRef.current;
    const root = ref.current;
    if (!rail || !body || !root) return;
    const GAP = 18; // clearance between the rail and the board's left edge
    const MARGIN = 22; // clearance between the rail and the text content
    const DEFAULT_W = 2.45; // board blow-up factor at full size (matches CSS)
    const chapter = root.closest('.chapter');
    const leftOf = (el: Element) => el.getBoundingClientRect().left;
    const widthOf = (el: Element) => el.getBoundingClientRect().width;
    const setBoardW = (w: number) =>
      root.style.setProperty('--board-w', `${w * 100}%`);
    // Rightmost edge of the teardown copy that sits at the RAIL'S vertical level
    // — a Range gives the tight text bounds (longest wrapped line), not the full
    // column box. The rail floats centred on the board, BELOW the chapter title:
    // on a narrow viewport that title wraps wide (its right edge runs ~180px past
    // the component list) but it ends well above the rail, so it shares no
    // horizontal lane with it. Counting it shoved the rail onto the board even
    // though the real gutter (component list → board) was wide open. So skip any
    // copy whose vertical span sits entirely outside [bandTop, bandBottom].
    const contentRight = (bandTop: number, bandBottom: number) => {
      const els = chapter?.querySelectorAll(
        '.chapter-title, .chapter-body, .teardown-pins li, .board-art-inspect',
      );
      if (!els?.length) {
        const col = chapter?.querySelector('.chapter-body-col');
        return col?.getBoundingClientRect().right ?? -Infinity;
      }
      let max = -Infinity;
      for (const el of els) {
        const box = el.getBoundingClientRect();
        if (box.bottom <= bandTop || box.top >= bandBottom) continue;
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
      // Mid variant-swap: leave the rail exactly where it is. The board is flying
      // in (translated), so any measurement now would mis-place it; placeNonce
      // re-runs this once the swap settles and the board's box is stable again.
      if (swapActiveRef.current) return;
      rail.classList.remove('is-compact');
      rail.style.transform = '';
      setBoardW(DEFAULT_W); // keep the board at full size; compact the rail if tight
      const stack = body.querySelector('.board-folder-stack');
      if (!stack) return;
      const sr = stack.getBoundingClientRect();
      // Board's VISIBLE left edge. The active sheet is scaled up (~1.05) and is
      // rendered WIDER than its stack column, centred over it, so the visible
      // board bleeds left of the stack box — by an amount that is NOT a fixed
      // fraction of the stack (the sheet keeps roughly its own size as the column
      // narrows, so the bleed grows as the column shrinks). Once the entrance has
      // settled (flyDone) the active sheet's rect is stable and gives the exact
      // edge, so read it directly. DURING the fly the sheets are flown off-screen
      // and the sheet rect would mis-place the rail and snap it at the end — so
      // fall back to the never-translating stack box (rough but only momentary).
      const activeSheet = stack.querySelector(
        '.board-sheet.is-active svg, .board-sheet.is-active img',
      );
      const sheetRect = flyDone ? activeSheet?.getBoundingClientRect() : null;
      const boardLeft =
        sheetRect && sheetRect.width ? sheetRect.left : sr.left - sr.width * 0.065;
      const railFull = widthOf(rail);
      // The rail floats centred on the board; the stack box is its stable vertical
      // anchor. Inset the band a little from the stack's top so the chapter title
      // — which can dip a hair into the stack's top edge — never gets counted as
      // copy in the rail's lane (it lives above the rail).
      const bandTop = sr.top + sr.height * 0.1;
      const textRight = contentRight(bandTop, sr.bottom);
      // The gutter is the clear span between the copy and the board, with the
      // mandated clearances carved out at each end.
      const gutterStart = textRight + MARGIN; // nearest the rail may sit to the copy
      const gutterEnd = boardLeft - GAP; // nearest the rail may sit to the board
      // Centre a pill of the given width in the gutter, but ALWAYS keep its right
      // edge at/left of gutterEnd (the board-side wall) — so even if boardLeft is
      // measured a hair generous, the rail can't creep onto the silk. When the
      // pill can't fit, this still floors at gutterStart so it never crosses the
      // copy (it may then overlap the board's edge — the last-resort overlay).
      const placeWidth = (w: number) => {
        const slack = gutterEnd - gutterStart - w;
        const centred = gutterStart + slack / 2;
        return Math.min(Math.max(centred, gutterStart), Math.max(gutterStart, gutterEnd - w));
      };
      let target: number;
      if (gutterEnd - gutterStart >= railFull) {
        target = placeWidth(railFull); // full rail fits, centred in the gutter
      } else {
        // Too tight for the full pill — drop to names-only and re-fit.
        rail.classList.add('is-compact');
        target = placeWidth(widthOf(rail));
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
  }, [sheets, revealed, flyDone, placeNonce]);

  // The index/refs actually rendered — the manual layer + tap/swipe-driven
  // highlight.
  const shownIndex = active;
  const effectiveRefs = highlightRefs;
  const effectiveUnion = highlightUnion;
  const effectiveGroups = highlightGroups;

  // The realistic FACE currently shown: 'F' (Front face) / 'B' (Back face), or
  // null for any copper layer. Highlights only appear on the faces — a copper
  // layer isn't "a PCB-mounted component", so no box there.
  const visibleFace =
    sheets[shownIndex]?.slug === 'front'
      ? 'F'
      : sheets[shownIndex]?.slug === 'back'
        ? 'B'
        : null;

  // On a new hover, flip the stack to the FACE that mounts the part (front for
  // F-side parts, back for B-side) so the box always lands on a face, never a
  // copper layer. Deps exclude `active` (read via ref) so manual layer paging
  // isn't fought; only a hover triggers a flip.
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (!manifest || !highlightRefs?.length) return;
    const comps = highlightRefs
      .map((r) => manifest.map.get(r))
      .filter(Boolean) as BoardComponent[];
    if (!comps.length) return;
    const fCount = comps.filter((c) => c.layer === 'F').length;
    const targetFace = fCount >= comps.length - fCount ? 'front' : 'back';
    const idx = sheets.findIndex((s) => s.slug === targetFace);
    if (idx >= 0 && idx !== activeRef.current) setActive(idx);
  }, [manifest, highlightRefs, sheets]);

  // Footprint boxes for parts mounted on the visible FACE only. A padded bbox
  // rect (mm, in the board viewBox frame) — drawn anchored INSIDE the sheet svg
  // so it scrolls with the board and sits exactly on the part.
  const highlights = useMemo(() => {
    if (!manifest || !effectiveRefs?.length || !visibleFace) return [];
    const PAD = 0.4; // mm breathing room so the box comfortably encloses the part
    const out: Array<{ref: string; rect: number[]}> = [];
    for (const r of effectiveRefs) {
      const c = manifest.map.get(r);
      if (!c || c.layer !== visibleFace || !c.bbox) continue;
      out.push({
        ref: r,
        rect: [c.bbox.x - PAD, c.bbox.y - PAD, c.bbox.w + 2 * PAD, c.bbox.h + 2 * PAD],
      });
    }
    return out;
  }, [manifest, effectiveRefs, visibleFace]);
  // Tell the parent whether the highlight is currently visible (boxes on the
  // shown face) so its tap-toggle can re-assert a part hidden under another layer.
  useEffect(() => {
    onHighlightVisible?.(highlights.length > 0);
  }, [highlights, onHighlightVisible]);
  // Draw the highlight ANCHORED inside the active sheet's own <svg>, so it
  // scrolls with the board and sits exactly on the part (it shares the viewBox +
  // every transform). Per hover we append a <g> with: a subtle dim veil over the
  // face (clipped to the board outline, with a feathered hole at each part) and a
  // gold box outline per part on top. Only runs on a FACE (highlights is empty
  // on copper layers), so there's never a box on an inner layer. No screen-space
  // overlay, no scroll tracking — fully anchored + deterministic.
  useEffect(() => {
    const stack = bodyRef.current?.querySelector('.board-folder-stack');
    if (!stack) return;
    const NS = 'http://www.w3.org/2000/svg';
    const cache = spotCache.current;

    // Prune cached spotlights whose face left the DOM (tier / board swap).
    for (const [el, entry] of cache) {
      if (!el.isConnected) {
        entry.g.remove();
        cache.delete(el);
      }
    }

    const svg = stack.querySelector('.board-sheet.is-active svg');

    // No highlight (or no face yet) → hide every cached spotlight (keep it built
    // so re-entering the list is instant + flash-free), and arm the next entry
    // to fade in fresh.
    if (!highlights.length || !svg) {
      for (const entry of cache.values()) {
        entry.g.setAttribute('class', 'board-hilite is-hidden');
      }
      hadHilite.current = false;
      return;
    }

    // Box layout: per-refdes by default; ONE union box for dense arrays
    // (`highlightUnion`, e.g. the bulk-cap grid); or one union box per subgroup
    // (`highlightGroups`, e.g. ESC motor pads grouped by motor → 4 boxes).
    const unionRect = (rs: Array<{rect: number[]}>) => {
      const x0 = Math.min(...rs.map((h) => h.rect[0]));
      const y0 = Math.min(...rs.map((h) => h.rect[1]));
      const x1 = Math.max(...rs.map((h) => h.rect[0] + h.rect[2]));
      const y1 = Math.max(...rs.map((h) => h.rect[1] + h.rect[3]));
      return [x0, y0, x1 - x0, y1 - y0];
    };
    let boxes: Array<{ref: string; rect: number[]}>;
    if (effectiveGroups?.length) {
      boxes = effectiveGroups
        .map((group) => {
          const set = new Set(group);
          const rs = highlights.filter((h) => set.has(h.ref));
          return rs.length ? {ref: 'group', rect: unionRect(rs)} : null;
        })
        .filter((b): b is {ref: string; rect: number[]} => b !== null);
    } else if (effectiveUnion && highlights.length > 1) {
      boxes = [{ref: 'union', rect: unionRect(highlights)}];
    } else {
      boxes = highlights;
    }

    // Fill the per-box geometry into a live group: the lit window(s) — one union
    // clipPath (a <rect> per box) shared by a SINGLE bright face image — plus the
    // gold boxes. Leaves the dim veil + cloned face image alone, so a move only
    // slides the lit window; the dim never re-rasterises, the image never
    // re-decodes (that was the flash).
    const paintWindows = (brightClip: Element, group: Element) => {
      while (brightClip.firstChild) brightClip.removeChild(brightClip.firstChild);
      for (const h of boxes) {
        const cr = document.createElementNS(NS, 'rect');
        cr.setAttribute('x', String(h.rect[0]));
        cr.setAttribute('y', String(h.rect[1]));
        cr.setAttribute('width', String(h.rect[2]));
        cr.setAttribute('height', String(h.rect[3]));
        cr.setAttribute('rx', '0.5');
        brightClip.appendChild(cr);
      }
      group
        .querySelectorAll('.board-highlight-shape')
        .forEach((n) => n.remove());
      for (const h of boxes) {
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', String(h.rect[0]));
        rect.setAttribute('y', String(h.rect[1]));
        rect.setAttribute('width', String(h.rect[2]));
        rect.setAttribute('height', String(h.rect[3]));
        rect.setAttribute('rx', '0.4');
        rect.setAttribute('class', 'board-highlight-shape');
        group.appendChild(rect);
      }
    };

    // Hide spotlights cached for OTHER faces (only the active face shows one).
    for (const [el, entry] of cache) {
      if (el !== svg) entry.g.setAttribute('class', 'board-hilite is-hidden');
    }

    // Fade in only when entering the list from nothing; a row move or face flip
    // mid-hover shows instantly (no fade, no flash).
    const cls = hadHilite.current ? 'board-hilite' : 'board-hilite is-fresh';

    // REUSE this face's cached spotlight: un-hide + just slide the lit window.
    const hit = cache.get(svg);
    if (hit && hit.g.isConnected && hit.brightClip) {
      hit.g.setAttribute('class', cls);
      paintWindows(hit.brightClip, hit.g);
      hadHilite.current = true;
      return;
    }

    // FRESH BUILD for this face (first time it's lit). The dim veil + ONE bright
    // face clone + union clip are built ONCE here and cached; later hovers on
    // this face take the reuse path above.
    svg.querySelectorAll('g.board-hilite').forEach((g) => g.remove());
    cache.delete(svg);
    const vb = manifest?.viewBox?.split(/\s+/).map(Number);
    const outlineClip = svg.querySelector(
      'clipPath',
    ) as SVGClipPathElement | null;
    const clipId = outlineClip?.id;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', cls);

    // SPOTLIGHT: DIM the board everywhere EXCEPT the lit window(s). The dim
    // region is the board bbox + a margin (NOT a giant rect — a huge masked
    // element overflows the browser's mask buffer and only renders a corner).
    if (vb && vb.length === 4 && vb.every((n) => Number.isFinite(n))) {
      const M = Math.max(vb[2], vb[3]); // generous region (covers any overhang)
      const rx0 = vb[0] - M;
      const ry0 = vb[1] - M;
      const rw = vb[2] + 2 * M;
      const rh = vb[3] + 2 * M;
      const defs = document.createElementNS(NS, 'defs');
      const faceImg = svg.querySelector('image');
      if (faceImg) {
        // Dim the WHOLE board picture — including ports that overhang the
        // Edge.Cuts outline — by masking a dark layer with the FACE IMAGE's
        // ALPHA (covers exactly the rendered board + ports, soft edges, no page
        // bleed). Then re-show ONE bright face clipped to a single union clipPath
        // (one <rect> per box) on top — so a row move only edits those rects, not
        // the image clones. No outline clip → no bright port sliver.
        const dimMask = document.createElementNS(NS, 'mask');
        dimMask.setAttribute('id', `od-dim-${uid}`);
        dimMask.setAttribute('maskUnits', 'userSpaceOnUse');
        dimMask.setAttribute('mask-type', 'alpha');
        dimMask.setAttribute('x', String(rx0));
        dimMask.setAttribute('y', String(ry0));
        dimMask.setAttribute('width', String(rw));
        dimMask.setAttribute('height', String(rh));
        dimMask.appendChild(faceImg.cloneNode(true));
        defs.appendChild(dimMask);
        const brightClip = document.createElementNS(NS, 'clipPath');
        brightClip.setAttribute('id', `od-bright-${uid}`);
        brightClip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        defs.appendChild(brightClip);
        g.appendChild(defs);
        const dim = document.createElementNS(NS, 'rect');
        dim.setAttribute('x', String(rx0));
        dim.setAttribute('y', String(ry0));
        dim.setAttribute('width', String(rw));
        dim.setAttribute('height', String(rh));
        dim.setAttribute('class', 'board-hilite-dim');
        dim.setAttribute('mask', `url(#od-dim-${uid})`);
        g.appendChild(dim);
        const bface = faceImg.cloneNode(true) as SVGElement;
        bface.removeAttribute('id');
        bface.setAttribute('clip-path', `url(#od-bright-${uid})`);
        bface.setAttribute('class', 'board-hilite-face');
        g.appendChild(bface);
        // Lit window(s) + gold boxes — the only parts that move between rows.
        paintWindows(brightClip, g);
        svg.appendChild(g);
        cache.set(svg, {g, brightClip});
        hadHilite.current = true;
        return;
      } else if (clipId) {
        // Fallback (no face image): dim a board-bbox rect with holes per box,
        // clipped to the outline. No <image> here, so rebuilding can't flash.
        const mask = document.createElementNS(NS, 'mask');
        mask.setAttribute('id', `od-spot-${uid}`);
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', String(rx0));
        mask.setAttribute('y', String(ry0));
        mask.setAttribute('width', String(rw));
        mask.setAttribute('height', String(rh));
        const base = document.createElementNS(NS, 'rect');
        base.setAttribute('x', String(rx0));
        base.setAttribute('y', String(ry0));
        base.setAttribute('width', String(rw));
        base.setAttribute('height', String(rh));
        base.setAttribute('fill', '#fff');
        mask.appendChild(base);
        for (const h of boxes) {
          const hole = document.createElementNS(NS, 'rect');
          hole.setAttribute('x', String(h.rect[0]));
          hole.setAttribute('y', String(h.rect[1]));
          hole.setAttribute('width', String(h.rect[2]));
          hole.setAttribute('height', String(h.rect[3]));
          hole.setAttribute('rx', '0.5');
          hole.setAttribute('fill', '#000');
          mask.appendChild(hole);
        }
        defs.appendChild(mask);
        g.appendChild(defs);
        const dim = document.createElementNS(NS, 'rect');
        dim.setAttribute('x', String(rx0));
        dim.setAttribute('y', String(ry0));
        dim.setAttribute('width', String(rw));
        dim.setAttribute('height', String(rh));
        dim.setAttribute('class', 'board-hilite-dim');
        dim.setAttribute('mask', `url(#od-spot-${uid})`);
        dim.setAttribute('clip-path', `url(#${clipId})`);
        g.appendChild(dim);
      }
    }

    // Gold box per part, on top (fallback / no-viewBox path — no reusable clip).
    for (const h of boxes) {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', String(h.rect[0]));
      rect.setAttribute('y', String(h.rect[1]));
      rect.setAttribute('width', String(h.rect[2]));
      rect.setAttribute('height', String(h.rect[3]));
      rect.setAttribute('rx', '0.4');
      rect.setAttribute('class', 'board-highlight-shape');
      g.appendChild(rect);
    }
    svg.appendChild(g);
    cache.set(svg, {g, brightClip: null});
    hadHilite.current = true;
  }, [
    shownIndex,
    revealed,
    sheets,
    highlights,
    manifest,
    effectiveUnion,
    effectiveGroups,
    visibleFace,
    uid,
  ]);

  // Memoise the sheet stack so a hover never re-renders these <button>s. A hover
  // changes highlight props on the PARENT, re-rendering BoardArt; React was then
  // re-applying each dangerouslySetInnerHTML and rebuilding the board <svg> on
  // every hover — re-decoding the board image and flashing the spotlight. Keyed
  // on [sheets, active] only, the element array is referentially stable across
  // hovers, so React skips this subtree entirely: the svg nodes stay put and the
  // imperatively-injected highlight overlay is reused (above) instead of rebuilt.
  const stackSheets = useMemo(
    () =>
      sheets.map((s, i) => (
        // One layer on screen at a time. Mobile: the incoming layer slides up +
        // fades in over the outgoing (CSS) — a clean peel, no per-layer boxes.
        <button
          type="button"
          key={s.slug}
          className={`board-sheet${i === shownIndex ? ' is-active' : ''}${
            i < shownIndex ? ' is-before' : ''
          }`}
          // --rel = position relative to the active layer (0 = on screen, ±n =
          // n cards off either edge); the mobile peel slides each sheet to
          // (--rel + --drag) * 100%. Desktop ignores it (uses the --depth fan).
          style={{['--depth' as string]: i, ['--rel' as string]: i - shownIndex}}
          aria-label={`Show ${s.label} layer`}
          aria-pressed={i === shownIndex}
          onClick={() => setActive(i)}
          dangerouslySetInnerHTML={{__html: s.html}}
        />
      )),
    [sheets, shownIndex, isMobile],
  );

  // Variant swap: when the board `src` changes (a tier toggle — the component
  // stays mounted), fly the OLD board out to the side and the new one in. We
  // freeze the previous stack's DOM into a "ghost" overlay that flies out while
  // the live (new) stack flies in. No remount, so the pin-links, highlights and
  // entrance state are all preserved.
  const stackElRef = useRef<HTMLDivElement | null>(null);
  const lastStackHtmlRef = useRef('');
  const prevSwapSrcRef = useRef(src);
  const ghostIdRef = useRef(0);
  const [ghost, setGhost] = useState<{html: string; id: number} | null>(null);
  useIsoLayoutEffect(() => {
    if (prevSwapSrcRef.current === src) return;
    prevSwapSrcRef.current = src;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Only swap once the board has finished its entrance and we have a frame to
    // peel away — otherwise let the normal reveal play.
    if (reduce || !flyDone || !lastStackHtmlRef.current) return;
    ghostIdRef.current += 1;
    const id = ghostIdRef.current;
    swapActiveRef.current = true;
    setGhost({html: lastStackHtmlRef.current, id});
    // The ghost's presence is what applies .is-swapping (the new board's fly-in)
    // on the live stack, AND it carries the old board's layers peeling out. Both
    // run on the load cadence — 1.1s + --depth stagger (0.09s × 7) ≈ 1.73s for the
    // last (BOTTOM) layer — so keep the ghost mounted until then, clearing a beat
    // after so nothing snaps mid-flight.
    const t = setTimeout(() => {
      swapActiveRef.current = false;
      setGhost((g) => (g && g.id === id ? null : g));
      // Re-place the rail now the board has settled (it was held during the swap
      // so the layer textbox didn't jump against the mid-animation board).
      setPlaceNonce((n) => n + 1);
    }, 1850);
    return () => clearTimeout(t);
  }, [src, flyDone]);
  // Remember the stack on screen so the next swap can peel it. Runs after the
  // swap effect (a passive effect, after paint), so that effect reads the
  // previous frame's HTML.
  useEffect(() => {
    if (stackElRef.current) lastStackHtmlRef.current = stackElRef.current.innerHTML;
  });

  // Step through the stack, clamped to its ends (used by chevrons / keys / wheel).
  const step = (delta: number) =>
    setActive((i) => Math.min(sheets.length - 1, Math.max(0, i + delta)));

  // Mobile: drag the board ←/→ to peel a layer. The active sheet really slides
  // out under the finger while the next/prev sheet chases in behind it (the
  // peel is driven by --drag in CSS); a flick or a far-enough drag commits,
  // else it snaps back. Vertical is left to the page (touch-action: pan-y), so
  // a swipe that reads as vertical just scrolls — only horizontal is captured.
  const {drag, dragging} = useLayerSwipe({
    ref: stackElRef,
    count: sheets.length,
    index: shownIndex,
    setIndex: setActive,
    enabled: isMobile,
  });

  return (
    <div
      ref={ref}
      className={`board-art board-folder${revealed ? ' is-revealed' : ''}${
        revealed && !flyDone ? ' is-armed' : ''
      }${flyIn && !flyDone ? ' is-flying' : ''}`}
      data-board={handle}
    >
      {sheets.length ? (
        <div className="board-folder-body" ref={bodyRef}>
          {/* Roving keyboard-nav group: arrow keys step the layer stack. The
              interactive controls (buttons) live inside; the group itself is
              focusable to capture arrow nav. Wheel is intentionally NOT captured
              — scrolling over the panel scrolls the page like anywhere else. */}
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
          >
            <span className="board-folder-rail-head">
              Layer
              <span className="board-folder-rail-count">
                {shownIndex + 1}/{sheets.length}
              </span>
            </span>
            <div className="board-folder-tabs">
              {sheets.map((s, i) => (
                <button
                  type="button"
                  key={s.slug}
                  data-slug={s.slug}
                  className={i === shownIndex ? 'is-active' : undefined}
                  aria-pressed={i === shownIndex}
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
          <div className="board-stack-wrap">
            <div
              ref={stackElRef}
              className={`board-folder-stack${ghost ? ' is-swapping' : ''}${
                dragging ? ' is-dragging' : ''
              }`}
              style={{['--drag' as string]: drag}}
            >
              {stackSheets}
              {/* Component highlights are injected into the active sheet's own
                  <svg> by the effect above (so they inherit its viewBox + every
                  transform); there is no separate overlay element here. */}
            </div>
            {/* Freeze-frame of the previous board, flying out on a tier swap. */}
            {ghost ? (
              <div
                key={ghost.id}
                className="board-folder-stack board-swap-ghost"
                aria-hidden="true"
                dangerouslySetInnerHTML={{__html: ghost.html}}
              />
            ) : null}
          </div>
          {isMobile && sheets.length ? (
            <div className="board-deck-progress">
              {/* Lightweight progress: a tick per layer (how far through the
                  stack you are) — and each is tappable to jump straight there. */}
              <div className="board-deck-dots" aria-label="Board layer">
                {sheets.map((s, i) => (
                  <button
                    type="button"
                    key={s.slug}
                    className={`board-deck-dot${i === shownIndex ? ' is-active' : ''}${
                      i < shownIndex ? ' is-done' : ''
                    }`}
                    aria-label={`Show ${s.label} layer`}
                    aria-current={i === shownIndex ? 'true' : undefined}
                    onClick={() => setActive(i)}
                  />
                ))}
              </div>
              <p className="board-deck-meta" aria-live="polite">
                <span className="board-deck-count">
                  {shownIndex + 1}/{sheets.length}
                </span>
                <span className="board-deck-name">{sheets[shownIndex]?.label}</span>
                <span className="board-deck-hint">Swipe ←/→</span>
              </p>
            </div>
          ) : null}
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
