import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

export function ProductPrice({
  price,
  compareAtPrice,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
}) {
  return (
    <div className="font-mono text-2xl font-bold">
      {compareAtPrice ? (
        <div className="flex items-center gap-3">
          {price ? (
            <span className="text-[var(--color-gold)]">
              <Money data={price} />
            </span>
          ) : null}
          <s className="text-base text-[var(--color-text-muted)]">
            <Money data={compareAtPrice} />
          </s>
        </div>
      ) : price ? (
        <Money data={price} />
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}
