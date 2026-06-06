import {useEffect, useRef, useState} from 'react';

export type SchematicViewerProps = {
  /** Board handle whose schematic lives at /schematics/<handle>/manifest.json */
  handle: string;
  /** Optional deep-dive link (e.g. KiCanvas hosted schematic). */
  inspectUrl?: string;
};

type Sheet = {slug: string; label: string; file: string};

/**
 * Paged viewer for a multi-sheet KiCad schematic — the schematic analogue of
 * {@link BoardArt}. Reads /schematics/<handle>/manifest.json (written by
 * scripts/export-schematics.mjs), shows a tab per sheet, and lazy-loads one
 * sheet SVG at a time. The B&W export is inverted to white "blueprint" lines on
 * the dark page; CSS gives it a stacked-paper edge so it reads as a sheaf.
 *
 * Self-hiding: renders nothing until the manifest loads, and stays empty if the
 * board has no exported schematic.
 */
export function SchematicViewer({handle, inspectUrl}: SchematicViewerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            fetch(`/schematics/${handle}/manifest.json`)
              .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
              .then((m) =>
                setSheets((m as {sheets?: Sheet[]}).sheets ?? []),
              )
              .catch(() => setSheets([]));
            return;
          }
        }
      },
      {rootMargin: '500px 0px', threshold: 0.01},
    );
    io.observe(el);
    return () => io.disconnect();
  }, [handle]);

  const current = sheets?.[active];

  return (
    <div className="schematic-viewer" ref={ref} data-board={handle}>
      {sheets && sheets.length ? (
        <>
          <div
            className="schematic-tabs"
            role="group"
            aria-label="Schematic sheet"
          >
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
          <div className="schematic-page">
            {current ? (
              <img
                key={current.slug}
                className={`schematic-sheet${loaded[current.slug] ? ' is-loaded' : ''}`}
                src={`/schematics/${handle}/${current.file}`}
                alt={`${current.label} schematic sheet`}
                loading="lazy"
                decoding="async"
                onLoad={() =>
                  setLoaded((l) => ({...l, [current.slug]: true}))
                }
              />
            ) : null}
          </div>
          <div className="schematic-foot">
            <span className="schematic-count">
              Sheet {active + 1} / {sheets.length}
            </span>
            {inspectUrl ? (
              <a
                className="board-art-inspect"
                href={inspectUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open schematic ↗
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default SchematicViewer;
