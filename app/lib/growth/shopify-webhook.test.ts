import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {
  extractOrderAttribution,
  ORDER_TOPICS,
  verifyShopifyHmac,
} from './shopify-webhook.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/growth/shopify-webhook.test.ts
//
// Cross-checks the WebCrypto implementation against node:crypto — the
// same base64(HMAC-SHA256) Shopify computes server-side.

const SECRET = 'shpss_test_webhook_secret';
const BODY = JSON.stringify({
  id: 6234098751,
  total_price: '79.00',
  currency: 'EUR',
  line_items: [{sku: 'OD-FC-LITE', quantity: 1}],
});

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

describe('verifyShopifyHmac', () => {
  it('accepts a valid signature', async () => {
    assert.equal(await verifyShopifyHmac(BODY, sign(BODY, SECRET), SECRET), true);
  });

  it('rejects a tampered body', async () => {
    const tampered = BODY.replace('79.00', '0.01');
    assert.equal(
      await verifyShopifyHmac(tampered, sign(BODY, SECRET), SECRET),
      false,
    );
  });

  it('rejects a signature made with the wrong secret', async () => {
    assert.equal(
      await verifyShopifyHmac(BODY, sign(BODY, 'wrong-secret'), SECRET),
      false,
    );
  });

  it('rejects a missing or empty header', async () => {
    assert.equal(await verifyShopifyHmac(BODY, null, SECRET), false);
    assert.equal(await verifyShopifyHmac(BODY, '', SECRET), false);
  });

  it('rejects when the secret is empty (unconfigured)', async () => {
    assert.equal(await verifyShopifyHmac(BODY, sign(BODY, SECRET), ''), false);
  });

  it('handles multi-byte UTF-8 bodies like node:crypto does', async () => {
    const utf8Body = JSON.stringify({note: 'bèta bestelling — dank u! 🛩️'});
    assert.equal(
      await verifyShopifyHmac(utf8Body, sign(utf8Body, SECRET), SECRET),
      true,
    );
  });
});

describe('ORDER_TOPICS', () => {
  it('handles orders/paid (primary) and orders/create (idempotent extra)', () => {
    assert.equal(ORDER_TOPICS.has('orders/paid'), true);
    assert.equal(ORDER_TOPICS.has('orders/create'), true);
  });

  it('ignores everything else', () => {
    for (const topic of [
      'orders/updated',
      'orders/cancelled',
      'refunds/create',
      'app/uninstalled',
      '',
    ]) {
      assert.equal(ORDER_TOPICS.has(topic), false, `should ignore ${topic}`);
    }
  });
});

describe('extractOrderAttribution', () => {
  it('maps hidden _-prefixed note_attributes to un-prefixed ledger keys', () => {
    assert.deepEqual(
      extractOrderAttribution([
        {name: '_utm_source', value: 'bardwell'},
        {name: '_utm_medium', value: 'video'},
        {name: '_utm_campaign', value: 'launch-openfc-lite'},
        {name: '_landing', value: '/products/openfc-lite'},
      ]),
      {
        utm_source: 'bardwell',
        utm_medium: 'video',
        utm_campaign: 'launch-openfc-lite',
        landing: '/products/openfc-lite',
      },
    );
  });

  it('still accepts legacy un-prefixed names (pre-prefix orders)', () => {
    assert.deepEqual(
      extractOrderAttribution([{name: 'utm_source', value: 'youtube'}]),
      {utm_source: 'youtube'},
    );
  });

  it('drops unknown keys and malformed entries', () => {
    assert.deepEqual(
      extractOrderAttribution([
        {name: 'gift_note', value: 'happy flying'},
        {name: '_utm_source'},
        {value: 'orphan'},
        null,
        undefined,
        {name: '_utm_medium', value: 'chat'},
      ]),
      {utm_medium: 'chat'},
    );
  });

  it('caps values at 64 chars', () => {
    const long = 'x'.repeat(200);
    const out = extractOrderAttribution([{name: '_utm_campaign', value: long}]);
    assert.equal(out.utm_campaign?.length, 64);
  });

  it('returns an empty record for missing note_attributes', () => {
    assert.deepEqual(extractOrderAttribution(undefined), {});
    assert.deepEqual(extractOrderAttribution(null), {});
    assert.deepEqual(extractOrderAttribution([]), {});
  });
});
