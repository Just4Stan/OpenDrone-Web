import {describe, it, beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchProductReviews,
  normalizeReviews,
  parseReviewAggregate,
  reviewsEnabled,
  MAX_REVIEWS_SHOWN,
} from './reviews.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/reviews.test.ts

const ENV = {
  JUDGEME_PRIVATE_TOKEN: 'test-private-token',
  PUBLIC_JUDGEME_SHOP_DOMAIN: 'test-shop.myshopify.com',
};

describe('reviewsEnabled', () => {
  it('requires both env vars', () => {
    assert.equal(reviewsEnabled({}), false);
    assert.equal(reviewsEnabled({JUDGEME_PRIVATE_TOKEN: 'x'}), false);
    assert.equal(
      reviewsEnabled({PUBLIC_JUDGEME_SHOP_DOMAIN: 'x.myshopify.com'}),
      false,
    );
    assert.equal(reviewsEnabled(ENV), true);
  });
});

describe('parseReviewAggregate', () => {
  it('parses the Shopify rating-type JSON metafield', () => {
    const agg = parseReviewAggregate(
      '{"scale_min":"1.0","scale_max":"5.0","value":"4.85"}',
      '12',
    );
    assert.deepEqual(agg, {value: 4.85, count: 12});
  });

  it('tolerates a plain numeric rating string', () => {
    assert.deepEqual(parseReviewAggregate('4.5', '3'), {value: 4.5, count: 3});
  });

  it('returns null with zero count (coming-soon store must render nothing)', () => {
    assert.equal(parseReviewAggregate('{"value":"0.0"}', '0'), null);
    assert.equal(parseReviewAggregate('4.5', '0'), null);
  });

  it('returns null on missing or malformed values', () => {
    assert.equal(parseReviewAggregate(null, '5'), null);
    assert.equal(parseReviewAggregate('4.5', null), null);
    assert.equal(parseReviewAggregate('not-a-number', '5'), null);
    assert.equal(parseReviewAggregate('4.5', 'many'), null);
  });

  it('clamps to the 5-star scale', () => {
    assert.deepEqual(parseReviewAggregate('9.9', '2'), {value: 5, count: 2});
  });
});

describe('normalizeReviews', () => {
  const base = {
    id: 1,
    rating: 5,
    title: ' Great board ',
    body: ' Soldered clean, flew same day. ',
    reviewer: {name: ' Wout '},
    created_at: '2026-06-01T10:00:00.000Z',
    hidden: false,
    published: true,
    curated: 'ok',
    verified: 'buyer',
  };

  it('maps the Judge.me shape to the neutral shape', () => {
    const [r] = normalizeReviews([base]);
    assert.deepEqual(r, {
      id: 1,
      reviewer: 'Wout',
      rating: 5,
      title: 'Great board',
      body: 'Soldered clean, flew same day.',
      createdAt: '2026-06-01T10:00:00.000Z',
      verified: true,
    });
  });

  it('drops hidden, unpublished and spam entries', () => {
    const out = normalizeReviews([
      {...base, id: 2, hidden: true},
      {...base, id: 3, published: false},
      {...base, id: 4, curated: 'spam'},
      {...base, id: 5},
    ]);
    assert.deepEqual(
      out.map((r) => r.id),
      [5],
    );
  });

  it('drops entries without a usable id or rating', () => {
    const out = normalizeReviews([
      {...base, id: undefined},
      {...base, id: 6, rating: undefined},
      {...base, id: 7, rating: 0},
      {...base, id: 8, rating: 6},
    ]);
    assert.equal(out.length, 0);
  });

  it('marks non-buyer reviews unverified and anonymises missing names', () => {
    const [r] = normalizeReviews([
      {...base, verified: 'nothing', reviewer: {name: '  '}},
    ]);
    assert.equal(r.verified, false);
    assert.equal(r.reviewer, 'Anonymous');
  });

  it('sorts newest first and caps at MAX_REVIEWS_SHOWN', () => {
    const many = Array.from({length: 15}, (_, i) => ({
      ...base,
      id: i + 1,
      created_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    }));
    const out = normalizeReviews(many);
    assert.equal(out.length, MAX_REVIEWS_SHOWN);
    assert.equal(out[0].id, 15);
    assert.equal(out.at(-1)?.id, 6);
  });
});

describe('fetchProductReviews', () => {
  const realFetch = globalThis.fetch;
  let calls: string[] = [];
  let response: () => Promise<Response>;

  beforeEach(() => {
    calls = [];
    globalThis.fetch = ((input: RequestInfo | URL) => {
      calls.push(String(input));
      return response();
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('resolves null without fetching when env is absent', async () => {
    const out = await fetchProductReviews({}, 'openfc-lite');
    assert.equal(out, null);
    assert.equal(calls.length, 0);
  });

  it('calls the API with token, domain and handle', async () => {
    response = () =>
      Promise.resolve(
        new Response(JSON.stringify({reviews: []}), {status: 200}),
      );
    const out = await fetchProductReviews(ENV, 'openfc-lite');
    assert.deepEqual(out, []);
    assert.equal(calls.length, 1);
    const url = new URL(calls[0]);
    assert.equal(url.origin + url.pathname, 'https://api.judge.me/api/v1/reviews');
    assert.equal(url.searchParams.get('api_token'), ENV.JUDGEME_PRIVATE_TOKEN);
    assert.equal(
      url.searchParams.get('shop_domain'),
      ENV.PUBLIC_JUDGEME_SHOP_DOMAIN,
    );
    assert.equal(url.searchParams.get('handle'), 'openfc-lite');
    assert.equal(url.searchParams.get('per_page'), String(MAX_REVIEWS_SHOWN));
  });

  it('resolves null on HTTP errors instead of throwing', async () => {
    response = () => Promise.resolve(new Response('nope', {status: 401}));
    assert.equal(await fetchProductReviews(ENV, 'openfc-lite'), null);
  });

  it('resolves null on network failure instead of throwing', async () => {
    response = () => Promise.reject(new Error('ECONNREFUSED'));
    assert.equal(await fetchProductReviews(ENV, 'openfc-lite'), null);
  });

  it('resolves null on malformed JSON instead of throwing', async () => {
    response = () =>
      Promise.resolve(new Response('<html>challenge</html>', {status: 200}));
    assert.equal(await fetchProductReviews(ENV, 'openfc-lite'), null);
  });
});
