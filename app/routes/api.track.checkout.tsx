import type {Route} from './+types/api.track.checkout';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';
import {globalRateLimit} from '~/lib/support/upstash';
import {recordCheckoutClick} from '~/lib/growth/ledger';
import {PLAUSIBLE_DOMAIN} from '~/lib/growth/plausible-server';

/**
 * Checkout-click beacon: bumps the growth ledger's `chk:<day>` counter
 * (app/lib/growth/ledger.ts) so buy-rate = orders / checkout clicks is
 * computable server-side, with no Plausible Business subscription. Fired
 * from the cart's Checkout CTA via navigator.sendBeacon (CartSummary),
 * alongside the client-side Plausible `Checkout Click` event.
 *
 * Not an analytics identifier in any sense: no body is read, nothing
 * about the visitor is stored, the counter is a single site-wide integer
 * per UTC day. Privacy posture unchanged.
 *
 * Abuse posture: this can only inflate a vanity denominator, so it fails
 * SILENT (always 204, nothing to probe) and is bounded twice: per-IP
 * in-memory (a real buyer clicks checkout a handful of times) and a
 * global Upstash-backed cap so a distributed flood cannot poison the
 * counter from many isolates. The IP is used for the in-memory limit
 * only and never persisted. Host guard: only the production host counts,
 * so dev/preview clicks never pollute the real numbers (mirrors the
 * Purchase-event guard in api.webhooks.shopify.tsx).
 *
 * POST-only; the loader 404s like the other api.* routes.
 */

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return new Response(null, {status: 405});
  }
  // Fire-and-forget contract: the client never reads this response, and
  // an attacker gets nothing to distinguish counted from dropped.
  const done = new Response(null, {status: 204});

  if (new URL(request.url).hostname !== PLAUSIBLE_DOMAIN) {
    return done;
  }
  const ip = clientIp(request);
  if (!checkRateLimit(`trkchk:ip:${ip}`, 10, 10 * 60 * 1000).allowed) {
    return done;
  }
  // Global hourly cap, shared across isolates. Null (Upstash missing or
  // erroring) falls through: recordCheckoutClick no-ops in that case too.
  const global = await globalRateLimit(context.env, 'trk-checkout', 600, 3600);
  if (global && !global.allowed) {
    return done;
  }

  const write = recordCheckoutClick(context.env).then((count) => {
    if (count === null) {
      console.warn('[track/checkout] counter increment dropped');
    }
  });
  if (context.waitUntil) {
    context.waitUntil(write);
  } else {
    await write;
  }
  return done;
}

export function loader() {
  return new Response(null, {status: 404});
}
