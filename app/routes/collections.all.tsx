import type {Route} from './+types/collections.all';
import {useLoaderData} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {buildSeoMeta} from '~/lib/seo';
import {Breadcrumb} from '~/components/Breadcrumb';
import {CollectionSort, resolveSort} from '~/components/CollectionSort';
import {EmptyState} from '~/components/EmptyState';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Products',
    description:
      'Browse all OpenDrone products, including open source flight controllers, ESCs, frames, and supporting hardware.',
    type: 'product',
  });

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 12,
  });
  const url = new URL(request.url);
  const sort = resolveSort(url.searchParams.get('sort'));

  // Root products() uses ProductSortKeys which differs from
  // ProductCollectionSortKeys — MANUAL/COLLECTION_DEFAULT → BEST_SELLING,
  // CREATED → CREATED_AT.
  const rootSortKey: 'BEST_SELLING' | 'CREATED_AT' | 'ID' | 'PRICE' | 'RELEVANCE' | 'TITLE' =
    sort.sortKey === 'MANUAL' || sort.sortKey === 'COLLECTION_DEFAULT'
      ? 'BEST_SELLING'
      : sort.sortKey === 'CREATED'
        ? 'CREATED_AT'
        : sort.sortKey;

  const [{products}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {
        ...paginationVariables,
        sortKey: rootSortKey,
        reverse: Boolean(sort.reverse),
      },
    }),
  ]);
  return {products};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Collection() {
  const {products} = useLoaderData<typeof loader>();
  const hasProducts = products.nodes.length > 0;

  return (
    <div className="collection page-shell">
      <Breadcrumb items={[{label: 'Shop'}]} />
      <header className="page-header collection-header">
        <div>
          <p className="page-eyebrow">Storefront</p>
          <h1 className="page-title">All Products</h1>
          <p className="page-description">
            A complete view of the current OpenDrone catalog, from core flight
            electronics to frame components.
          </p>
        </div>
        {hasProducts && <CollectionSort />}
      </header>
      {hasProducts ? (
        <PaginatedResourceSection<CollectionItemFragment>
          connection={products}
          resourcesClassName="products-grid"
        >
          {({node: product, index}) => (
            <ProductItem
              key={product.id}
              product={product}
              loading={index < 8 ? 'eager' : undefined}
            />
          )}
        </PaginatedResourceSection>
      ) : (
        <EmptyState
          title="Catalog is being stocked"
          description="Products are not yet listed. Follow along on GitHub for hardware progress."
          secondary={
            <a
              href="https://github.com/Just4Stan"
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

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    products(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor,
      sortKey: $sortKey,
      reverse: $reverse
    ) {
      nodes {
        ...CollectionItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
` as const;
