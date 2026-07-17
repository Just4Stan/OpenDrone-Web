import {Link} from 'react-router';

export function PlaceholderBanner({side = 'right'}: {side?: 'left' | 'right'}) {
  return (
    <div
      className={`placeholder-banner${side === 'left' ? ' placeholder-banner--left' : ''}`}
      role="note"
      aria-label="Opening soon notice"
    >
      <span className="placeholder-banner__dot" aria-hidden="true" />
      <span className="placeholder-banner__tag">OPENING SOON</span>
      <Link
        className="placeholder-banner__msg"
        to="/newsletter"
        prefetch="intent"
      >
        Get notified &rarr;
      </Link>
    </div>
  );
}
