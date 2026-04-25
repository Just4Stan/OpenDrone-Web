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
      className="product-card group"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
      {image && (
        <div className="aspect-square overflow-hidden bg-[var(--color-bg-elevated)]">
          <Image
            alt={image.altText || product.title}
            aspectRatio="1/1"
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 400px, 100vw"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-3">
        <h2 className="text-xs font-medium mb-0.5 group-hover:text-[var(--color-gold)] transition-colors leading-snug">
          {product.title}
        </h2>
        <p className="font-mono text-[12px] text-[var(--color-text-muted)]">
          <Money data={product.priceRange.minVariantPrice} />
        </p>
      </div>
    </Link>
  );
}
