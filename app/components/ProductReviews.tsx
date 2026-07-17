import type {ProductReview, ReviewAggregate} from '~/lib/reviews';

/**
 * Provider-neutral review UI for the PDP. Data comes from
 * app/lib/reviews.ts (the Judge.me seam) — nothing in here knows or
 * cares where a review originated. Engineering-document styling:
 * hairline rows, JetBrains Mono numerals, tokens only (see the
 * "PDP reviews" section in app/styles/app.css).
 */

const STARS_FILLED = '★★★★★';
const STARS_EMPTY = '☆☆☆☆☆';

/** Five mono star glyphs, filled to the rounded rating. */
export function ReviewStars({rating}: {rating: number}) {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span
      className="review-stars"
      role="img"
      aria-label={`Rated ${rating} out of 5`}
    >
      <span aria-hidden="true">
        {STARS_FILLED.slice(0, filled)}
        {STARS_EMPTY.slice(0, 5 - filled)}
      </span>
    </span>
  );
}

/**
 * Buy-area aggregate line: stars, average, count. Links to the reviews
 * chapter further down the page. Renders nothing without an aggregate —
 * a product with zero reviews shows no trace of the feature.
 */
export function ReviewAggregateLine({
  aggregate,
}: {
  aggregate: ReviewAggregate | null;
}) {
  if (!aggregate) return null;
  return (
    <a className="product-buy-reviews" href="#reviews">
      <ReviewStars rating={aggregate.value} />
      <span className="product-buy-reviews-count">
        {aggregate.value.toFixed(1)} · {aggregate.count}{' '}
        {aggregate.count === 1 ? 'review' : 'reviews'}
      </span>
    </a>
  );
}

/** ISO date (YYYY-MM-DD) — engineering-log style, no locale guessing. */
function isoDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/**
 * The chapter body: hairline-separated review rows plus a count line
 * when more reviews exist than are shown.
 */
export function ReviewList({
  reviews,
  totalCount,
}: {
  reviews: ProductReview[];
  totalCount: number;
}) {
  if (reviews.length === 0) return null;
  return (
    <>
      <ul className="review-list">
        {reviews.map((r) => (
          <li className="review-item" key={r.id}>
            <div className="review-head">
              <ReviewStars rating={r.rating} />
              <span className="review-name">{r.reviewer}</span>
              {r.verified ? (
                <span className="review-verified">Verified buyer</span>
              ) : null}
              {r.createdAt ? (
                <time className="review-date" dateTime={r.createdAt}>
                  {isoDate(r.createdAt)}
                </time>
              ) : null}
            </div>
            {r.title ? <p className="review-title">{r.title}</p> : null}
            {r.body ? <p className="review-body">{r.body}</p> : null}
          </li>
        ))}
      </ul>
      {totalCount > reviews.length ? (
        <p className="review-count-line">
          Showing the {reviews.length} most recent of {totalCount} reviews.
        </p>
      ) : null}
    </>
  );
}

/**
 * Fallback body when the review fetch resolves empty/null but the
 * metafield aggregate says reviews exist (API hiccup, sync lag). The
 * chapter keeps its number and heading; the bodies degrade gracefully.
 */
export function ReviewListFallback({totalCount}: {totalCount: number}) {
  return (
    <p className="review-count-line">
      {totalCount} {totalCount === 1 ? 'rating' : 'ratings'} on file. Full
      reviews are temporarily unavailable.
    </p>
  );
}
