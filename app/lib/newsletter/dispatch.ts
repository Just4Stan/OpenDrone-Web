/**
 * Orchestrate one article → many subscribers send.
 *
 * Flow:
 *  1. Resolve the article via Storefront API (gets contentHtml/excerpt/
 *     image — Admin's `article` returns the body too but Storefront is
 *     lighter on rate limits and we already use it everywhere).
 *  2. Re-check status via Admin API: must be in NEWSLETTER_BLOG_HANDLE,
 *     must be published, must NOT have `dispatched_at` metafield set,
 *     must NOT have `no-newsletter` tag. Any of these short-circuits to
 *     a no-op (the webhook will fire on every edit; we only send once).
 *  3. Page through marketing-consented customers. For each batch (up to
 *     100), build per-recipient renderings with signed unsubscribe
 *     tokens, ship via Resend's `/emails/batch` endpoint.
 *  4. Mark the article dispatched (metafield write) so retries are
 *     no-ops. We only mark *after* the first batch lands successfully —
 *     a Resend outage on attempt 1 lets the webhook redelivery retry.
 *
 * Failure model: log per-batch errors, keep going. We never throw out
 * of the outer loop unless the Admin API fails outright. Partial sends
 * are recoverable via a manual re-dispatch (POST /api/newsletter.dispatch
 * with `?force=1` and a bearer secret).
 */

import {
  getArticleStatus,
  iterateSubscribers,
  markArticleDispatched,
  AdminApiError,
  type Subscriber,
} from './admin-api';
import {renderNewsletter} from './render';
import {
  buildUnsubscribeUrl,
  signUnsubscribeToken,
} from './unsubscribe-token';

const RESEND_BATCH_API = 'https://api.resend.com/emails/batch';
const RESEND_BATCH_SIZE = 100; // Resend's documented per-call cap
const RESEND_TIMEOUT_MS = 15000;

type Env = {
  PUBLIC_STORE_DOMAIN: string;
  PUBLIC_STOREFRONT_API_TOKEN: string;
  PRIVATE_STOREFRONT_API_TOKEN: string;
  SHOPIFY_ADMIN_API_TOKEN?: string;
  SHOPIFY_ADMIN_API_VERSION?: string;
  RESEND_API_KEY?: string;
  NEWSLETTER_FROM_EMAIL?: string;
  NEWSLETTER_BLOG_HANDLE?: string;
  NEWSLETTER_DISPATCH_SECRET?: string;
  PUBLIC_COMPANY_NAME?: string;
  PUBLIC_COMPANY_ADDRESS?: string;
  PUBLIC_COMPANY_KBO?: string;
  PUBLIC_COMPANY_VAT?: string;
};

export type DispatchResult =
  | {status: 'sent'; recipientCount: number; batches: number}
  | {status: 'skipped'; reason: string}
  | {status: 'error'; reason: string};

export type DispatchOptions = {
  force?: boolean; // skip dedup check (manual re-dispatch)
  siteOrigin: string; // used in email links + unsubscribe URL
};

const ARTICLE_BODY_QUERY = `#graphql
  query NewsletterArticleBody($blogHandle: String!, $articleHandle: String!) {
    blog(handle: $blogHandle) {
      handle
      articleByHandle(handle: $articleHandle) {
        handle
        title
        publishedAt
        contentHtml
        excerpt
        tags
        image { url altText }
      }
    }
  }
`;

type StorefrontArticle = {
  handle: string;
  title: string;
  publishedAt: string;
  contentHtml: string | null;
  excerpt: string | null;
  tags: string[] | null;
  image: {url: string; altText: string | null} | null;
};

async function fetchArticleBody(
  env: Env,
  blogHandle: string,
  articleHandle: string,
): Promise<StorefrontArticle | null> {
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/api/2026-01/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': env.PRIVATE_STOREFRONT_API_TOKEN,
    },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      query: ARTICLE_BODY_QUERY,
      variables: {blogHandle, articleHandle},
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: {blog?: {articleByHandle?: StorefrontArticle | null} | null};
  };
  return json.data?.blog?.articleByHandle ?? null;
}

