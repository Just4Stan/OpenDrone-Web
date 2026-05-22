import type {Route} from './+types/collections.all';
import {useLoaderData, useSearchParams} from 'react-router';
import {ProductItem, type ProductModelChip} from '~/components/ProductItem';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {buildSeoMeta} from '~/lib/seo';
import {CategoryChips} from '~/components/CategoryChips';
import {EmptyState} from '~/components/EmptyState';
import {PRODUCT_CONTENT} from '~/lib/product-content';

/**
 * The models of a product line, from the editorial source of truth
 * (`product-content.ts`) — the same map the PDP ladder reads. Returns the
 * line's tiers as browse-card chips, in editorial order. Empty for single
 * products, bundles, and accessories (no `Model` axis).
 */
function modelChipsFor(handle: string): ProductModelChip[] {
  const content = PRODUCT_CONTENT[handle];
  if (!content?.optionAxis || !content.variants) return [];
  return Object.entries(content.variants).map(([value, v]) => ({
    value,
    axis: content.optionAxis!,
    comingSoon: v.comingSoon,
  }));
}

/** Editorial one-liner (the PDP hero lead) for the feature-card layout. */
function leadFor(handle: string): string | undefined {
  return PRODUCT_CONTENT[handle]?.hero.lead || undefined;
}

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'All Products',
    description:
      'Browse the full OpenDrone catalog by category — open source flight controllers, ESCs, receivers, frames, bundles, and accessories.',
    type: 'product',
  });

/**
 * Category order + display headings for the browse page. The `type` strings
 * are the Shopify `productType` values set by scripts/shopify-infra/04 + 05;
 * `heading` is the section/chip label. Products whose type isn't listed fall
 * into a trailing "Other" section so nothing is silently dropped.
 */
const CATEGORY_ORDER: Array<{type: string; heading: string}> = [
  {type: 'Flight Controller', heading: 'Flight Controllers'},
  {type: 'ESC', heading: 'ESCs'},
  {type: 'Receiver', heading: 'Receivers'},
  {type: 'Frame', heading: 'Frames'},
  {type: 'Bundle', heading: 'Bundles'},
  {type: 'Accessory', heading: 'Accessories'},
];

export async function loader(args: Route.LoaderArgs) {
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  // The catalog is small; fetch it whole and group/filter client-side so the
  // page reads as a browse hub (no pagination across category sections).
  const {products} = await context.storefront.query(CATALOG_QUERY, {
    variables: {first: 100},
  });
  return {products: products.nodes};
}

export default function Collection() {
  const {products} = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const activeType = searchParams.get('type');

  // Group products into the fixed category order; collect any leftovers.
  const byType = new Map<string, CollectionItemFragment[]>();
  for (const p of products) {
    const key = p.productType || 'Other';
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(p);
  }

  const ordered: Array<{type: string; heading: string; items: CollectionItemFragment[]}> = [];
  for (const {type, heading} of CATEGORY_ORDER) {
    const items = byType.get(type);
    if (items?.length) ordered.push({type, heading, items});
    byType.delete(type);
  }
  // Trailing "Other" — any product whose type isn't in CATEGORY_ORDER.
  for (const [type, items] of byType) {
    if (items.length) ordered.push({type, heading: type === 'Other' ? 'Other' : type, items});
  }

  const chips = ordered.map(({type, heading}) => ({value: type, label: heading}));
  const sections = activeType
    ? ordered.filter((s) => s.type === activeType)
    : ordered;

  const hasProducts = products.length > 0;

  return (
    <div className="collection page-shell">
      <header className="page-header collection-header">
        <p className="page-eyebrow">Shop · Catalog</p>
        <h1 className="page-title">All Products</h1>
      </header>

      {hasProducts && <CategoryChips categories={chips} />}

      {sections.length > 0 ? (
        sections.map(({type, heading, items}) => (
          <section className="catalog-category" key={type}>
            <h2 className="catalog-category-title">{heading}</h2>
            {items.length === 1 ? (
              // Single-product category: a wide feature card fills the rail
              // instead of leaving one capped card with empty tracks beside it.
              <ProductItem
                product={items[0]}
                loading="eager"
                feature
                lead={leadFor(items[0].handle)}
                models={modelChipsFor(items[0].handle)}
              />
            ) : (
              <div className="products-grid">
                {items.map((product, index) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    loading={index < 8 ? 'eager' : undefined}
                    models={modelChipsFor(product.handle)}
                  />
                ))}
              </div>
            )}
          </section>
        ))
      ) : (
        <EmptyState
          title={activeType ? `No ${activeType} products yet` : 'Catalog is being stocked'}
          description={
            activeType
              ? 'Try another category or browse everything.'
              : 'Products are not yet listed. Follow along on GitHub for hardware progress.'
          }
          ctaLabel={activeType ? 'Show all' : undefined}
          ctaTo={activeType ? '/collections/all' : undefined}
          secondary={
            activeType ? undefined : (
              <a
                href="https://github.com/incutec-hw"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-cta-secondary"
              >
                GitHub
              </a>
            )
          }
        />
      )}
    </div>
  );
}

const COLLECTION_ITEM_FRAGMENT = `#graphql
  fragment MoneyCollectionItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionItem on Product {
    id
    handle
    title
    productType
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyCollectionItem
      }
      maxVariantPrice {
        ...MoneyCollectionItem
      }
    }
  }
` as const;

const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
  ) @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        ...CollectionItem
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
` as const;
