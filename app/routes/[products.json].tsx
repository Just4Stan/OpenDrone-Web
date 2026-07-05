import type {Route} from './+types/[products.json]';
import {PRODUCT_CONTENT, isComingSoon} from '~/lib/product-content';
import {comingSoonFlag} from '~/lib/coming-soon';

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
  const globalSoon = comingSoonFlag(context.env);
  const data = await context.storefront.query(FEED_QUERY, {
    variables: {count: 50},
    cache: context.storefront.CacheLong(),
  });

  const products = (data.products?.nodes ?? []).map((p) => {
    const content = PRODUCT_CONTENT[p.handle];
    // Locked products expose no price and no cart permalink — this feed is
    // the most scrapeable surface, so it must match what the PDP shows.
    const locked = isComingSoon(p.handle, globalSoon);
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
      ...(locked ? {coming_soon: true} : null),
      variants: (p.variants?.nodes ?? []).map((v) => {
        const id = numericId(v.id);
        return {
          id,
          sku: v.sku || null,
          title: v.title,
          options: Object.fromEntries(
            (v.selectedOptions ?? []).map((o) => [o.name, o.value]),
          ),
          available: locked ? false : v.availableForSale,
          price: locked ? null : v.price.amount,
          currency: locked ? null : v.price.currencyCode,
          ...(locked ? null : {cart_permalink: `${origin}/cart/${id}:1`}),
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
        // While the coming-soon flag is ON, keep the feed on a short leash
        // (5 min) so flipping PUBLIC_COMING_SOON on launch day doesn't leave
        // agents reading a stale "coming soon" catalog for a full hour.
        // Unlocked shop → the catalog is stable, cache the full hour.
        'Cache-Control': globalSoon ? 'max-age=300' : 'max-age=3600',
      },
    },
  );
}
