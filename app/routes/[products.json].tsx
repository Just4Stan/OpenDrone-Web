import type {Route} from './+types/[products.json]';
import {PRODUCT_CONTENT} from '~/lib/product-content';

/**
 * /products.json — machine-readable catalog feed for agents and tooling.
 * Replaces the Liquid endpoint agents probe for on Shopify stores (Hydrogen
 * doesn't ship one). Adds what no stock feed has: a ready-made cart
 * permalink per variant, the CERN-OHL-S license, and the design-source repo.
 */

const FEED_QUERY = `#graphql
  query ProductsFeed($count: Int!) {
    products(first: $count, query: "-product_type:Donation") {
      nodes {
        id
        handle
        title
        description
        productType
        featuredImage {
          url
          altText
        }
        variants(first: 12) {
          nodes {
            id
            sku
            title
            availableForSale
            price {
              amount
              currencyCode
            }
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
` as const;

const numericId = (gid: string) => gid.split('/').pop() ?? gid;

export async function loader({context, request}: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const data = await context.storefront.query(FEED_QUERY, {
    variables: {count: 50},
    cache: context.storefront.CacheLong(),
  });

  const products = (data.products?.nodes ?? []).map((p) => {
    const content = PRODUCT_CONTENT[p.handle];
    return {
      handle: p.handle,
      title: p.title,
      description: p.description,
      product_type: p.productType || null,
      url: `${origin}/products/${p.handle}`,
      image: p.featuredImage?.url ?? null,
      license: content ? 'CERN-OHL-S-2.0' : null,
      design_source:
        content?.repoUrl && content.repoUrl !== 'https://github.com/incutec-hw'
          ? content.repoUrl
          : null,
      variants: (p.variants?.nodes ?? []).map((v) => {
        const id = numericId(v.id);
        return {
          id,
          sku: v.sku || null,
          title: v.title,
          options: Object.fromEntries(
            (v.selectedOptions ?? []).map((o) => [o.name, o.value]),
          ),
          available: v.availableForSale,
          price: v.price.amount,
          currency: v.price.currencyCode,
          cart_permalink: `${origin}/cart/${id}:1`,
        };
      }),
    };
  });

  return new Response(
    JSON.stringify(
      {
        note: 'Pre-launch: prices are placeholders and subject to change. Civilian use only — see /end-use. Agent guide: /llms.txt',
        products,
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'max-age=3600',
      },
    },
  );
}
