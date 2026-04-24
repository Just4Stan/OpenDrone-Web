import type {Route} from './+types/api.$version.[graphql.json]';

// Thin proxy used by Shopify Checkout Kit / Buy SDK to POST GraphQL
// mutations to the checkout domain from the browser. We can't call the
// checkout API directly from the client (CORS + cookie scoping), so
// requests route through this worker endpoint.
//
// Hardening: cap request body at 256 KB, 10-second upstream timeout,
// validate the API version segment so a malicious `$version` can't
// path-traverse the upstream URL, and filter response headers so we
// don't leak upstream server fingerprinting / cache keys back to the
// browser.

const MAX_BODY_BYTES = 256 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;
const VERSION_RE = /^20\d{2}-\d{2}$|^unstable$/;
const ALLOWED_RESPONSE_HEADERS = new Set([
  'content-type',
  'content-length',
  'cache-control',
  'vary',
  'x-request-id',
]);

export async function action({params, context, request}: Route.ActionArgs) {
  const version = params.version ?? '';
  if (!VERSION_RE.test(version)) {
    return new Response('Invalid API version', {status: 400});
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) {
    return new Response('Request body too large', {status: 413});
  }

  const forwardHeaders = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) forwardHeaders.set('content-type', contentType);

  const checkoutDomain = context.env.PUBLIC_CHECKOUT_DOMAIN;
  if (!checkoutDomain) {
    return new Response('Checkout proxy not configured', {status: 503});
  }

  try {
    const response = await fetch(
      `https://${checkoutDomain}/api/${version}/graphql.json`,
      {
        method: 'POST',
        body: request.body,
        headers: forwardHeaders,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );

    const cleanHeaders = new Headers();
    response.headers.forEach((value, name) => {
      if (ALLOWED_RESPONSE_HEADERS.has(name.toLowerCase())) {
        cleanHeaders.set(name, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: cleanHeaders,
    });
  } catch (err) {
    console.warn('[checkout-proxy] upstream failed', err instanceof Error ? err.name : 'unknown');
    return new Response('Upstream unavailable', {status: 502});
  }
}
