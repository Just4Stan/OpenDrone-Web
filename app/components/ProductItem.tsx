import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import type {
  ProductItemFragment,
  CollectionItemFragment,
  RecommendedProductFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';

export function ProductItem({
  product,
  loading,
}: {
  product:
    | CollectionItemFragment
    | ProductItemFragment
    | RecommendedProductFragment;
  loading?: 'eager' | 'lazy';
}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  return (
    <Link
      className="group block bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg overflow-hidden hover:border-[var(--color-accent-light)]/30 transition-all duration-300"
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
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-4">
        <h4 className="text-sm font-medium mb-1 group-hover:text-[var(--color-gold)] transition-colors">
          {product.title}
        </h4>
        <p className="font-mono text-xs text-[var(--color-text-muted)]">
          <Money data={product.priceRange.minVariantPrice} />
        </p>
      </div>
    </Link>
  );
}
