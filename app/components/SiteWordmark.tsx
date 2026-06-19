import {
  WORDMARK_GROUP_TRANSFORM,
  WORDMARK_LETTERS,
  WORDMARK_VIEWBOX,
} from '~/data/wordmark';

/**
 * Static, theme-aware OpenDrone wordmark for site chrome (header).
 *
 * Same traced paths as the animated HeroWordmark, but rendered as a flat
 * filled logo: "Open" in the body text color, "Drone" in gold — both via
 * tokens, so it inverts correctly in light mode. Replaces the white-baked
 * PNG that vanished on a light background.
 */
export function SiteWordmark({className}: {className?: string}) {
  return (
    <svg
      className={className}
      viewBox={WORDMARK_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="OpenDrone"
    >
      <g transform={WORDMARK_GROUP_TRANSFORM} fillRule="evenodd">
        {(() => {
          let goldIdx = 0;
          return WORDMARK_LETTERS.map((letter) => {
            const isGold = letter.group === 'drone';
            // Stagger the shimmer across the "Drone" letters so a faint sheen
            // sweeps left→right (light catching gold), set per gold letter.
            const style = isGold
              ? ({'--gold-index': goldIdx++} as React.CSSProperties)
              : undefined;
            return (
              <path
                key={letter.index}
                className={isGold ? 'site-wordmark-gold' : undefined}
                style={style}
                d={letter.d}
                fill={isGold ? 'var(--color-gold)' : 'var(--color-text)'}
              />
            );
          });
        })()}
      </g>
    </svg>
  );
}
