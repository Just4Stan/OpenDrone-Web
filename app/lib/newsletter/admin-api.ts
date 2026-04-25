/**
 * Shopify Admin GraphQL helpers for the newsletter dispatcher.
 *
 * Two reasons we use Admin and not Storefront here:
 *  1. Storefront API can't list customers — only Admin can page through
 *     the marketing-consented set we need to email.
 *  2. We write metafields back to the article (`newsletter.dispatched_at`,
 *     `newsletter.recipient_count`) so a redelivered webhook is a no-op.
 *
 * Required Admin API scopes on the custom-app token:
 *   read_customers, write_customers, read_content, write_content
 *
 * The Admin API version is pinned via SHOPIFY_ADMIN_API_VERSION (defaults
 * to 2026-01). Bump deliberately — Shopify's mutation/field shapes
 * change between versions.
 */

const DEFAULT_ADMIN_API_VERSION = '2026-01';
const NEWSLETTER_NAMESPACE = 'newsletter';
const FETCH_TIMEOUT_MS = 8000;

type Env = {
  PUBLIC_STORE_DOMAIN: string;
  SHOPIFY_ADMIN_API_TOKEN?: string;
  SHOPIFY_ADMIN_API_VERSION?: string;
};

export type Subscriber = {
  id: string; // gid://shopify/Customer/...
  email: string;
  firstName: string | null;
};

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

function adminEndpoint(env: Env): string {
  const version = env.SHOPIFY_ADMIN_API_VERSION || DEFAULT_ADMIN_API_VERSION;
  return `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${version}/graphql.json`;
}

