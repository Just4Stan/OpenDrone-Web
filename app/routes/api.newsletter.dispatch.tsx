import {data} from 'react-router';
import type {Route} from './+types/api.newsletter.dispatch';
import {dispatchArticle} from '~/lib/newsletter/dispatch';
import {verifyShopifyWebhook} from '~/lib/newsletter/webhook-hmac';

/**
 * Auto-dispatch endpoint for newsletter sends.
 *
 * Two trigger modes:
 *
 *  1. Shopify webhook: `articles/update` topic, format JSON. Inbound
 *     `X-Shopify-Hmac-Sha256` is verified against SHOPIFY_WEBHOOK_SECRET
 *     using the raw request body. The article id (number) is taken from
 *     the JSON payload's `admin_graphql_api_id` field.
 *
 *  2. Manual trigger (CLI / admin one-shot): `Authorization: Bearer
 *     <NEWSLETTER_DISPATCH_SECRET>` plus `?article=<gid>` query string,
 *     and optional `?force=1` to bypass the dispatched-at metafield
 *     check. Useful for re-sending after a bad initial send or for
 *     testing without round-tripping through Shopify admin.
 *
 * Both paths run the same `dispatchArticle()` orchestrator. Returns 200
 * even on `skipped` so Shopify doesn't keep retrying a no-op.
 *
 * Long sends are kicked into `waitUntil` so the webhook receiver
 * acknowledges within Shopify's 5-second window.
 */

type DispatchResponse = {
  ok: boolean;
  status: 'sent' | 'skipped' | 'error' | 'queued';
  reason?: string;
  recipientCount?: number;
  batches?: number;
};

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<DispatchResponse>(
      {ok: false, status: 'error', reason: 'method not allowed'},
      {status: 405},
    );
  }

  const env = context.env;
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';

  // --- Auth ---------------------------------------------------------
  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
  const authHeader = request.headers.get('Authorization');
  const rawBody = await request.text();

  let articleGid: string | null = null;

  if (hmacHeader) {
    if (!env.SHOPIFY_WEBHOOK_SECRET) {
      console.warn('[newsletter/dispatch] webhook hit but secret unset');
      return data<DispatchResponse>(
        {ok: false, status: 'error', reason: 'webhook secret not configured'},
        {status: 503},
      );
    }
    const ok = await verifyShopifyWebhook(
      env.SHOPIFY_WEBHOOK_SECRET,
      rawBody,
      hmacHeader,
    );
    if (!ok) {
      console.warn('[newsletter/dispatch] webhook hmac mismatch');
      return data<DispatchResponse>(
        {ok: false, status: 'error', reason: 'invalid signature'},
        {status: 401},
      );
    }
    try {
      const payload = JSON.parse(rawBody) as {
        admin_graphql_api_id?: string;
        id?: number | string;
      };
      articleGid =
        payload.admin_graphql_api_id ??
        (payload.id ? `gid://shopify/Article/${payload.id}` : null);
    } catch {
      return data<DispatchResponse>(
        {ok: false, status: 'error', reason: 'invalid json payload'},
        {status: 400},
      );
    }
  } else if (authHeader) {
    if (!env.NEWSLETTER_DISPATCH_SECRET) {
      return data<DispatchResponse>(
        {ok: false, status: 'error', reason: 'manual trigger not configured'},
        {status: 503},
      );
    }
    const expected = `Bearer ${env.NEWSLETTER_DISPATCH_SECRET}`;
    if (!constantTimeEqual(authHeader, expected)) {
      return data<DispatchResponse>(
        {ok: false, status: 'error', reason: 'unauthorized'},
        {status: 401},
      );
    }
    const articleParam = url.searchParams.get('article');
    if (!articleParam) {
      return data<DispatchResponse>(
        {ok: false, status: 'error', reason: 'article query param required'},
        {status: 400},
      );
    }
    articleGid = articleParam.startsWith('gid://')
      ? articleParam
      : `gid://shopify/Article/${articleParam}`;
  } else {
    return data<DispatchResponse>(
      {ok: false, status: 'error', reason: 'authentication required'},
      {status: 401},
    );
  }

  if (!articleGid) {
    return data<DispatchResponse>(
      {ok: false, status: 'error', reason: 'could not resolve article id'},
      {status: 400},
    );
  }

  // --- Best-effort dedup --------------------------------------------
  // Shopify retries failed webhooks for ~48h. The article metafield
  // dedups across that window, but two retries fired close together
  // (before the first marks the article) can race. KV gives us a
  // ~minute-grained guard. Optional binding — degrades to metafield-only
  // dedup if NEWSLETTER_DISPATCH_KV isn't bound.
  const dedupKey = `dispatch:${articleGid}`;
  if (!force && env.NEWSLETTER_DISPATCH_KV) {
    const existing = await env.NEWSLETTER_DISPATCH_KV.get(dedupKey);
    if (existing) {
      return data<DispatchResponse>({
        ok: true,
        status: 'skipped',
        reason: 'dedup hit',
      });
    }
    await env.NEWSLETTER_DISPATCH_KV.put(dedupKey, '1', {
      expirationTtl: 60 * 60 * 24 * 30,
    });
  }

  const siteOrigin = `${url.protocol}//${url.host}`;

  // --- Dispatch -----------------------------------------------------
  // Shopify webhook clients want a fast 200. Real send work runs in
  // waitUntil so the response returns immediately. The metafield write
  // inside dispatchArticle() makes any redelivery a no-op.
  const sendJob = dispatchArticle(env, articleGid, {force, siteOrigin})
    .then((result) => {
      console.log(
        '[newsletter/dispatch]',
        articleGid,
        result.status,
        'reason' in result ? result.reason : '',
        'recipientCount' in result ? result.recipientCount : '',
      );
    })
    .catch((err) => {
      console.error('[newsletter/dispatch] crashed', err);
    });

  if (context.waitUntil) {
    context.waitUntil(sendJob);
  } else {
    void sendJob;
  }

  return data<DispatchResponse>(
    {ok: true, status: 'queued'},
    {status: 202, headers: {'Cache-Control': 'no-store'}},
  );
}

export function loader() {
  return new Response(null, {status: 404});
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
