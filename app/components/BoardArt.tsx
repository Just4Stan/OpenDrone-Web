import {useEffect, useMemo, useRef, useState} from 'react';

export type BoardArtProps = {
  /** Public path to the layered SVG, e.g. /boards/openesc/board.svg */
  src: string;
  /** Optional handle used for analytics / data attributes. */
  handle?: string;
  /** Optional "Inspect interactively" deep-dive link (e.g. KiCanvas hosted). */
  inspectUrl?: string;
};

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
export function BoardArt({src, handle, inspectUrl}: BoardArtProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            fetch(src)
              .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
              .then((text) => {
                setRaw(text);
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => setRevealed(true)),
                );
              })
              .catch(() => setFailed(true));
            return;
          }
        }
      },
      {rootMargin: '400px 0px', threshold: 0.01},
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src]);

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

  // Park the rail against the board's actual left outline (not the box centre):
  // the floated/scaled active sheet bleeds past its slot, so we measure where
  // the PCB edge really lands and nudge the rail to sit a margin to its left.
  // Re-runs on resize so it tracks the board across aspect ratios. The active
  // sheet's settled left edge is the same for every layer, so we don't key it
  // on `active` (which would measure mid-float-animation).
  useEffect(() => {
    const rail = railRef.current;
    const body = bodyRef.current;
    if (!rail || !body) return;
    const MARGIN = 22; // breathing room between the rail and the PCB outline
    const place = () => {
      // Below the breakpoint the rail is a top bar — leave it untransformed.
      if (!window.matchMedia('(min-width: 1025px)').matches) {
        rail.style.transform = '';
        return;
      }
      const pcb = body.querySelector(
        '.board-sheet.is-active svg',
      ) as SVGElement | null;
      if (!pcb) return;
      rail.style.transform = '';
      const railRight = rail.getBoundingClientRect().right;
      const pcbLeft = pcb.getBoundingClientRect().left;
      // Pull the rail left to clear the PCB; clamp the travel so it can never
      // drift far enough left to crowd the teardown text.
      const shift = Math.max(-48, Math.min(64, pcbLeft - MARGIN - railRight));
      rail.style.transform = `translateX(${shift}px)`;
    };
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
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
            <button
              type="button"
              className="board-folder-step"
              aria-label="Previous layer (up)"
              disabled={active === 0}
              onClick={() => step(-1)}
            >
              ▲
            </button>
            <div className="board-folder-tabs">
              {sheets.map((s, i) => (
                <button
                  type="button"
                  key={s.slug}
                  className={i === active ? 'is-active' : undefined}
                  aria-pressed={i === active}
                  onClick={() => setActive(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="board-folder-step"
              aria-label="Next layer (down)"
              disabled={active === sheets.length - 1}
              onClick={() => step(1)}
            >
              ▼
            </button>
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
