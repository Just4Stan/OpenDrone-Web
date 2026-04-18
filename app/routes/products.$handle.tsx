import {useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {ProductCompliance} from '~/components/ProductCompliance';
import {Breadcrumb} from '~/components/Breadcrumb';
import {RelatedProducts} from '~/components/RelatedProducts';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {buildSeoMeta} from '~/lib/seo';
import {getCompanyIdentity} from '~/lib/company';

export const meta: Route.MetaFunction = ({data}) =>
  buildSeoMeta({
    title: data?.product?.seo?.title || data?.product?.title || 'Product',
    description:
      data?.product?.seo?.description || data?.product?.description || undefined,
    image: data?.product?.selectedOrFirstAvailableVariant?.image?.url,
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
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  const company = getCompanyIdentity(
    context.env as unknown as Record<string, string | undefined>,
  );

  return {
    product,
    company,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    return {recommendations: Promise.resolve(null)};
  }

  const recommendations = storefront
    .query(PRODUCT_RECOMMENDATIONS_QUERY, {
      variables: {handle},
    })
    .then((res) => res?.productRecommendations ?? null)
    .catch(() => null);

  return {recommendations};
}

export default function Product() {
  const {product, company, recommendations} = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, descriptionHtml} = product;
  const hasRealVariant =
    !!selectedVariant?.title && selectedVariant.title !== 'Default Title';
  const productFacts = [
    {
      label: 'Availability',
      value: selectedVariant?.availableForSale ? 'In stock' : 'Sold out',
    },
    {label: 'Vendor', value: product.vendor || 'OpenDrone'},
    selectedVariant?.sku
      ? {label: 'SKU', value: selectedVariant.sku}
      : null,
    hasRealVariant
      ? {label: 'Variant', value: selectedVariant.title}
      : null,
  ].filter(
    (f): f is {label: string; value: string} => f !== null,
  );

  const galleryImages = product.images?.nodes?.length
    ? product.images.nodes
    : selectedVariant?.image
      ? [selectedVariant.image]
      : [];

  const primaryCollection = product.collections?.nodes?.[0];

  return (
    <div className="product-page page-shell">
      <Breadcrumb
        items={[
          {label: 'Shop', to: '/collections/all'},
          ...(primaryCollection
            ? [
                {
                  label: primaryCollection.title,
                  to: `/collections/${primaryCollection.handle}`,
                },
              ]
            : []),
          {label: product.title},
        ]}
      />
      <div className="product-layout">
        <div className="product-media">
          <ProductGallery
            images={galleryImages}
            activeImageId={selectedVariant?.image?.id ?? null}
          />
        </div>

        <div className="product-panel">
          <p className="product-eyebrow">
            {product.vendor || 'OpenDrone'}
          </p>
          <h1 className="page-title">{title}</h1>
          <div className="product-price-wrap">
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
          </div>

          <div className="product-form-wrap">
            <ProductForm
              productOptions={productOptions}
              selectedVariant={selectedVariant}
            />
          </div>

          <dl className="product-facts">
            {productFacts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <ProductCompliance
            product={{
              title: product.title,
              vendor: product.vendor,
              handle: product.handle,
              safetyWarningsNl: product.safetyWarningsNl,
              datasheetUrl: product.datasheetUrl,
              manualUrl: product.manualUrl,
              docUrl: product.docUrl,
              sbomUrl: product.sbomUrl,
              githubRepo: product.githubRepo,
              modelNumber: product.modelNumber,
              batchId: product.batchId,
            }}
            company={company}
          />

          <div className="rich-content product-description">
            <h2 className="section-heading">Description</h2>
            <div
              dangerouslySetInnerHTML={{__html: descriptionHtml}}
            />
          </div>
        </div>
      </div>
      <RelatedProducts recommendations={recommendations} />
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    images(first: 10) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    collections(first: 1) {
      nodes {
        handle
        title
      }
    }
    seo {
      description
      title
    }
    safetyWarningsNl: metafield(namespace: "custom", key: "safety_warnings_nl") {
      ...ComplianceMetafield
    }
    datasheetUrl: metafield(namespace: "custom", key: "datasheet_url") {
      ...ComplianceMetafield
    }
    manualUrl: metafield(namespace: "custom", key: "manual_url") {
      ...ComplianceMetafield
    }
    docUrl: metafield(namespace: "custom", key: "doc_url") {
      ...ComplianceMetafield
    }
    sbomUrl: metafield(namespace: "custom", key: "sbom_url") {
      ...ComplianceMetafield
    }
    githubRepo: metafield(namespace: "custom", key: "github_repo") {
      ...ComplianceMetafield
    }
    modelNumber: metafield(namespace: "custom", key: "model_number") {
      ...ComplianceMetafield
    }
    batchId: metafield(namespace: "custom", key: "batch_id") {
      ...ComplianceMetafield
    }
  }
  fragment ComplianceMetafield on Metafield {
    key
    namespace
    type
    value
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

const PRODUCT_RECOMMENDATIONS_QUERY = `#graphql
  query ProductRecommendations(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productHandle: $handle) {
      id
      handle
      title
      featuredImage {
        id
        url
        altText
        width
        height
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
    }
  }
` as const;
