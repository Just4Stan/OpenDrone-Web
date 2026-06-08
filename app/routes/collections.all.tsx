import type {Route} from './+types/collections.all';
import {useMemo} from 'react';
import {useLoaderData, useSearchParams} from 'react-router';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {ProductItem} from '~/components/ProductItem';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {buildSeoMeta} from '~/lib/seo';
import {EmptyState} from '~/components/EmptyState';
import {PRODUCT_CONTENT} from '~/lib/product-content';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'All Products',
    description:
      'Browse every OpenDrone product in one place — open source flight controllers, ESCs, receivers, frames, bundles, and accessories. Filter by category and sort by price or newest.',
    type: 'product',
  });

/**
 * Display heading + sidebar order for each Shopify `productType` (set by
 * scripts/shopify-infra/04 + 05). Types not listed fall into a trailing
 * "Other" bucket so nothing is silently dropped from the filter rail.
 */
const CATEGORY_ORDER: Array<{type: string; heading: string}> = [
  {type: 'Flight Controller', heading: 'Flight Controllers'},
  {type: 'ESC', heading: 'ESCs'},
  {type: 'Receiver', heading: 'Receivers'},
  {type: 'Frame', heading: 'Frames'},
  {type: 'Bundle', heading: 'Bundles'},
  {type: 'Accessory', heading: 'Accessories'},
];

/** Sort options for the toolbar dropdown. `newest` is the default and matches
 *  the loader's CREATED_AT-desc fetch order, so it needs no client re-sort. */
const SORT_OPTIONS: Array<{value: string; label: string}> = [
  {value: 'newest', label: 'Newest'},
  {value: 'price-asc', label: 'Price: low to high'},
  {value: 'price-desc', label: 'Price: high to low'},
  {value: 'name-asc', label: 'Name: A–Z'},
  {value: 'name-desc', label: 'Name: Z–A'},
];

/** Products created within this window get a "NEW" badge. */
const NEW_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

export async function loader(args: Route.LoaderArgs) {
  const criticalData = await loadCriticalData(args);
  return {...criticalData};
}

async function loadCriticalData({context}: Route.LoaderArgs) {
  // The catalog is small; fetch it whole (newest first) with variants, then
  // expand/filter/sort client-side from the URL so the page is one shareable
  // browse hub that lists every model on its own card.
  const {products} = await context.storefront.query(CATALOG_QUERY, {
    variables: {first: 100},
    // Catalog content changes rarely — cache long instead of the 1s default.
    cache: context.storefront.CacheLong(),
  });
  // Server timestamp for the NEW badge, so SSR and first client render agree.
  return {products: products.nodes, now: Date.now()};
}

type CatalogProduct = CollectionItemFragment;

/** One browse card — a single product, or one model/tier of a product line. */
type Card = {
  key: string;
  product: CatalogProduct;
  title: string;
  to: string;
  price: MoneyV2;
  /** The tier's own variant image, so each size card shows its real board
   *  instead of falling back to the product's featuredImage. */
  image?: CatalogProduct['featuredImage'];
  onSale: boolean;
  createdAt?: string | null;
  /** A product line whose every tier is still coming soon — shown as a
   *  greyed, non-clickable teaser rather than a buyable card. */
  comingSoon?: boolean;
};

const num = (m?: MoneyV2 | null) => (m ? parseFloat(m.amount) || 0 : 0);

const productOnSale = (p: CatalogProduct) => {
  const compare = p.compareAtPriceRange?.minVariantPrice?.amount;
  return compare != null && parseFloat(compare) > num(p.priceRange.minVariantPrice);
};

/** The Shopify variant carrying a given option value (e.g. Model = "Gemini"),
 *  so a tier card shows its real price/sale even though the tiers themselves
 *  come from the editorial source of truth. */
function variantFor(p: CatalogProduct, axis: string, value: string) {
  return p.variants?.nodes.find((v) =>
    v.selectedOptions.some((o) => o.name === axis && o.value === value),
  );
}

/**
 * Join a product title with a tier value without stuttering — "OpenFC Lite" +
 * "20×20" → "OpenFC Lite 20×20", while "OpenRX" + "Gemini" → "OpenRX Gemini"
 * and "OpenFC Lite" + "Lite" → "OpenFC Lite" (drops the repeated word).
 */
function joinTitle(title: string, value: string): string {
  const tWords = title.split(/\s+/);
  const vWords = value.split(/\s+/);
  let i = 0;
  while (
    i < vWords.length &&
    tWords.length > 0 &&
    tWords[tWords.length - 1].toLowerCase() === vWords[i].toLowerCase()
  ) {
    tWords.pop();
    i++;
  }
  const rest = vWords.slice(i).join(' ');
  return rest ? `${title} ${rest}` : title;
}

