import type {ProductVariantFragment} from 'storefrontapi.generated';
import {Image} from '@shopify/hydrogen';

export function ProductImage({
  image,
}: {
  image: ProductVariantFragment['image'];
}) {
  if (!image) {
    return (
      <div className="aspect-square bg-[var(--color-bg-elevated)] flex items-center justify-center">
        <span className="font-mono text-xs text-[var(--color-text-muted)]">
          No image
        </span>
      </div>
    );
  }
  return (
    <div className="aspect-square">
      <Image
        alt={image.altText || 'Product Image'}
        aspectRatio="1/1"
        data={image}
        key={image.id}
        sizes="(min-width: 45em) 50vw, 100vw"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
