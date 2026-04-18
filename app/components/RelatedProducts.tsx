import {Suspense} from 'react';
import {Await} from 'react-router';
import {ProductItem} from '~/components/ProductItem';
import type {ProductItemFragment} from 'storefrontapi.generated';

export function RelatedProducts({
  recommendations,
}: {
  recommendations: Promise<ProductItemFragment[] | null>;
}) {
  return (
    <section className="related-products" aria-label="Related products">
      <h2 className="section-heading">You might also like</h2>
      <Suspense fallback={<RelatedSkeleton />}>
        <Await resolve={recommendations} errorElement={null}>
          {(items) => {
            if (!items || items.length === 0) return null;
            return (
              <div className="products-grid">
                {items.slice(0, 4).map((product) => (
                  <ProductItem key={product.id} product={product} />
                ))}
              </div>
            );
          }}
        </Await>
      </Suspense>
    </section>
  );
}

const SKELETON_IDS = ['s1', 's2', 's3', 's4'];

function RelatedSkeleton() {
  return (
    <div className="products-grid" aria-hidden="true">
      {SKELETON_IDS.map((id) => (
        <div key={id} className="product-card product-card-skeleton">
          <div className="aspect-square bg-[var(--color-bg-elevated)] animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-3/4 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
