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
        {WORDMARK_LETTERS.map((letter) => (
          <path
            key={letter.index}
            d={letter.d}
            fill={
              letter.group === 'drone'
                ? 'var(--color-gold)'
                : 'var(--color-text)'
            }
          />
        ))}
      </g>
    </svg>
  );
}
