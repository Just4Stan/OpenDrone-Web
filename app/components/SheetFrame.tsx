/**
 * SheetFrame — the TITLE BLOCK exhibit frame.
 *
 * An absolute-inset 1px hairline rectangle (at --sheet-inset) with corner
 * registration crosses and optional KiCad-style zone ticks (A–D across the
 * top, 1–6 down the left). It turns whatever it overlays into a numbered
 * drawing sheet: the homepage hero, the PDP gallery, chapter media figures,
 * the 404 OSD bezel. Frames are for exhibits, NOT chrome — do not wrap nav,
 * tables, or buy modules in one.
 *
 * Purely decorative: `pointer-events: none`, `aria-hidden`, and hidden below
 * 480px (styles in app.css under "SheetFrame"). The parent must establish a
 * positioning context (`position: relative`).
 *
 * Zone glyphs are drafting-sheet border coordinates (chrome, not prose) —
 * same vocabulary as a KiCad sheet border.
 */

const ZONE_COLS = ['A', 'B', 'C', 'D'] as const;
const ZONE_ROWS = ['1', '2', '3', '4', '5', '6'] as const;

export interface SheetFrameProps {
  /** Render A–D / 1–6 zone ticks in the sheet margin. Default off. */
  ticks?: boolean;
  /** Extra classes on the root (e.g. a z-index utility). */
  className?: string;
}

export function SheetFrame({ticks = false, className}: SheetFrameProps) {
  return (
    <div
      className={className ? `sheet-frame ${className}` : 'sheet-frame'}
      aria-hidden="true"
    >
      <div className="sheet-frame-rect" />
      <i className="sheet-frame-cross is-tl" />
      <i className="sheet-frame-cross is-tr" />
      <i className="sheet-frame-cross is-bl" />
      <i className="sheet-frame-cross is-br" />
      {ticks ? (
        <>
          <div className="sheet-frame-scale sheet-frame-scale-x">
            {ZONE_COLS.map((zone) => (
              <span key={zone} className="doc-annot">
                {zone}
              </span>
            ))}
          </div>
          <div className="sheet-frame-scale sheet-frame-scale-y">
            {ZONE_ROWS.map((zone) => (
              <span key={zone} className="doc-annot">
                {zone}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
