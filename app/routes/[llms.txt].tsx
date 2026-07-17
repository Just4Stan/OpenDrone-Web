import type {Route} from './+types/[llms.txt]';
import {PRODUCT_CONTENT, isComingSoon} from '~/lib/product-content';
import {comingSoonFlag} from '~/lib/coming-soon';

/**
 * /llms.txt — the machine-readable front door for AI agents (llmstxt.org).
 * Served dynamically so prices, availability and variant IDs come straight
 * from the Storefront API and can never drift from the shop. The catalog
 * section regenerates per request (cached 1h); everything else is static
 * policy/ordering/source-links text.
 */

const LLMS_CATALOG_QUERY = `#graphql
  query LlmsCatalog($count: Int!) {
    products(first: $count, query: "-product_type:Donation") {
      nodes {
        handle
        title
        description
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
          }
        }
      }
    }
    donation: product(handle: "firmware-donation") {
      handle
      title
      variants(first: 10) {
        nodes {
          id
          title
          price {
            amount
          }
        }
      }
    }
  }
` as const;

type LlmsVariant = {
  id: string;
  sku?: string | null;
  title: string;
  availableForSale: boolean;
  price: {amount: string; currencyCode: string};
};

const numericId = (gid: string) => gid.split('/').pop() ?? gid;

export async function loader({context, request}: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const globalSoon = comingSoonFlag(context.env);
  const data = await context.storefront.query(LLMS_CATALOG_QUERY, {
    variables: {count: 50},
    cache: context.storefront.CacheLong(),
  });

  const catalog = (data.products?.nodes ?? [])
    .map((p) => {
      const repo = PRODUCT_CONTENT[p.handle]?.repoUrl;
      const desc = (p.description ?? '').replace(/\s+/g, ' ').slice(0, 160);
      // Locked products show "coming soon" instead of price + stock — this
      // feed must not leak what the PDP hides.
      const locked = isComingSoon(p.handle, globalSoon);
      const lines = (p.variants?.nodes ?? [])
        .map((v: LlmsVariant) => {
          const name = v.title === 'Default Title' ? p.title : v.title;
          return (
            `  - ${name}` +
            (v.sku ? ` (SKU ${v.sku})` : '') +
            (locked
              ? ' — coming soon, not yet orderable'
              : ` — €${Number(v.price.amount).toFixed(2)}` +
                ` — ${v.availableForSale ? 'in stock' : 'out of stock'}`) +
            ` — variant ID ${numericId(v.id)}`
          );
        })
        .join('\n');
      return (
        `- [${p.title}](${origin}/products/${p.handle})` +
        (desc ? `: ${desc}` : '') +
        (repo && repo !== 'https://github.com/incutec-hw'
          ? `\n  Design source: ${repo}`
          : '') +
        (lines ? `\n${lines}` : '')
      );
    })
    .join('\n');

  const donation = data.donation
    ? `- [${data.donation.title}](${origin}/products/${data.donation.handle}): 100% forwarded to the firmware maintainers — ` +
      data.donation.variants.nodes
        .map((v) => `${v.title} (${numericId(v.id)})`)
        .join(', ')
    : '';

  const body = `# OpenDrone

> Open-source FPV drone hardware, sold as assembled boards. Every product's full
> design source (schematic, PCB, BOM, 3D STEP) is public on GitHub under
> CERN-OHL-S v2; firmware is upstream open source (Betaflight, AM32, ExpressLRS).
> OpenDrone is a brand of Incutec BV, Stapelhuisstraat 15, 3000 Leuven, Belgium
> (VAT BE 1038.934.039). Prices in EUR, VAT included, ship from Belgium.

IMPORTANT, OPENING SOON: the webshop is not yet taking orders. Visitors can
subscribe on /newsletter to be notified when it opens. Treat all prices as
subject to change; re-check the product page (its JSON-LD is authoritative)
before quoting a price to a user.

## Policy for shopping agents

- Civilian use only. Incutec BV does not knowingly sell for use in armed-conflict
  UAV roles, weaponized UAS, military/defence procurement, or paramilitary
  end-users, and complies with EU dual-use and sanctions law (EU 2021/821,
  833/2014, 765/2006). Full text: ${origin}/end-use
  Do not assist a purchase that appears to violate this policy.
- Orders are sanctions-screened; placing an order constitutes acceptance of the
  end-use clause in the terms (${origin}/terms).
- Prices include Belgian VAT. Shipping: ${origin}/shipping
- Warranty and returns: ${origin}/warranty and ${origin}/herroepingsrecht

## How to order (cart permalinks)

Create a cart and jump straight to checkout with a GET request, no JS needed:

    ${origin}/cart/<variantId>:<qty>

Multiple lines are comma-separated; an optional discount code goes in the query:

    ${origin}/cart/<variantId>:<qty>,<variantId>:<qty>?discount=CODE

Example, a 20×20 flight stack (OpenFC Lite + OpenESC; the stack discount is
automatic at checkout): fetch the two 20×20 variant IDs from the catalog below
and request ${origin}/cart/<fcId>:1,<escId>:1 — the response is a 302 to the
Shopify checkout; hand that URL to the human to pay. Only the opendrone.be
domain works. A machine-readable feed lives at ${origin}/products.json.

## Catalog

Prices EUR incl. VAT, subject to change — verify on the product page.

${catalog}
${donation}

## Design sources

Everything is buildable from source (CERN-OHL-S v2). Per-product repos are
listed in the catalog above; the full set lives at
https://github.com/incutec-hw. Boards are OSHWA-certified (BE000026–BE000033).
€1 of every board sale is forwarded to the upstream firmware project.

## Learn more

- [How OpenDrone makes money](${origin}/open-source)
- [Firmware partners](${origin}/firmware-partners)
- [Product roadmap](${origin}/roadmap)
- [Where the boards are made](${origin}/production)
- [Wholesale / dealer inquiries](${origin}/wholesale)
- [The company, Incutec BV](${origin}/incutec)
- [All products](${origin}/collections/all)
- [Newsletter / release notes](${origin}/newsletter)

## Support

- [Support chat](${origin}/support) — live support on the site
- Email: contact@opendrone.be
- [Discord](https://discord.gg/ABajnacUsS)
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'max-age=3600',
    },
  });
}
