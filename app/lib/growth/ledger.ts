/**
 * Growth ledger — the durable record behind per-channel conversion and
 * AOV numbers. Thin layer over the Upstash REST helpers in
 * app/lib/support/upstash.ts (imported, not duplicated); this module is
 * the SINGLE OWNER of the growth key shapes. Lanes B (email) and C
 * (reserve flow) extend this file — add key shapes to the docs block
 * below, don't invent keys elsewhere.
 *
 * docs: key shapes
 * ----------------------------------------------------------------------
 * ord:<order_id>   JSON `AttributedOrder` (below). One per Shopify
 *                  orders/create webhook delivery; order_id is Shopify's
 *                  numeric order id, so redelivered webhooks overwrite
 *                  idempotently rather than duplicate. No TTL.
 *                  RtbF: DEL — the order itself lives in Shopify; this
 *                  record is only the attribution join.
 *
 * sig:<email>      RESERVED for Lane B — signup/profile record
 *                  {email, consentAt, product, locale, channel,
 *                   reserveIntent?, euPremium?, interviewOptIn?}.
 *                  No TTL; RtbF = DEL.
 *
 * att:idx          Append-only export index: a Redis list (LPUSH, newest
 *                  first, LTRIM-capped at 5000) of ledger keys written,
 *                  e.g. "ord:6234098751". Export/reconciliation scripts
 *                  walk this instead of SCANning the keyspace.
 *
 * GDPR: never store IPs or user agents here. Attribution values are the
 * visitor's own session-scoped UTM tags, allowlisted + capped at 64
 * chars upstream (app/routes/cart.tsx). Retention: flag any new key
 * shape for the privacy-policy processor table (legal task 18-jul).
 * ----------------------------------------------------------------------
 *
 * All functions are null-safe when Upstash is unconfigured: no-op +
 * console.warn, matching the repo's degrade-soft pattern.
 */

import {
  getTicketStore,
  listPush,
  type UpstashEnv,
} from '~/lib/support/upstash';

export type OrderLineItem = {
  sku: string;
  qty: number;
  title?: string;
};

/** First-touch attribution as it arrived on the order's custom attributes. */
export type OrderAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing?: string;
};

export type AttributedOrder = {
  /** Shopify numeric order id, stringified. */
  id: string;
  /** Order total in major units (e.g. euros). */
  total: number;
  /** ISO 4217, e.g. 'EUR'. */
  currency: string;
  items: OrderLineItem[];
  attribution: OrderAttribution;
  /** Shopify order created_at (ISO 8601). */
  createdAt: string;
  /** Webhook arrival, unix seconds. */
  receivedAt: number;
};

const INDEX_KEY = 'att:idx';
const INDEX_CAP = 5000;

/** Persist an attributed order (`ord:<id>`) and append it to `att:idx`. */
export async function recordOrder(
  env: UpstashEnv,
  order: AttributedOrder,
): Promise<void> {
  const store = getTicketStore(env);
  if (!store) {
    console.warn(
      '[growth/ledger] Upstash not configured — order record dropped',
      order.id,
    );
    return;
  }
  const key = `ord:${order.id}`;
  await store.put(key, JSON.stringify(order));
  const indexed = await listPush(env, INDEX_KEY, key, INDEX_CAP);
  if (!indexed) {
    console.warn('[growth/ledger] att:idx append failed for', key);
  }
}

/** Read one attributed order back, or null (missing / unconfigured). */
export async function getOrder(
  env: UpstashEnv,
  orderId: string,
): Promise<AttributedOrder | null> {
  const store = getTicketStore(env);
  if (!store) return null;
  const raw = await store.get(`ord:${orderId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttributedOrder;
  } catch {
    return null;
  }
}
