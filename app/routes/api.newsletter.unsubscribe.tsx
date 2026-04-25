import {redirect} from 'react-router';
import type {Route} from './+types/api.newsletter.unsubscribe';
import {unsubscribeCustomer} from '~/lib/newsletter/admin-api';
import {verifyUnsubscribeToken} from '~/lib/newsletter/unsubscribe-token';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';

/**
 * One-click unsubscribe. Same handler responds to:
 *  - GET  /api/newsletter/unsubscribe?t=<token>  (regular link click)
 *  - POST /api/newsletter/unsubscribe?t=<token>  (RFC 8058 one-click,
 *                                                 fired by Gmail/Yahoo
 *                                                 List-Unsubscribe-Post)
 *
 * Token is HMAC-signed with NEWSLETTER_DISPATCH_SECRET and binds the
 * Shopify customer GID + email — leaking it lets someone unsubscribe
 * exactly one address. Always returns 200 / redirect even on failure
 * so we don't leak which tokens are valid; failed attempts are logged
 * server-side and rate-limited per IP.
 */

const UNSUB_CONFIRMED_PATH = '/newsletter/unsubscribed';

export async function action({request, context}: Route.ActionArgs) {
  return handle(request, context);
}

export async function loader({request, context}: Route.LoaderArgs) {
  return handle(request, context);
}

async function handle(
  request: Request,
  context: Route.LoaderArgs['context'],
): Promise<Response> {
  const env = context.env;
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const isOneClickPost =
    request.method === 'POST' &&
    request.headers.get('Content-Type')?.includes('application/x-www-form-urlencoded');

  const ip = clientIp(request);
  const limit = checkRateLimit(`unsub:${ip}`, 30, 60 * 60 * 1000);
  if (!limit.allowed) {
    return new Response(null, {
      status: 429,
      headers: {'Retry-After': String(limit.resetInSeconds)},
    });
  }

  // Always show the confirmation page on GET, even on token failure —
  // we don't want to leak which tokens validate. Failed unsubscribes
  // are logged for ops.
  const goConfirm = () =>
    isOneClickPost
      ? new Response(null, {status: 200})
      : redirect(UNSUB_CONFIRMED_PATH);

  const payload = await verifyUnsubscribeToken(env, token);
  if (!payload) {
    console.warn('[newsletter/unsubscribe] bad or expired token', {ip});
    return goConfirm();
  }

  if (!env.SHOPIFY_ADMIN_API_TOKEN) {
    console.error('[newsletter/unsubscribe] SHOPIFY_ADMIN_API_TOKEN unset');
    return goConfirm();
  }

  try {
    const result = await unsubscribeCustomer(env, payload.cid);
    if (!result.ok) {
      console.warn(
        '[newsletter/unsubscribe] admin api error',
        result.error?.slice(0, 200),
      );
    }
  } catch (err) {
    console.error('[newsletter/unsubscribe] crashed', err);
  }

  return goConfirm();
}