export default function Collection() {
  const {products, now} = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeType = searchParams.get('type');
  const onlySale = searchParams.get('sale') === '1';
  const sort = searchParams.get('sort') || 'newest';

  // Expand each product into one card per purchasable model (skipping
  // coming-soon tiers); single products / bundles / accessories get one card.
  // Products arrive newest-first, so card order is newest-first by default.
  const cards = useMemo<Card[]>(() => {
    const out: Card[] = [];
    for (const p of products) {
      const content = PRODUCT_CONTENT[p.handle];
      const axis = content?.optionAxis;
      const allTiers =
        axis && content?.variants ? Object.entries(content.variants) : [];
      const liveTiers = allTiers.filter(([, v]) => !v.comingSoon);
      if (axis && liveTiers.length > 0) {
        for (const [value] of liveTiers) {
          const sv = variantFor(p, axis, value);
          const price = sv?.price ?? p.priceRange.minVariantPrice;
          out.push({
            key: `${p.id}:${value}`,
            product: p,
            title: joinTitle(p.title, value),
            to: `/products/${p.handle}?${encodeURIComponent(axis)}=${encodeURIComponent(value)}`,
            price,
            image: sv?.image ?? p.featuredImage,
            onSale: sv?.compareAtPrice
              ? num(sv.compareAtPrice) > num(price)
              : productOnSale(p),
            createdAt: p.createdAt,
          });
        }
      } else {
        // A line whose every tier is still coming soon (e.g. OpenFC) is an
        // unreleased teaser — show it greyed and non-clickable, not buyable.
        const comingSoon = allTiers.length > 0;
        out.push({
          key: p.id,
          product: p,
          title: p.title,
          to: `/products/${p.handle}`,
          price: p.priceRange.minVariantPrice,
          onSale: comingSoon ? false : productOnSale(p),
          createdAt: p.createdAt,
          comingSoon,
        });
      }
    }
    return out;
  }, [products]);

  // Categories present in the catalog, in editorial order then any leftovers.
  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.productType || 'Other'));
    const out = CATEGORY_ORDER.filter((c) => present.has(c.type)).map((c) => ({
      value: c.type,
      label: c.heading,
    }));
    for (const type of present) {
      if (!CATEGORY_ORDER.some((c) => c.type === type)) {
        out.push({value: type, label: type === 'Other' ? 'Other' : type});
      }
    }
    return out;
  }, [products]);

  const anyOnSale = useMemo(() => cards.some((c) => c.onSale), [cards]);

  // Filter, then sort. `newest` keeps the loader's fetch order.
  const visible = useMemo(() => {
    let list = cards;
    if (activeType)
      list = list.filter((c) => (c.product.productType || 'Other') === activeType);
    if (onlySale) list = list.filter((c) => c.onSale);
    const sorted = [...list];
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => num(a.price) - num(b.price));
        break;
      case 'price-desc':
        sorted.sort((a, b) => num(b.price) - num(a.price));
        break;
      case 'name-asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      default:
        break; // newest — already CREATED_AT desc from the loader
    }
    return sorted;
  }, [cards, activeType, onlySale, sort]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    ['cursor', 'direction'].forEach((k) => next.delete(k));
    setSearchParams(next, {preventScrollReset: true});
  };

  const filterLink = (label: string, active: boolean, onClick: () => void) => (
    <li>
      <button
        type="button"
        className={`catalog-filter${active ? ' is-active' : ''}`}
        aria-pressed={active}
        onClick={onClick}
      >
        {label}
      </button>
    </li>
  );

  const hasProducts = products.length > 0;
  const isNew = (createdAt?: string | null) =>
    createdAt ? now - Date.parse(createdAt) < NEW_WINDOW_MS : false;

  return (
    <div className="collection page-shell">
      <header className="page-header collection-header">
        <p className="page-eyebrow">Shop</p>
        <h1 className="page-title">All Products</h1>
      </header>

      {hasProducts ? (
        <div className="catalog-layout">
          {/* Left filter rail — category single-select + an on-sale toggle. */}
          <aside className="catalog-sidebar" aria-label="Filter products">
            <div className="catalog-filter-group">
              <h2 className="catalog-filter-head">Categories</h2>
              <ul className="catalog-filter-list">
                {filterLink('All products', !activeType && !onlySale, () => {
                  const next = new URLSearchParams(searchParams);
                  next.delete('type');
                  next.delete('sale');
                  setSearchParams(next, {preventScrollReset: true});
                })}
                {anyOnSale &&
                  filterLink('On sale', onlySale, () =>
                    setParam('sale', onlySale ? null : '1'),
                  )}
                {categories.map((c) =>
                  filterLink(c.label, activeType === c.value, () =>
                    setParam('type', activeType === c.value ? null : c.value),
                  ),
                )}
              </ul>
            </div>
          </aside>

          {/* Main column — toolbar (count + sort) above the product grid. */}
          <div className="catalog-main">
            <div className="catalog-toolbar">
              <p className="catalog-count">
                {visible.length} {visible.length === 1 ? 'product' : 'products'}
              </p>
              <label className="collection-sort catalog-sort">
                <span className="collection-sort-label">Sort</span>
                <select
                  value={sort}
                  onChange={(e) =>
                    setParam('sort', e.target.value === 'newest' ? null : e.target.value)
                  }
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visible.length > 0 ? (
              <div className="products-grid">
                {visible.map((card, index) => (
                  <ProductItem
                    key={card.key}
                    product={card.product}
                    to={card.to}
                    title={card.title}
                    priceOverride={card.price}
                    imageOverride={card.image}
                    loading={index < 8 ? 'eager' : undefined}
                    isNew={isNew(card.createdAt)}
                    onSale={card.onSale}
                    comingSoon={card.comingSoon}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing matches those filters"
                description="Try another category or clear the filters."
                ctaLabel="Show all"
                ctaTo="/collections/all"
              />
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Catalog is being stocked"
          description="Products are not yet listed. Follow along on GitHub for hardware progress."
          secondary={
            <a
              href="https://github.com/incutec-hw"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta-secondary"
            >
              GitHub
            </a>
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
    createdAt
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
    compareAtPriceRange {
      minVariantPrice {
        ...MoneyCollectionItem
      }
    }
    variants(first: 50) {
      nodes {
        id
        availableForSale
        image {
          id
          altText
          url
          width
          height
        }
        selectedOptions {
          name
          value
        }
        price {
          ...MoneyCollectionItem
        }
        compareAtPrice {
          ...MoneyCollectionItem
        }
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
