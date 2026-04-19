import type {Route} from './+types/collections.all';
import {useLoaderData} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';
import type {CollectionItemFragment} from 'storefrontapi.generated';
import {buildSeoMeta} from '~/lib/seo';
import {CollectionSort, resolveSort} from '~/components/CollectionSort';
import {CategoryChips} from '~/components/CategoryChips';
import {EmptyState} from '~/components/EmptyState';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Products',
    description:
      'Browse all OpenDrone products, including open source flight controllers, ESCs, frames, and supporting hardware.',
    type: 'product',
  });

export async function loader(args: Route.LoaderArgs) {
  const deferredData = loadDeferredData(args);
  const criticalData = await loadCriticalData(args);
  return {...deferredData, ...criticalData};
}

async function loadCriticalData({context, request}: Route.LoaderArgs) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 12,
  });
  const url = new URL(request.url);
  const sort = resolveSort(url.searchParams.get('sort'));
  const type = url.searchParams.get('type');

  // Root products() uses ProductSortKeys which differs from
  // ProductCollectionSortKeys — MANUAL/COLLECTION_DEFAULT → BEST_SELLING,
  // CREATED → CREATED_AT.
  const rootSortKey: 'BEST_SELLING' | 'CREATED_AT' | 'ID' | 'PRICE' | 'RELEVANCE' | 'TITLE' =
    sort.sortKey === 'MANUAL' || sort.sortKey === 'COLLECTION_DEFAULT'
      ? 'BEST_SELLING'
      : sort.sortKey === 'CREATED'
        ? 'CREATED_AT'
        : sort.sortKey;

  // Shopify Storefront `query` uses `product_type:"<value>"` syntax.
  const queryFilter = type ? `product_type:"${type.replace(/"/g, '\\"')}"` : '';

  const [{products}, typesData] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {
        ...paginationVariables,
        sortKey: rootSortKey,
        reverse: Boolean(sort.reverse),
        query: queryFilter,
      },
    }),
    storefront.query(PRODUCT_TYPES_QUERY, {
      cache: storefront.CacheShort(),
    }),
  ]);

  const types = (typesData?.productTypes?.nodes ?? []).filter(
    (t: string) => t && t.trim().length > 0,
  );

  return {products, types, activeType: type};
}

function loadDeferredData(_args: Route.LoaderArgs) {
  return {};
}

export default function Collection() {
  const {products, types, activeType} = useLoaderData<typeof loader>();
  const hasProducts = products.nodes.length > 0;

  return (
    <div className="collection page-shell">
      <header className="page-header collection-header">
        <p className="page-eyebrow">Shop · Storefront</p>
        <h1 className="page-title">All Products</h1>
        {hasProducts && <CollectionSort />}
      </header>
      {types.length > 0 && <CategoryChips types={types} />}
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
                href="https://github.com/Just4Stan"
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
    $query: String
  ) @inContext(country: $country, language: $language) {
    products(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor,
      sortKey: $sortKey,
      reverse: $reverse,
      query: $query
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

const PRODUCT_TYPES_QUERY = `#graphql
  query ProductTypes($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    productTypes(first: 25) {
      nodes
    }
  }
` as const;
