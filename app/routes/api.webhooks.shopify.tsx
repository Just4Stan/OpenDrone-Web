import type {Route} from './+types/api.webhooks.shopify';
import {
  extractOrderAttribution,
  ORDER_TOPICS,
  verifyShopifyHmac,
} from '~/lib/growth/shopify-webhook';
import {
  claimPurchaseEvent,
  getOrder,
  latchPurchaseEvent,
  recordOrder,
  releasePurchaseEvent,
  type AttributedOrder,
} from '~/lib/growth/ledger';
import {
  PLAUSIBLE_DOMAIN,
  sendPurchaseEvent,
} from '~/lib/growth/plausible-server';

// Shopify webhook receiver. Handles order topics:
//
//   orders/paid (primary — payment captured, the number CAC/AOV wants)
//   orders/create (accepted too; recordOrder is idempotent on order id)
//   → attributed-order record in the growth ledger
//   (app/lib/growth/ledger.ts, key ord:<order_id>). The order's
//   note_attributes carry the first-touch UTM tags promoted from the cart
//   as hidden `_`-prefixed attributes (see app/routes/cart.tsx
//   AttributesUpdateInput), closing the per-channel funnel:
//   visit → signup → add-to-cart → checkout → paid.
//
// Registration is manual, via a Dev Dashboard custom app (legacy admin
// custom apps closed 2026-01):
//   POST https://opendrone.store/api/webhooks/shopify
//   topic: orders/paid, format: JSON
//   The custom app needs the read_orders scope.
//
// Basic-plan caveat: Shopify redacts Level-2 protected customer data
// (name/email/address) from webhook payloads on Basic — order id, totals,
// line items, and note_attributes survive, which is all we need. Buyer
// email joins happen later via our own signup records (sig:<email>).
//
// Auth: X-Shopify-Hmac-Sha256 = base64(HMAC-SHA256(secret, raw body)),
// verified over the RAW body before parsing (app/lib/growth/
// shopify-webhook.ts). 401 on bad HMAC, 503 when SHOPIFY_WEBHOOK_SECRET
// is unset. On valid HMAC we ACK 200 immediately and do the ledger
// write in waitUntil — Shopify retries (and eventually drops the
// subscription) when deliveries are slow or non-2xx.
//
// Modeled on api.support.cleanup.tsx: POST-only, loader 404s.

type ShopifyNoteAttribute = {name?: string; value?: string};
type ShopifyLineItem = {sku?: string; quantity?: number; title?: string};
type ShopifyOrderPayload = {
  id?: number | string;
  total_price?: string;
  currency?: string;
  created_at?: string;
  line_items?: ShopifyLineItem[];
  note_attributes?: ShopifyNoteAttribute[];
};

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed.', {status: 405});
  }
  const secret = context.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response('Webhook receiver not configured.', {status: 503});
  }

  // RAW body first — the HMAC covers these exact bytes.
  const rawBody = await request.text();
  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
  const valid = await verifyShopifyHmac(rawBody, hmacHeader, secret);
  if (!valid) {
    return new Response('Invalid signature.', {status: 401});
  }

  const topic = request.headers.get('X-Shopify-Topic') ?? '';
  // Unknown topics are ACKed: they're authenticated (HMAC passed) and a
  // non-2xx would only make Shopify retry a delivery we'll never handle.
  if (!ORDER_TOPICS.has(topic)) {
    return new Response('OK (topic ignored)', {status: 200});
  }

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrderPayload;
  } catch {
    // Authenticated but malformed — ACK so Shopify doesn't retry a body
    // that will never parse.
    console.warn(`[webhooks/shopify] unparseable ${topic} body`);
    return new Response('OK (unparseable)', {status: 200});
  }

  const orderId = payload.id != null ? String(payload.id) : '';
  if (!orderId) {
    console.warn(`[webhooks/shopify] ${topic} without id — dropped`);
    return new Response('OK (no id)', {status: 200});
  }

  // `_utm_*` note_attributes → un-prefixed ledger attribution (mapping +
  // 64-char cap live in app/lib/growth/shopify-webhook.ts, unit-tested).
  const attribution: AttributedOrder['attribution'] = extractOrderAttribution(
    payload.note_attributes,
  );

  const order: AttributedOrder = {
    id: orderId,
    total: Number.parseFloat(payload.total_price ?? '') || 0,
    currency: payload.currency ?? 'EUR',
    items: (payload.line_items ?? []).map((li) => ({
      sku: li?.sku || 'unknown',
      qty: li?.quantity ?? 1,
      title: li?.title,
    })),
    attribution,
    createdAt: payload.created_at ?? new Date().toISOString(),
    receivedAt: Math.floor(Date.now() / 1000),
  };

  // ACK fast; everything below runs in the background. recordOrder
  // degrades to a no-op warn when Upstash is unconfigured.
  //
  // Server-side funnel close: the buyer paid on Shopify's domain where no
  // client event can fire, so this is where the Plausible `Purchase`
  // event (with revenue + first-touch channel) comes from. Rules:
  //
  // - Ledger write FIRST. The ord: record is the production-critical
  //   part, and Shopify never retries a delivery we ACKed; it must not
  //   sit behind a Plausible round-trip that could stall or exhaust the
  //   waitUntil budget (the send also carries its own 5s timeout).
  // - orders/paid ONLY. orders/create can precede payment (pending
  //   payment methods); it still records the order above but is never a
  //   Purchase.
  // - Dedupe is an atomic SETNX claim (`pev:<order_id>`) plus the
  //   `purchaseEventAt` field stamped on the ord: record once Plausible
  //   accepts. A GET-check alone would double-send: redeliveries and the
  //   topic pair run concurrently in separate isolates. A failed send
  //   releases the claim so a redelivery retries. (If Upstash is
  //   unconfigured there is no claim and a redelivery could re-send;
  //   prod has Upstash, accepted.)
  // - Host guard: only the production host reports, so local/preview
  //   webhook tests never pollute the live dashboard.
  const isProdHost = new URL(request.url).hostname === PLAUSIBLE_DOMAIN;
  const write = (async () => {
    const existing = await getOrder(context.env, orderId);
    await recordOrder(context.env, {
      ...order,
      purchaseEventAt: existing?.purchaseEventAt,
    });

    if (topic !== 'orders/paid' || !isProdHost || existing?.purchaseEventAt) {
      return;
    }
    const claimed = await claimPurchaseEvent(context.env, orderId);
    if (claimed === false) return; // another delivery owns the send
    const accepted = await sendPurchaseEvent({
      total: order.total,
      currency: order.currency,
      source: attribution.utm_source,
      campaign: attribution.utm_campaign,
    });
    if (accepted) {
      await latchPurchaseEvent(
        context.env,
        orderId,
        Math.floor(Date.now() / 1000),
      );
    } else if (claimed) {
      await releasePurchaseEvent(context.env, orderId);
    }
  })().catch((err) =>
    console.warn('[webhooks/shopify] order processing failed', orderId, err),
  );
  if (context.waitUntil) {
    context.waitUntil(write);
  } else {
    await write;
  }

  return new Response('OK', {status: 200});
}

export function loader() {
  return new Response(null, {status: 404});
}
