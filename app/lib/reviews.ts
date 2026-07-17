/**
 * Product reviews — the Judge.me seam.
 *
 * This module is the ONLY file in the codebase that knows reviews come
 * from Judge.me (decision: drafts/archive/shopify-growth-research-2026-07-17.md
 * section 1 — API + metafields, no widget, no third-party JS). Everything
 * else consumes the provider-neutral types below, so a later migration to
 * an own review store is a one-off CSV import plus a rewrite of this file.
 *
 * Two data paths:
 *
 * 1. Aggregates (stars + count in the buy area, AggregateRating JSON-LD):
 *    Judge.me syncs the standard `reviews.rating` / `reviews.rating_count`
 *    product metafields into Shopify; the PDP Storefront query reads them
 *    and `parseReviewAggregate` below normalises the metafield strings.
 *    No Judge.me API call involved.
 *
 * 2. Full review bodies (the PDP reviews chapter): server-side GET from
 *    the Judge.me REST API in the deferred half of the PDP loader.
 *
 * Degrade-soft rule: with JUDGEME_PRIVATE_TOKEN or
 * PUBLIC_JUDGEME_SHOP_DOMAIN unset, `reviewsEnabled` is false, the fetch
 * resolves null, and the PDP renders exactly as if the feature did not
 * exist — no logs, no placeholders. Fetch/API failures also resolve null
 * (never throw): the reviews chapter then shows the metafield aggregate
 * only, and Judge.me latency or downtime can never break a product page.
 *
 * Review submission is deliberately absent: Judge.me's post-delivery
 * request emails collect reviews. A first-party form can come later as a
 * POST /reviews action that calls the Judge.me create endpoint from here.
 */

const JUDGEME_API = 'https://api.judge.me/api/v1';

/** How many reviews the PDP chapter shows at most. */
export const MAX_REVIEWS_SHOWN = 10;

export type ReviewsEnv = {
  JUDGEME_PRIVATE_TOKEN?: string;
  PUBLIC_JUDGEME_SHOP_DOMAIN?: string;
};

/** Provider-neutral review shape — the only thing the UI ever sees. */
export type ProductReview = {
  id: number;
  /** Display name; falls back to "Anonymous" when the provider has none. */
  reviewer: string;
  /** 1..5 integer. */
  rating: number;
  title: string | null;
  /** May be empty — star-only ratings are legitimate. */
  body: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** True when the provider matched the review to a real order. */
  verified: boolean;
};

/** Normalised star aggregate parsed from the synced product metafields. */
export type ReviewAggregate = {
  /** Average rating on a 1..5 scale, e.g. 4.8. */
  value: number;
  /** Number of ratings behind the average — always >= 1. */
  count: number;
};

export function reviewsEnabled(env: ReviewsEnv): boolean {
  return Boolean(env.JUDGEME_PRIVATE_TOKEN && env.PUBLIC_JUDGEME_SHOP_DOMAIN);
}

/**
 * Parse the `reviews.rating` / `reviews.rating_count` metafield values.
 * The rating metafield is Shopify's `rating` type — a JSON string like
 * `{"scale_min":"1.0","scale_max":"5.0","value":"4.85"}` — but a plain
 * numeric string is tolerated too. Returns null unless both parse and
 * count >= 1, so a product with zero reviews renders nothing at all.
 */
export function parseReviewAggregate(
  ratingValue?: string | null,
  countValue?: string | null,
): ReviewAggregate | null {
  if (!ratingValue || !countValue) return null;

  const count = Number.parseInt(countValue, 10);
  if (!Number.isFinite(count) || count < 1) return null;

  let raw: unknown = ratingValue;
  try {
    const parsed: unknown = JSON.parse(ratingValue);
    if (parsed && typeof parsed === 'object' && 'value' in parsed) {
      raw = (parsed as {value: unknown}).value;
    } else {
      raw = parsed;
    }
  } catch {
    // Plain numeric string — use as-is.
  }
  const value = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(value) || value <= 0) return null;

  // Clamp to the 5-star scale and keep two decimals of precision.
  return {value: Math.min(5, Math.round(value * 100) / 100), count};
}

/** Raw Judge.me review — every field optional, the API is not ours. */
type JudgeMeReview = {
  id?: number;
  title?: string | null;
  body?: string | null;
  rating?: number;
  reviewer?: {name?: string | null} | null;
  created_at?: string;
  updated_at?: string;
  hidden?: boolean;
  published?: boolean;
  curated?: string;
  /** "buyer" when Judge.me matched the review to an order. */
  verified?: string;
};

/**
 * Fetch the newest published reviews for a product handle, capped at
 * `MAX_REVIEWS_SHOWN`. Resolves null when the feature is disabled (env
 * unset) or the API is unreachable/unparseable — never throws, never
 * logs, so it is safe to hand straight to the deferred loader path.
 */
export async function fetchProductReviews(
  env: ReviewsEnv,
  productHandle: string,
): Promise<ProductReview[] | null> {
  if (!reviewsEnabled(env)) return null;

  const params = new URLSearchParams({
    api_token: env.JUDGEME_PRIVATE_TOKEN!,
    shop_domain: env.PUBLIC_JUDGEME_SHOP_DOMAIN!,
    handle: productHandle,
    per_page: String(MAX_REVIEWS_SHOWN),
    page: '1',
  });

  try {
    const res = await fetch(`${JUDGEME_API}/reviews?${params.toString()}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {reviews?: JudgeMeReview[]} | null;
    if (!json || !Array.isArray(json.reviews)) return null;
    return normalizeReviews(json.reviews);
  } catch {
    // Timeout, network failure, malformed JSON — degrade to aggregate-only.
    return null;
  }
}

/**
 * Filter to displayable reviews and map to the provider-neutral shape.
 * Exported for tests; pure.
 */
export function normalizeReviews(raw: JudgeMeReview[]): ProductReview[] {
  return raw
    .filter(
      (r) =>
        typeof r.id === 'number' &&
        typeof r.rating === 'number' &&
        r.rating >= 1 &&
        r.rating <= 5 &&
        // The private token can return unpublished/hidden/spam entries —
        // only ever render what Judge.me's own widget would show.
        r.hidden !== true &&
        r.published !== false &&
        r.curated !== 'spam',
    )
    .map((r) => ({
      id: r.id!,
      reviewer: r.reviewer?.name?.trim() || 'Anonymous',
      rating: Math.round(r.rating!),
      title: r.title?.trim() || null,
      body: r.body?.trim() ?? '',
      createdAt: r.created_at ?? '',
      verified: r.verified === 'buyer',
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, MAX_REVIEWS_SHOWN);
}
