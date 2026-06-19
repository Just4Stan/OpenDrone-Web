import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
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
  isNew,
  onSale,
  to,
  title,
  priceOverride,
  imageOverride,
  comingSoon,
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
  /** Corner badge — recently added product. */
  isNew?: boolean;
  /** Corner badge — listed below its compare-at price. */
  onSale?: boolean;
  /** Link override — used by per-variant cards to deep-link the PDP with a
   *  model preselected (`?Model=…`) instead of the bare product URL. */
  to?: string;
  /** Display-title override — used by per-variant cards (e.g. "OpenRX Gemini"
   *  instead of just "OpenRX"). */
  title?: string;
  /** Price override — the specific variant's price for per-variant cards. */
  priceOverride?: MoneyV2;
  /** Image override — the specific variant's image for per-variant cards.
   *  Without it every tier card falls back to the product's featuredImage
   *  (the first uploaded render), so 20×20 and 30×30 show the same board. */
  imageOverride?: CollectionItemFragment['featuredImage'];
  /** Unreleased product — renders greyed and non-clickable with a "Coming
   *  soon" badge instead of a link (nothing to buy or open yet). */
  comingSoon?: boolean;
}) {
  const variantUrl = useVariantUrl(product.handle);
  const url = to ?? variantUrl;
  const displayTitle = title ?? product.title;
  const price = priceOverride ?? product.priceRange.minVariantPrice;
  const image = imageOverride ?? product.featuredImage;
  const hasModels = Boolean(models && models.length > 0);

  const badge = comingSoon ? (
    <span className="product-card-badge is-soon">Coming soon</span>
  ) : onSale ? (
    <span className="product-card-badge is-sale">Sale</span>
  ) : isNew ? (
    <span className="product-card-badge is-new">New</span>
  ) : null;

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
            prefetch="viewport"
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
          prefetch="viewport"
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
            prefetch="viewport"
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
          {badge}
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
          <h2 className="product-card-title">{displayTitle}</h2>
          <span className="product-card-price">
            <Money data={price} />
          </span>
        </div>
        {'productType' in product && product.productType ? (
          <p className="product-card-meta">{product.productType}</p>
        ) : null}
      </div>
    </>
  );

  // Unreleased — a non-interactive tile (nothing to open or buy yet).
  if (comingSoon) {
    return (
      <div className="product-card is-comingsoon" aria-disabled="true">
        {inner}
      </div>
    );
  }

  // Plain card — a single link wrapping the whole tile.
  if (!hasModels) {
    return (
      <Link className="product-card" prefetch="viewport" viewTransition to={url}>
        {inner}
      </Link>
    );
  }

  // Card with a model strip. The card chrome (border, hover lift) stays on
  // the outer element, but it can't be a <Link prefetch="viewport"> — the chips are their own
  // links and nesting anchors is invalid HTML. So the tile body is one link
  // and each model is a sibling link below it.
  return (
    <div className="product-card has-models">
      <Link
        className="product-card-link"
        prefetch="viewport"
        viewTransition
        to={variantUrl}
      >
        {inner}
      </Link>
      {modelStrip}
    </div>
  );
}
