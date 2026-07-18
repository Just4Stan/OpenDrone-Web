/**
 * Back-in-stock notify — turns an authenticated inventory_levels/update
 * webhook delivery into ONE Resend broadcast to the `notify-<handle>`
 * segment (the same segment every PDP notify signup lands in).
 *
 * Pipeline (all best-effort, everything degrades to warn + no-op):
 *
 *   inventory_levels/update (available > 0)
 *     → Admin API: inventory_item_id → owning product (handle/title/status)
 *     → guards: product ACTIVE, not coming-soon (the launch-blast flow
 *       owns comms while a product is still notify-at-launch)
 *     → cooldown latch `bis:<handle>` (SET NX EX, 7 days) so a restock
 *       that flaps in and out of stock cannot re-blast the segment
 *     → Resend broadcast to notify-<handle> (send: true)
 *
 * The latch is released when the broadcast fails, so a Shopify webhook
 * redelivery retries cleanly. When Upstash is unconfigured the latch
 * cannot arbitrate — we SKIP rather than risk double-blasting a
 * marketing email (opposite default from the ledger writers, where a
 * dropped record is the cheaper failure).
 *
 * Registration (manual, Dev Dashboard custom app, same receiver):
 *   POST https://opendrone.store/api/webhooks/shopify
 *   topic: inventory_levels/update — token needs read_products.
 */

import {isComingSoon} from '~/lib/product-content';
import {comingSoonFlag} from '~/lib/coming-soon';
import {adminApiAvailable, resolveInventoryItemProduct} from '~/lib/shopify-admin';
import {sendBackInStockBroadcast} from '~/lib/growth/resend';
import {deleteKey, setIfAbsentTtl, type UpstashEnv} from '~/lib/support/upstash';

const COOLDOWN_SECONDS = 7 * 24 * 60 * 60;
// extractRestock (payload parsing) lives in shopify-webhook.ts next to
// the other webhook parsing + its unit tests; this module is the part
// with side effects.

// Derive the admin/marketing env shapes from the helpers themselves so
// this module can never drift from what they actually need.
type BackInStockEnv = UpstashEnv &
  Parameters<typeof resolveInventoryItemProduct>[0] &
  Parameters<typeof sendBackInStockBroadcast>[0] & {
    PUBLIC_COMING_SOON?: string;
  };

/**
 * Full handler, run in waitUntil after the webhook is ACKed. Never
 * throws.
 */
export async function handleRestock(
  env: BackInStockEnv,
  restock: {inventoryItemId: string; available: number},
): Promise<void> {
  try {
    if (!adminApiAvailable(env)) {
      console.warn('[growth/bis] admin token unset — restock notify skipped');
      return;
    }
    const product = await resolveInventoryItemProduct(
      env,
      restock.inventoryItemId,
    );
    if (!product) return;
    if (product.status !== 'ACTIVE') return;
    if (isComingSoon(product.handle, comingSoonFlag(env))) {
      // Pre-launch products: interest is answered by the launch blast,
      // not a restock mail.
      return;
    }

    const latchKey = `bis:${product.handle}`;
    const claimed = await setIfAbsentTtl(
      env,
      latchKey,
      String(Math.floor(Date.now() / 1000)),
      COOLDOWN_SECONDS,
    );
    if (claimed === null) {
      console.warn('[growth/bis] Upstash unconfigured — restock notify skipped');
      return;
    }
    if (!claimed) return; // notified within the cooldown window

    const sent = await sendBackInStockBroadcast(env, {
      productHandle: product.handle,
      productTitle: product.title,
    });
    if (!sent) {
      // Free the latch so a webhook redelivery can retry the send.
      await deleteKey(env, latchKey);
    }
  } catch (err) {
    console.warn('[growth/bis] handleRestock failed', err);
  }
}
