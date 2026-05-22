import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {
  ProductItemFragment,
  CollectionItemFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';

export function ProductItem({
  product,
  loading,
}: {
  product: CollectionItemFragment | ProductItemFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  return (
    <Link
      className="product-card"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
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
        {('productType' in product && product.productType) ? (
          <p className="product-card-meta">{product.productType}</p>
        ) : null}
      </div>
    </Link>
  );
}
