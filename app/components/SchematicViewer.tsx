import {useEffect, useRef, useState} from 'react';
import {fetchJsonCached, peekJson, prefetchImage} from '~/lib/asset-prefetch';

export type SchematicViewerProps = {
  /** Board handle whose schematic lives at /schematics/<handle>/manifest.json */
  handle: string;
  /** Every tier's schematic handle, so siblings (manifest + sheet images) are
   *  warmed in the background and a tier toggle swaps in with no blank frame. */
  handles?: string[];
  /** Optional deep-dive link (e.g. KiCanvas hosted schematic). */
  inspectUrl?: string;
};

type Sheet = {slug: string; label: string; file: string; w?: number; h?: number};
type Manifest = {sheets?: Sheet[]};

const manifestUrl = (h: string) => `/schematics/${h}/manifest.json`;
const sheetUrl = (h: string, file: string) => `/schematics/${h}/${file}`;

/**
 * Paged viewer for a multi-sheet KiCad schematic — the schematic analogue of
 * {@link BoardArt}. Reads /schematics/<handle>/manifest.json (written by
 * scripts/export-schematics.mjs), shows a tab per sheet, and renders one sheet
 * SVG at a time. The B&W export is inverted to white "blueprint" lines on the
 * dark page; CSS gives it a stacked-paper edge so it reads as a sheaf.
 *
 * Warms the active board's sheets and every sibling tier's manifest + sheets in
 * the background, so switching sheets — or switching tiers — is instant and
 * never flashes blank. Self-hiding: renders nothing until a manifest loads, and
 * stays empty if the board has no exported schematic.
 */
export function SchematicViewer({handle, handles, inspectUrl}: SchematicViewerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  // The board currently on screen (handle + its sheets). Seed from cache so a
  // tier that was warmed earlier paints immediately. Kept until the next
  // board's manifest resolves, so a tier toggle never blanks.
  const [display, setDisplay] = useState<{handle: string; sheets: Sheet[]} | null>(
    () => {
      const m = peekJson<Manifest>(manifestUrl(handle));
      return m ? {handle, sheets: m.sheets ?? []} : null;
    },
  );
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
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
      {rootMargin: '500px 0px', threshold: 0.01},
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Load the active board's manifest + warm its sheets, then warm every sibling
  // tier's manifest + sheets. The previously shown board stays on screen until
  // the new manifest resolves, so a tier toggle swaps cleanly.
  useEffect(() => {
    if (!inView) return;
    let alive = true;
    fetchJsonCached<Manifest>(manifestUrl(handle))
      .then((m) => {
        if (!alive) return;
        const sheets = m.sheets ?? [];
        setDisplay({handle, sheets});
        setActive(0);
        for (const s of sheets) prefetchImage(sheetUrl(handle, s.file));
      })
      .catch(() => {
        if (alive) setDisplay({handle, sheets: []});
      });
    if (handles) {
      for (const h of handles) {
        if (h === handle) continue;
        void fetchJsonCached<Manifest>(manifestUrl(h))
          .then((m) => {
            for (const s of m.sheets ?? []) prefetchImage(sheetUrl(h, s.file));
          })
          .catch(() => {});
      }
    }
    return () => {
      alive = false;
    };
  }, [inView, handle, handles]);

  const dh = display?.handle ?? handle;
  const sheets = display?.sheets ?? null;
  const current = sheets?.[active];

  // Step through the sheets, clamped to the ends (used by arrow keys / wheel
  // over the rail) — mirrors the board folder's layer stepping.
  const step = (delta: number) =>
    setActive((i) =>
      Math.min((sheets?.length ?? 1) - 1, Math.max(0, i + delta)),
    );

  return (
    <div className="schematic-viewer" ref={ref} data-board={dh}>
      {sheets && sheets.length ? (
        <>
          <div className="schematic-body">
            {/* Vertical sheet rail beside the schematic — the same selector as
                the board's copper-layer rail. Arrows/wheel step the sheets. */}
            {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
            <div
              className="schematic-rail"
              role="group"
              aria-label="Schematic sheet"
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
              <span className="schematic-rail-head">
                Sheet
                <span className="schematic-rail-count">
                  {active + 1}/{sheets.length}
                </span>
              </span>
              <div className="schematic-rail-tabs">
                {sheets.map((s, i) => (
                  <button
                    type="button"
                    key={s.slug}
                    className={i === active ? 'is-active' : undefined}
                    aria-pressed={i === active}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => prefetchImage(sheetUrl(dh, s.file))}
                    onFocus={() => prefetchImage(sheetUrl(dh, s.file))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
            <div className="schematic-page">
              {current ? (
                <img
                  key={`${dh}:${current.slug}`}
                  className={`schematic-sheet${loaded[`${dh}:${current.slug}`] ? ' is-loaded' : ''}`}
                  src={sheetUrl(dh, current.file)}
                  alt={`${current.label} schematic sheet`}
                  loading="lazy"
                  decoding="async"
                  onLoad={() =>
                    setLoaded((l) => ({...l, [`${dh}:${current.slug}`]: true}))
                  }
                />
              ) : null}
            </div>
          </div>
          {inspectUrl ? (
            <div className="schematic-foot">
              <a
                className="board-art-inspect"
                href={inspectUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open schematic ↗
              </a>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default SchematicViewer;
