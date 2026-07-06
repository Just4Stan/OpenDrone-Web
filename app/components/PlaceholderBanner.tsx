export function PlaceholderBanner({side = 'right'}: {side?: 'left' | 'right'}) {
  return (
    <div
      className={`placeholder-banner${side === 'left' ? ' placeholder-banner--left' : ''}`}
      role="note"
      aria-label="Pre-launch notice"
    >
      <span className="placeholder-banner__dot" aria-hidden="true" />
      <span className="placeholder-banner__tag">PRE-LAUNCH</span>
      <span className="placeholder-banner__msg">
        Text &amp; numbers are AI-generated placeholders.
      </span>
    </div>
  );
}
