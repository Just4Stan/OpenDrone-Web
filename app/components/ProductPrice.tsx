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
    <span className="product-price">
      {compareAtPrice ? (
        <span className="product-price-row">
          {price ? (
            <span className="product-price-sale">
              <Money data={price} />
            </span>
          ) : null}
          <s className="product-price-compare">
            <Money data={compareAtPrice} />
          </s>
        </span>
      ) : price ? (
        <Money data={price} />
      ) : (
        <span>&nbsp;</span>
      )}
    </span>
  );
}
