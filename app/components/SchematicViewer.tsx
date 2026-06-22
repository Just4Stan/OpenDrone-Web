import {useEffect, useRef, useState} from 'react';
import {fetchJsonCached, peekJson, prefetchImage} from '~/lib/asset-prefetch';
import {SCHEMATICS_VERSION} from '~/data/schematics-version';
import {useIsMobile} from '~/lib/use-media-query';
import {useLayerSwipe} from '~/lib/use-layer-swipe';

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

// `?v=` busts Oxygen's 1-year immutable cache when schematics are regenerated in
// place — the token is the content hash of all exported sheets, baked into the
// bundle by scripts/export-schematics.mjs.
const manifestUrl = (h: string) =>
  `/schematics/${h}/manifest.json?v=${SCHEMATICS_VERSION}`;
const sheetUrl = (h: string, file: string) =>
  `/schematics/${h}/${file}?v=${SCHEMATICS_VERSION}`;

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
        // Keep the current sheet across a tier swap (clamped below if the new
        // board has fewer sheets) — mirrors BoardArt holding its active layer,
        // rather than snapping back to the first sheet on every variant switch.
        for (const s of sheets) prefetchImage(sheetUrl(handle, s.file));
      })
      .catch(() => {
        if (alive) setDisplay({handle, sheets: []});
      });
    // Warm sibling tiers (manifest + sheet images, ~1 MB/sheet) only when the
    // main thread is idle, so they never compete with the active board's sheets
    // for the first paint. Cancelled if the effect re-runs before idle fires.
    let warmId: number | undefined;
    if (handles) {
      const warm = () => {
        for (const h of handles) {
          if (h === handle) continue;
          void fetchJsonCached<Manifest>(manifestUrl(h))
            .then((m) => {
              for (const s of m.sheets ?? []) prefetchImage(sheetUrl(h, s.file));
            })
            .catch(() => {});
        }
      };
      warmId =
        typeof requestIdleCallback !== 'undefined'
          ? requestIdleCallback(warm, {timeout: 1500})
          : (setTimeout(warm, 250) as unknown as number);
    }
    return () => {
      alive = false;
      if (warmId != null) {
        if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(warmId);
        else clearTimeout(warmId);
      }
    };
  }, [inView, handle, handles]);

  const dh = display?.handle ?? handle;
  const sheets = display?.sheets ?? null;

  // Keep the active index in range when the board (re)loads with fewer sheets.
  useEffect(() => {
    if (sheets && sheets.length && active >= sheets.length) setActive(0);
  }, [sheets, active]);

  const current = sheets?.[active];

  // Step through the sheets, clamped to the ends (used by arrow keys / wheel
  // over the rail) — mirrors the board folder's layer stepping.
  const step = (delta: number) =>
    setActive((i) =>
      Math.min((sheets?.length ?? 1) - 1, Math.max(0, i + delta)),
    );

  // Touch: drag the sheet ←/→ to page through the schematic — the same peel as
  // the board explorer (active sheet slides out under the finger, the next/prev
  // chases in behind it). Vertical is left to the page; only horizontal is
  // captured. Wheel + hover stay mouse-only.
  const isMobile = useIsMobile();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const {drag, dragging} = useLayerSwipe({
    ref: pageRef,
    count: sheets?.length ?? 0,
    index: active,
    setIndex: setActive,
    enabled: isMobile,
  });

  return (
    <div className="schematic-viewer" ref={ref} data-board={dh}>
      {inView && sheets === null ? (
        <div className="schematic-skeleton" aria-hidden="true">
          <span className="board-art-skeleton-spinner" />
          <span className="board-art-skeleton-label">Loading schematic…</span>
        </div>
      ) : null}
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
            <div
              ref={pageRef}
              className={`schematic-page${dragging ? ' is-dragging' : ''}`}
              style={{
                ...(current?.w && current?.h
                  ? {['--sheet-ar' as string]: `${current.w} / ${current.h}`}
                  : {}),
                ['--drag' as string]: drag,
              } as React.CSSProperties}
            >
              {/* Every sheet is rendered and parked at its offset from the active
                  one (--rel); the mobile peel slides each to (--rel + --drag).
                  Desktop shows only the active sheet (others held at opacity 0)
                  and pages by fade. */}
              {sheets.map((s, i) => {
                const k = `${dh}:${s.slug}`;
                return (
                  <img
                    key={k}
                    className={`schematic-sheet${loaded[k] ? ' is-loaded' : ''}${i === active ? ' is-active' : ''}`}
                    style={{['--rel' as string]: i - active} as React.CSSProperties}
                    src={sheetUrl(dh, s.file)}
                    alt={`${s.label} schematic sheet`}
                    loading="lazy"
                    decoding="async"
                    aria-hidden={i === active ? undefined : true}
                    onLoad={() => setLoaded((l) => ({...l, [k]: true}))}
                  />
                );
              })}
            </div>
          </div>
          {/* Mobile: the sheet-tab rail is dropped (a mouse-era button strip);
              you page sheets by flicking the page ←/→. This slim deck mirrors the
              board explorer — a tick per sheet (tap to jump) + which sheet is up
              + a swipe hint. Hidden on desktop, where the rail is shown. */}
          <div className="schematic-deck">
            <div className="board-deck-dots" aria-label="Schematic sheet">
              {sheets.map((s, i) => (
                <button
                  type="button"
                  key={s.slug}
                  className={`board-deck-dot${i === active ? ' is-active' : ''}${
                    i < active ? ' is-done' : ''
                  }`}
                  aria-label={`Show ${s.label} sheet`}
                  aria-current={i === active ? 'true' : undefined}
                  onClick={() => setActive(i)}
                />
              ))}
            </div>
            <p className="board-deck-meta" aria-live="polite">
              <span className="board-deck-count">
                {active + 1}/{sheets.length}
              </span>
              <span className="board-deck-name">{current?.label}</span>
              <span className="board-deck-hint">Swipe ←/→</span>
            </p>
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
