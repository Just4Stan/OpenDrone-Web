import {useLoaderData, Link, redirect} from 'react-router';
import type {Route} from './+types/collections._index';
import {getPaginationVariables, Image} from '@shopify/hydrogen';
import type {CollectionFragment} from 'storefrontapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {buildSeoMeta, SITE_ORIGIN} from '~/lib/seo';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

export const meta: Route.MetaFunction = ({location}) =>
  buildSeoMeta({
    title: copyText('collections.meta_title') ?? 'Collections',
    description:
      copyText('collections.meta_description') ??
      'Browse OpenDrone collections for flight controllers, ESCs, frames, and open hardware builds.',
    url: `${SITE_ORIGIN}${location.pathname}`,
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
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 4,
  });

  const [{collections}] = await Promise.all([
    context.storefront.query(COLLECTIONS_QUERY, {
      variables: paginationVariables,
      cache: context.storefront.CacheLong(),
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  // The store is organised by product family, not Shopify collections, so this
  // index is empty — a dead-end landing page. Send visitors to the real catalog
  // (the family-chip grid) instead of an empty "Collections" shell.
  if (!collections?.nodes?.length) {
    throw redirect('/collections/all');
  }

  return {collections};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: Route.LoaderArgs) {
  return {};
}

export default function Collections() {
  const {collections} = useLoaderData<typeof loader>();

  return (
    <div className="collections page-shell">
      <header className="page-header">
        <Txt id="collections.eyebrow" as="p" className="page-eyebrow" />
        <Txt id="collections.title" as="h1" className="page-title" />
        <Txt id="collections.description" as="p" className="page-description" />
      </header>
      <PaginatedResourceSection<CollectionFragment>
        connection={collections}
        resourcesClassName="collections-grid"
      >
        {({node: collection, index}) => (
          <CollectionItem
            key={collection.id}
            collection={collection}
            index={index}
          />
        )}
      </PaginatedResourceSection>
    </div>
  );
}

function CollectionItem({
  collection,
  index,
}: {
  collection: CollectionFragment;
  index: number;
}) {
  return (
    <Link
      className="collection-card"
      key={collection.id}
      to={`/collections/${collection.handle}`}
      prefetch="viewport"
    >
      {collection?.image && (
        <Image
          alt={collection.image.altText || collection.title}
          aspectRatio="1/1"
          data={collection.image}
          loading={index < 3 ? 'eager' : undefined}
          sizes="(min-width: 45em) 400px, 100vw"
        />
      )}
      <div className="collection-card-body">
        <h2>{collection.title}</h2>
      </div>
    </Link>
  );
}

const COLLECTIONS_QUERY = `#graphql
  fragment Collection on Collection {
    id
    title
    handle
    image {
      id
      url
      altText
      width
      height
    }
  }
  query StoreCollections(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    collections(
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      nodes {
        ...Collection
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
` as const;
