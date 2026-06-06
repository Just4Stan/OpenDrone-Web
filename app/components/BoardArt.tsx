import {useEffect, useMemo, useRef, useState} from 'react';
import {fetchTextCached, peekText} from '~/lib/asset-prefetch';

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
};

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
  if (index === 0 || index === total - 1) return 'Signal + components';
  if (index === 1 || index === total - 2) return 'Ground plane';
  return 'Signal + power';
}

/** Human label for each known layer slug, in physical top→bottom order. */
const LAYER_LABELS: Record<string, string> = {
  f: 'F.Cu',
  in1: 'In1',
  in2: 'In2',
  in3: 'In3',
  in4: 'In4',
  b: 'B.Cu',
  // legacy 3-layer boards (export-board-art.mjs pre-folder)
  copper: 'Top',
  'b-copper': 'Bottom',
};

type Sheet = {slug: string; label: string; html: string};

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
export function BoardArt({src, srcs, handle, inspectUrl, layerFns}: BoardArtProps) {
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

  // Load the active board once in view and warm every sibling tier in the
  // background. The previously shown board stays on screen until the new SVG
  // resolves, so a tier toggle swaps cleanly instead of flashing empty.
  useEffect(() => {
    if (!inView) return;
    let alive = true;
    fetchTextCached(src)
      .then((text) => {
        if (!alive) return;
        setRaw(text);
        setFailed(false);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    if (srcs) {
      for (const s of srcs) {
        if (s !== src) void fetchTextCached(s).catch(() => {});
      }
    }
    return () => {
      alive = false;
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

  // Split the multi-layer SVG into one sheet per copper layer.
  const sheets = useMemo<Sheet[]>(() => {
    if (!raw || typeof DOMParser === 'undefined') return [];
    try {
      const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return [];
      const viewBox = svg.getAttribute('viewBox') ?? '';
      const defs = svg.querySelector('defs')?.outerHTML ?? '';
      const edgeInner =
        doc.getElementById('layer-edge-cuts')?.innerHTML ?? '';
      const copper = Array.from(svg.querySelectorAll('[id^="layer-"]')).filter(
        (g) => g.id !== 'layer-edge-cuts',
      ) as SVGElement[];
      return copper.map((g) => {
        const slug = g.id.replace(/^layer-/, '');
        return {
          slug,
          label: LAYER_LABELS[slug] ?? slug.toUpperCase(),
          html:
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
            `preserveAspectRatio="xMidYMid meet" class="board-sheet-svg">` +
            `<defs>${defs}</defs>` +
            `<g class="board-sheet-edge">${edgeInner}</g>` +
            `${g.outerHTML}</svg>`,
        };
      });
    } catch {
      return [];
    }
  }, [raw]);

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
          </div>
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