export async function dispatchArticle(
  env: Env,
  articleGid: string,
  opts: DispatchOptions,
): Promise<DispatchResult> {
  if (!env.SHOPIFY_ADMIN_API_TOKEN) {
    return {status: 'error', reason: 'SHOPIFY_ADMIN_API_TOKEN not set'};
  }
  if (!env.RESEND_API_KEY) {
    return {status: 'error', reason: 'RESEND_API_KEY not set'};
  }
  if (!env.NEWSLETTER_FROM_EMAIL) {
    return {status: 'error', reason: 'NEWSLETTER_FROM_EMAIL not set'};
  }
  if (!env.NEWSLETTER_DISPATCH_SECRET) {
    return {status: 'error', reason: 'NEWSLETTER_DISPATCH_SECRET not set'};
  }

  const blogHandle = env.NEWSLETTER_BLOG_HANDLE || 'releases';

  let status;
  try {
    status = await getArticleStatus(env, articleGid);
  } catch (err) {
    return {
      status: 'error',
      reason:
        err instanceof AdminApiError
          ? `admin api: ${err.message}`
          : 'admin api unreachable',
    };
  }
  if (!status) return {status: 'skipped', reason: 'article not found'};
  if (status.blogHandle !== blogHandle) {
    return {
      status: 'skipped',
      reason: `wrong blog (${status.blogHandle} ≠ ${blogHandle})`,
    };
  }
  if (!status.isPublished || !status.publishedAt) {
    return {status: 'skipped', reason: 'not published'};
  }
  if (status.tags.includes('no-newsletter')) {
    return {status: 'skipped', reason: 'no-newsletter tag set'};
  }
  if (status.dispatchedAt && !opts.force) {
    return {
      status: 'skipped',
      reason: `already dispatched at ${status.dispatchedAt}`,
    };
  }

  const article = await fetchArticleBody(env, blogHandle, status.handle);
  if (!article) {
    return {status: 'error', reason: 'storefront article fetch failed'};
  }

  const company = {
    name: env.PUBLIC_COMPANY_NAME || 'OpenDrone',
    address: env.PUBLIC_COMPANY_ADDRESS ?? null,
    kbo: env.PUBLIC_COMPANY_KBO ?? null,
    vat: env.PUBLIC_COMPANY_VAT ?? null,
  };
  const fromName = company.name;
  const fromAddr = env.NEWSLETTER_FROM_EMAIL;
  const fromHeader = `${fromName} <${fromAddr}>`;

  let recipientCount = 0;
  let batchCount = 0;
  let firstBatchSent = false;

  try {
    for await (const batch of iterateSubscribers(env)) {
      const chunks = chunk(batch, RESEND_BATCH_SIZE);
      for (const chunkBatch of chunks) {
        const sent = await sendBatch(env, {
          from: fromHeader,
          replyTo: 'support@opendrone.be',
          recipients: chunkBatch,
          article,
          blogHandle,
          siteOrigin: opts.siteOrigin,
          company,
        });
        recipientCount += sent;
        batchCount += 1;
        if (!firstBatchSent && sent > 0) {
          firstBatchSent = true;
          // Mark dispatched as soon as the first batch lands. A retry
          // after this point will be a no-op via `dispatchedAt` check
          // (unless the caller passes `force`).
          try {
            await markArticleDispatched(env, articleGid, sent);
          } catch (err) {
            console.warn('[newsletter/dispatch] metafield mark failed', err);
            // We continue sending — the dedup ledger is best-effort.
            // Worst case: a redelivered webhook re-sends, dedup KV (if
            // configured by the caller) catches it.
          }
        } else if (firstBatchSent) {
          // Update count metafield on later batches for accuracy.
          try {
            await markArticleDispatched(env, articleGid, recipientCount);
          } catch (err) {
            console.warn('[newsletter/dispatch] metafield update failed', err);
          }
        }
      }
    }
  } catch (err) {
    console.error('[newsletter/dispatch] subscriber pagination failed', err);
    if (firstBatchSent) {
      return {
        status: 'sent',
        recipientCount,
        batches: batchCount,
      };
    }
    return {
      status: 'error',
      reason: err instanceof Error ? err.message : 'unknown',
    };
  }

  if (recipientCount === 0) {
    return {status: 'skipped', reason: 'no subscribers'};
  }
  return {status: 'sent', recipientCount, batches: batchCount};
}

async function sendBatch(
  env: Env,
  args: {
    from: string;
    replyTo: string;
    recipients: Subscriber[];
    article: StorefrontArticle;
    blogHandle: string;
    siteOrigin: string;
    company: {
      name: string;
      address: string | null;
      kbo: string | null;
      vat: string | null;
    };
  },
): Promise<number> {
  const items = await Promise.all(
    args.recipients.map(async (r) => {
      const token = await signUnsubscribeToken(env, {
        cid: r.id,
        email: r.email,
      });
      const unsubscribeUrl = buildUnsubscribeUrl(args.siteOrigin, token);
      const rendered = renderNewsletter({
        article: {
          ...args.article,
          tags: args.article.tags ?? [],
        },
        blogHandle: args.blogHandle,
        siteOrigin: args.siteOrigin,
        recipient: {
          email: r.email,
          firstName: r.firstName,
          subscribedAt: null, // not surfaced by current Admin API query
        },
        unsubscribeUrl,
        company: args.company,
      });
      return {
        from: args.from,
        to: [r.email],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        reply_to: args.replyTo,
        // RFC 8058 one-click unsubscribe headers — Gmail / Yahoo bulk
        // sender requirement. The POST endpoint is the same as the
        // visible link.
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    }),
  );

  const res = await fetch(RESEND_BATCH_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    body: JSON.stringify(items),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(
      '[newsletter/dispatch] resend batch failed',
      res.status,
      body.slice(0, 300),
    );
    return 0;
  }
  return items.length;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length <= size) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