async function adminFetch<T>(
  env: Env,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  if (!env.SHOPIFY_ADMIN_API_TOKEN) {
    throw new AdminApiError('SHOPIFY_ADMIN_API_TOKEN not set', 0);
  }
  const res = await fetch(adminEndpoint(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_API_TOKEN,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    body: JSON.stringify({query, variables}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AdminApiError(
      `admin api http ${res.status}`,
      res.status,
      body.slice(0, 500),
    );
  }
  const json = (await res.json()) as {data?: T; errors?: unknown};
  if (json.errors) {
    throw new AdminApiError(
      `admin api graphql errors: ${JSON.stringify(json.errors).slice(0, 400)}`,
      200,
    );
  }
  if (!json.data) throw new AdminApiError('admin api empty response', 200);
  return json.data;
}

// --- Article ---------------------------------------------------------

const ARTICLE_BY_ID_QUERY = /* GraphQL: Shopify Admin API — not Storefront, skip codegen */ `
  query NewsletterArticleById($id: ID!) {
    article(id: $id) {
      id
      handle
      title
      tags
      isPublished
      publishedAt
      blog { handle }
      dispatchedAt: metafield(namespace: "newsletter", key: "dispatched_at") {
        value
      }
    }
  }
`;

export type ArticleStatus = {
  id: string;
  handle: string;
  title: string;
  tags: string[];
  isPublished: boolean;
  publishedAt: string | null;
  blogHandle: string;
  dispatchedAt: string | null;
};

export async function getArticleStatus(
  env: Env,
  articleGid: string,
): Promise<ArticleStatus | null> {
  type Resp = {
    article: {
      id: string;
      handle: string;
      title: string;
      tags: string[];
      isPublished: boolean;
      publishedAt: string | null;
      blog: {handle: string};
      dispatchedAt: {value: string} | null;
    } | null;
  };
  const data = await adminFetch<Resp>(env, ARTICLE_BY_ID_QUERY, {
    id: articleGid,
  });
  if (!data.article) return null;
  return {
    id: data.article.id,
    handle: data.article.handle,
    title: data.article.title,
    tags: data.article.tags ?? [],
    isPublished: data.article.isPublished,
    publishedAt: data.article.publishedAt,
    blogHandle: data.article.blog.handle,
    dispatchedAt: data.article.dispatchedAt?.value ?? null,
  };
}

// --- Subscribers (paginated) -----------------------------------------

const SUBSCRIBERS_QUERY = /* GraphQL: Shopify Admin API — not Storefront, skip codegen */ `
  query NewsletterSubscribers($cursor: String) {
    customers(
      first: 250
      after: $cursor
      query: "email_marketing_state:SUBSCRIBED"
    ) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        email
        firstName
        emailMarketingConsent { marketingState }
      }
    }
  }
`;

/**
 * Generator-style paginated subscriber fetch. Caller awaits each batch
 * and dispatches it before pulling the next page — keeps memory bounded
 * and lets a long send recover gracefully if it crashes mid-flight
 * (already-dispatched recipients are tracked by the article metafield,
 * so a retry would be a no-op anyway).
 */
export async function* iterateSubscribers(
  env: Env,
): AsyncGenerator<Subscriber[], void, void> {
  type Resp = {
    customers: {
      pageInfo: {hasNextPage: boolean; endCursor: string | null};
      nodes: Array<{
        id: string;
        email: string | null;
        firstName: string | null;
        emailMarketingConsent: {marketingState: string} | null;
      }>;
    };
  };

  let cursor: string | null = null;
  while (true) {
    const data: Resp = await adminFetch<Resp>(env, SUBSCRIBERS_QUERY, {cursor});
    const batch: Subscriber[] = [];
    for (const node of data.customers.nodes) {
      if (!node.email) continue;
      // Defensive: query filter already restricts, but double-check.
      if (node.emailMarketingConsent?.marketingState !== 'SUBSCRIBED') continue;
      batch.push({
        id: node.id,
        email: node.email.toLowerCase(),
        firstName: node.firstName,
      });
    }
    if (batch.length) yield batch;
    if (!data.customers.pageInfo.hasNextPage) return;
    cursor = data.customers.pageInfo.endCursor;
    if (!cursor) return;
  }
}

// --- Unsubscribe (write) ---------------------------------------------

const CUSTOMER_UNSUBSCRIBE_MUTATION = /* GraphQL: Shopify Admin API — not Storefront, skip codegen */ `
  mutation NewsletterUnsubscribe($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

export async function unsubscribeCustomer(
  env: Env,
  customerGid: string,
): Promise<{ok: boolean; error?: string}> {
  type Resp = {
    customerEmailMarketingConsentUpdate: {
      customer: {id: string} | null;
      userErrors: Array<{field: string[]; message: string}>;
    };
  };
  const data = await adminFetch<Resp>(env, CUSTOMER_UNSUBSCRIBE_MUTATION, {
    input: {
      customerId: customerGid,
      emailMarketingConsent: {
        marketingState: 'UNSUBSCRIBED',
        marketingOptInLevel: 'SINGLE_OPT_IN',
      },
    },
  });
  const errs = data.customerEmailMarketingConsentUpdate.userErrors;
  if (errs.length) {
    return {ok: false, error: errs.map((e) => e.message).join('; ')};
  }
  return {ok: !!data.customerEmailMarketingConsentUpdate.customer};
}

// --- Article metafield (dedup ledger) --------------------------------

const METAFIELDS_SET_MUTATION = /* GraphQL: Shopify Admin API — not Storefront, skip codegen */ `
  mutation NewsletterArticleMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key }
      userErrors { field message }
    }
  }
`;

export async function markArticleDispatched(
  env: Env,
  articleGid: string,
  recipientCount: number,
): Promise<void> {
  type Resp = {
    metafieldsSet: {
      metafields: Array<{id: string}>;
      userErrors: Array<{field: string[]; message: string}>;
    };
  };
  const now = new Date().toISOString();
  const data = await adminFetch<Resp>(env, METAFIELDS_SET_MUTATION, {
    metafields: [
      {
        ownerId: articleGid,
        namespace: NEWSLETTER_NAMESPACE,
        key: 'dispatched_at',
        type: 'date_time',
        value: now,
      },
      {
        ownerId: articleGid,
        namespace: NEWSLETTER_NAMESPACE,
        key: 'recipient_count',
        type: 'number_integer',
        value: String(recipientCount),
      },
    ],
  });
  const errs = data.metafieldsSet.userErrors;
  if (errs.length) {
    throw new AdminApiError(
      `metafield set failed: ${errs.map((e) => e.message).join('; ')}`,
      200,
    );
  }
}
