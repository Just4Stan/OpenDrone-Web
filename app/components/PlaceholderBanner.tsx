export function PlaceholderBanner() {
  return (
    <div className="placeholder-banner" role="alert" aria-live="polite">
      <span className="placeholder-banner__tag">PRE-LAUNCH</span>
      <span className="placeholder-banner__msg">
        All text, numbers, prices, specs, and claims on this site are
        placeholders (AI-generated, to be replaced). Nothing here is binding,
        accurate, or final.
      </span>
    </div>
  );
}
