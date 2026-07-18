/**
 * Minimal Shopify Admin GraphQL client. First consumer: tagging newsletter
 * customers with the product they asked to be notified about
 * (`notify-<handle>`), which the Storefront API's customerCreate cannot do.
 *
 * Requires SHOPIFY_ADMIN_API_TOKEN (custom-app token; read_customers +
 * write_customers for the notify tagging). Everything here is best-effort:
 * callers must treat a null/false return as "skip", never as a user-facing
 * failure — the newsletter signup itself already succeeded via Storefront.
 */

const ADMIN_API_VERSION_FALLBACK = '2026-01';

type AdminEnv = Pick<
  Env,
  'PUBLIC_STORE_DOMAIN' | 'SHOPIFY_ADMIN_API_TOKEN' | 'SHOPIFY_ADMIN_API_VERSION'
>;

export function adminApiAvailable(env: AdminEnv): boolean {
  return Boolean(env.SHOPIFY_ADMIN_API_TOKEN && env.PUBLIC_STORE_DOMAIN);
}

async function adminGraphql<T>(
  env: AdminEnv,
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  if (!adminApiAvailable(env)) {
    console.error(
      '[shopify-admin] notify tag skipped — SHOPIFY_ADMIN_API_TOKEN not set',
    );
    return null;
  }
  const version = env.SHOPIFY_ADMIN_API_VERSION || ADMIN_API_VERSION_FALLBACK;
  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${version}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.SHOPIFY_ADMIN_API_TOKEN!,
      },
      body: JSON.stringify({query, variables}),
    },
  );
  if (!res.ok) {
    console.error('[shopify-admin] HTTP', res.status);
    return null;
  }
  const json = (await res.json()) as {data?: T; errors?: Array<{message: string}>};
  if (json.errors?.length) {
    console.error('[shopify-admin] GraphQL errors', json.errors.length);
    return null;
  }
  return json.data ?? null;
}

const CUSTOMER_BY_EMAIL_QUERY = `
  query NotifyCustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      nodes { id }
    }
  }
`;

const TAGS_ADD_MUTATION = `
  mutation NotifyTagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors { message }
    }
  }
`;

/**
 * Tag a customer `notify-<handle>` so launch interest is segmentable per SKU
 * in Shopify admin. `customerId` (Storefront gid — same gid the Admin API
 * uses) skips the email lookup when available. Best-effort: returns false on
 * any miss, throws never.
 */
export async function tagCustomerNotify(
  env: AdminEnv,
  opts: {customerId?: string | null; email: string; productHandle: string},
): Promise<boolean> {
  try {
    let id = opts.customerId ?? null;
    if (!id) {
      const found = await adminGraphql<{
        customers: {nodes: Array<{id: string}>};
      }>(env, CUSTOMER_BY_EMAIL_QUERY, {
        // Exact-match email search; quotes keep addresses with '+' intact.
        query: `email:"${opts.email.replace(/"/g, '')}"`,
      });
      id = found?.customers?.nodes?.[0]?.id ?? null;
    }
    if (!id) return false;
    const result = await adminGraphql<{
      tagsAdd: {userErrors: Array<{message: string}>};
    }>(env, TAGS_ADD_MUTATION, {
      id,
      tags: [`notify-${opts.productHandle}`],
    });
    if (!result) return false;
    if (result.tagsAdd?.userErrors?.length) {
      console.error(
        '[shopify-admin] tagsAdd userErrors',
        result.tagsAdd.userErrors.length,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error('[shopify-admin] tagCustomerNotify failed', err);
    return false;
  }
}

const MARKETING_CONSENT_UPDATE_MUTATION = `
  mutation UnsubscribeConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      userErrors { message }
    }
  }
`;

/**
 * Flip a customer's email marketing consent to UNSUBSCRIBED so Shopify
 * Email sends (the monthly newsletter channel) stop targeting them.
 * Called by /newsletter/unsubscribe. Best-effort like everything here:
 * false on any miss (including missing admin token), throws never — the
 * Resend suppression and ledger record still land regardless.
 */
export async function unsubscribeCustomerMarketing(
  env: AdminEnv,
  email: string,
): Promise<boolean> {
  try {
    const found = await adminGraphql<{
      customers: {nodes: Array<{id: string}>};
    }>(env, CUSTOMER_BY_EMAIL_QUERY, {
      query: `email:"${email.replace(/"/g, '')}"`,
    });
    const id = found?.customers?.nodes?.[0]?.id ?? null;
    if (!id) return false;
    const result = await adminGraphql<{
      customerEmailMarketingConsentUpdate: {
        userErrors: Array<{message: string}>;
      };
    }>(env, MARKETING_CONSENT_UPDATE_MUTATION, {
      input: {
        customerId: id,
        emailMarketingConsent: {
          marketingState: 'UNSUBSCRIBED',
          consentUpdatedAt: new Date().toISOString(),
        },
      },
    });
    if (!result) return false;
    if (result.customerEmailMarketingConsentUpdate?.userErrors?.length) {
      console.error(
        '[shopify-admin] consent update userErrors',
        result.customerEmailMarketingConsentUpdate.userErrors.length,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error('[shopify-admin] unsubscribeCustomerMarketing failed', err);
    return false;
  }
}
