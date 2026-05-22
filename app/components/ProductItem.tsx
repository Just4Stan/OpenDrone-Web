import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {
  ProductItemFragment,
  CollectionItemFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';

/**
 * One model/tier of a product line, surfaced as a chip under the card on
 * the browse page. `axis` is the Shopify option name (standardised to
 * "Model"); a real model deep-links to the PDP with that model
 * preselected (`?<axis>=<value>`), a coming-soon model renders greyed and
 * non-interactive (no purchasable variant yet).
 */
export type ProductModelChip = {
  value: string;
  axis: string;
  comingSoon?: boolean;
};

export function ProductItem({
  product,
  loading,
  models,
  feature,
  lead,
}: {
  product: CollectionItemFragment | ProductItemFragment;
  loading?: 'eager' | 'lazy';
  models?: ProductModelChip[];
  /** Wide horizontal layout for a single-product category row, so the
   *  flagship fills the rail instead of leaving it empty. */
  feature?: boolean;
  /** Editorial one-liner shown in the feature layout (the product's hero
   *  lead). Ignored outside `feature`. */
  lead?: string;
}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  const hasModels = Boolean(models && models.length > 0);

  const modelStrip = hasModels ? (
    <div className="product-card-models">
      {models!.map((m) =>
        m.comingSoon ? (
          <span
            key={m.value}
            className="product-card-model is-comingsoon"
            title="Coming soon"
          >
            {m.value}
          </span>
        ) : (
          <Link
            key={m.value}
            className="product-card-model"
            prefetch="intent"
            to={`${variantUrl}?${encodeURIComponent(m.axis)}=${encodeURIComponent(
              m.value,
            )}`}
          >
            {m.value}
          </Link>
        ),
      )}
    </div>
  ) : null;

  // Feature layout — image left, editorial copy + model chips right. Used
  // for category sections with a single product so the flagship spans the
  // full rail. The media and the headline are separate links (no nested
  // anchors); the chips are their own links too.
  if (feature) {
    return (
      <article className="product-feature">
        <Link
          className="product-feature-media"
          prefetch="intent"
          to={variantUrl}
          aria-hidden="true"
          tabIndex={-1}
        >
          {image && (
            <Image
              alt={image.altText || product.title}
              data={image}
              loading={loading}
              sizes="(min-width: 64em) 340px, 100vw"
            />
          )}
        </Link>
        <div className="product-feature-body">
          <Link
            className="product-feature-headline"
            prefetch="intent"
            to={variantUrl}
          >
            <div className="product-card-row">
              <h2 className="product-card-title">{product.title}</h2>
              <span className="product-card-price">
                <Money data={product.priceRange.minVariantPrice} />
              </span>
            </div>
            {'productType' in product && product.productType ? (
              <p className="product-card-meta">{product.productType}</p>
            ) : null}
          </Link>
          {lead ? <p className="product-feature-lead">{lead}</p> : null}
          {modelStrip}
        </div>
      </article>
    );
  }

  const inner = (
    <>
      {image && (
        <div className="product-card-media">
          <Image
            alt={image.altText || product.title}
            aspectRatio="1/1"
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 400px, 100vw"
          />
        </div>
      )}
      <div className="product-card-body">
        <div className="product-card-row">
          <h2 className="product-card-title">{product.title}</h2>
          <span className="product-card-price">
            <Money data={product.priceRange.minVariantPrice} />
          </span>
        </div>
        {'productType' in product && product.productType ? (
          <p className="product-card-meta">{product.productType}</p>
        ) : null}
      </div>
    </>
  );

  // Plain card — a single link wrapping the whole tile.
  if (!hasModels) {
    return (
      <Link className="product-card" prefetch="intent" to={variantUrl}>
        {inner}
      </Link>
    );
  }

  // Card with a model strip. The card chrome (border, hover lift) stays on
  // the outer element, but it can't be a <Link> — the chips are their own
  // links and nesting anchors is invalid HTML. So the tile body is one link
  // and each model is a sibling link below it.
  return (
    <div className="product-card has-models">
      <Link className="product-card-link" prefetch="intent" to={variantUrl}>
        {inner}
      </Link>
      {modelStrip}
    </div>
  );
}
