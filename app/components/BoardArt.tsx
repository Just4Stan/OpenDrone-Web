import {useEffect, useMemo, useRef, useState} from 'react';
import {
  fetchJsonCached,
  fetchTextCached,
  peekJson,
  peekText,
} from '~/lib/asset-prefetch';
import {BOARD_ART_VERSION} from '~/data/board-art-version';

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
}: BoardArtProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
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
    let warmId: number | undefined;
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

  // The realistic FACE currently shown: 'F' (Front face) / 'B' (Back face), or
  // null for any copper layer. Highlights only appear on the faces — a copper
  // layer isn't "a PCB-mounted component", so no box there.
  const visibleFace =
    sheets[active]?.slug === 'front'
      ? 'F'
      : sheets[active]?.slug === 'back'
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
    if (!manifest || !highlightRefs?.length || !visibleFace) return [];
    const PAD = 0.4; // mm breathing room so the box comfortably encloses the part
    const out: Array<{ref: string; rect: number[]}> = [];
    for (const r of highlightRefs) {
      const c = manifest.map.get(r);
      if (!c || c.layer !== visibleFace || !c.bbox) continue;
      out.push({
        ref: r,
        rect: [c.bbox.x - PAD, c.bbox.y - PAD, c.bbox.w + 2 * PAD, c.bbox.h + 2 * PAD],
      });
    }
    return out;
  }, [manifest, highlightRefs, visibleFace]);
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
    stack.querySelectorAll('g.board-hilite').forEach((g) => g.remove());
    if (!highlights.length) return;
    const svg = stack.querySelector('.board-sheet.is-active svg');
    if (!svg) return;
    const vb = manifest?.viewBox?.split(/\s+/).map(Number);
    const clipId = (svg.querySelector('clipPath') as SVGClipPathElement | null)
      ?.id;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'board-hilite');

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
    if (highlightGroups?.length) {
      boxes = highlightGroups
        .map((group) => {
          const set = new Set(group);
          const rs = highlights.filter((h) => set.has(h.ref));
          return rs.length ? {ref: 'group', rect: unionRect(rs)} : null;
        })
        .filter((b): b is {ref: string; rect: number[]} => b !== null);
    } else if (highlightUnion && highlights.length > 1) {
      boxes = [{ref: 'union', rect: unionRect(highlights)}];
    } else {
      boxes = highlights;
    }

    // SPOTLIGHT: DIM the board everywhere EXCEPT a window at each highlight box
    // (one mask hole + one brighten rect per box — overlapping boxes just merge
    // in the mask, never break). The dim region is the board bbox + a margin
    // (NOT a giant rect — a huge masked element overflows the browser's mask
    // buffer and only renders a corner), clipped to the board outline so it
    // covers the whole board shape with no hard cut-off lines.
    if (vb && vb.length === 4 && vb.every((n) => Number.isFinite(n))) {
      const M = Math.max(vb[2], vb[3]); // generous margin (covers any overhang)
      const rx0 = vb[0] - M;
      const ry0 = vb[1] - M;
      const rw = vb[2] + 2 * M;
      const rh = vb[3] + 2 * M;
      const defs = document.createElementNS(NS, 'defs');
      const mask = document.createElementNS(NS, 'mask');
      mask.setAttribute('id', 'od-spot');
      mask.setAttribute('maskUnits', 'userSpaceOnUse');
      mask.setAttribute('x', String(rx0));
      mask.setAttribute('y', String(ry0));
      mask.setAttribute('width', String(rw));
      mask.setAttribute('height', String(rh));
      const base = document.createElementNS(NS, 'rect'); // white = dim applies
      base.setAttribute('x', String(rx0));
      base.setAttribute('y', String(ry0));
      base.setAttribute('width', String(rw));
      base.setAttribute('height', String(rh));
      base.setAttribute('fill', '#fff');
      mask.appendChild(base);
      for (const h of boxes) {
        const hole = document.createElementNS(NS, 'rect'); // black = window (no dim)
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
      dim.setAttribute('mask', 'url(#od-spot)');
      if (clipId) dim.setAttribute('clip-path', `url(#${clipId})`);
      g.appendChild(dim);
      // Brighten inside each box a touch (clipped to the board outline).
      for (const h of boxes) {
        const bright = document.createElementNS(NS, 'rect');
        bright.setAttribute('x', String(h.rect[0]));
        bright.setAttribute('y', String(h.rect[1]));
        bright.setAttribute('width', String(h.rect[2]));
        bright.setAttribute('height', String(h.rect[3]));
        bright.setAttribute('rx', '0.5');
        bright.setAttribute('class', 'board-hilite-bright');
        if (clipId) bright.setAttribute('clip-path', `url(#${clipId})`);
        g.appendChild(bright);
      }
    }

    // Gold box per part, on top.
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
    return () => g.remove();
  }, [
    active,
    revealed,
    sheets,
    highlights,
    manifest,
    highlightUnion,
    highlightGroups,
  ]);

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
                  data-slug={s.slug}
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
            {/* Component highlights are injected into the active sheet's own
                <svg> by the effect above (so they inherit its viewBox + every
                transform); there is no separate overlay element here. */}
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
