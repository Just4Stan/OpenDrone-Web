/**
 * Shopify webhook signature verification.
 *
 * Shopify signs every webhook delivery with
 * `X-Shopify-Hmac-Sha256: base64(HMAC-SHA256(secret, raw_body))`.
 * Verification MUST run over the raw request body bytes, before any
 * JSON parsing. WebCrypto only — this runs on Oxygen/workerd.
 *
 * Uses a length-leaking but content-constant comparison (mirrors
 * constantTimeEqual in app/lib/support/session.ts; duplicated here so
 * this module stays dependency-free for `node --test`). Length leakage
 * is harmless: a SHA-256 base64 digest is always 44 chars.
 */

/**
 * Order topics the /api/webhooks/shopify receiver records.
 * `orders/paid` is the primary registration (payment captured — the
 * number CAC/AOV wants); `orders/create` is also accepted because the
 * ledger write is idempotent on order id, so registering both (or a
 * historical create-only registration) can't double-count.
 */
export const ORDER_TOPICS: ReadonlySet<string> = new Set([
  'orders/paid',
  'orders/create',
]);

/** Inventory topic handled by the same receiver (back-in-stock notify). */
export const INVENTORY_LEVEL_TOPIC = 'inventory_levels/update';

/**
 * Parse an inventory_levels/update payload down to what back-in-stock
 * acts on. Returns null for payloads to ignore: missing item id, or not
 * a restock (`available` zero, negative, or absent — Shopify sends null
 * for untracked inventory).
 */
export function extractRestock(payload: unknown): {
  inventoryItemId: string;
  available: number;
} | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as {inventory_item_id?: unknown; available?: unknown};
  const id =
    typeof p.inventory_item_id === 'number' ||
    typeof p.inventory_item_id === 'string'
      ? String(p.inventory_item_id)
      : '';
  const available = typeof p.available === 'number' ? p.available : NaN;
  if (!id || !Number.isFinite(available) || available <= 0) return null;
  return {inventoryItemId: id, available};
}

/** Un-prefixed attribution shape stored in the ledger (matches
 *  OrderAttribution in app/lib/growth/ledger.ts; kept structural here so
 *  this module stays dependency-free for `node --test`). */
export type ExtractedAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing?: string;
};

// note_attributes arrive with the hiding `_` prefix (cart attributes
// prefixed with `_` are invisible to the customer at checkout but still
// copy into order note_attributes — see app/routes/cart.tsx). The ledger
// stores them un-prefixed. Legacy un-prefixed names are still accepted
// for any order placed before the prefix change.
const ATTRIBUTION_KEY_MAP: Record<string, keyof ExtractedAttribution> = {
  _utm_source: 'utm_source',
  _utm_medium: 'utm_medium',
  _utm_campaign: 'utm_campaign',
  _landing: 'landing',
  utm_source: 'utm_source',
  utm_medium: 'utm_medium',
  utm_campaign: 'utm_campaign',
  landing: 'landing',
};

const ATTRIBUTION_VALUE_MAX = 64;

/** Map a Shopify order's note_attributes to the ledger's un-prefixed
 *  attribution record. Unknown keys are dropped, values capped. */
export function extractOrderAttribution(
  noteAttributes:
    | Array<{name?: string; value?: string} | null | undefined>
    | null
    | undefined,
): ExtractedAttribution {
  const attribution: ExtractedAttribution = {};
  for (const attr of noteAttributes ?? []) {
    const target = attr?.name ? ATTRIBUTION_KEY_MAP[attr.name] : undefined;
    if (target && typeof attr?.value === 'string') {
      attribution[target] = attr.value.slice(0, ATTRIBUTION_VALUE_MAX);
    }
  }
  return attribution;
}

export async function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!hmacHeader || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const expected = btoa(bin);
  return constantTimeEqualLocal(expected, hmacHeader);
}

function constantTimeEqualLocal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
