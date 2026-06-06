import {Link, useNavigate} from 'react-router';
import {type MappedProductOptions} from '@shopify/hydrogen';
import type {
  Maybe,
  ProductOptionValueSwatch,
} from '@shopify/hydrogen/storefront-api-types';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import type {ProductFragment} from 'storefrontapi.generated';

export function ProductForm({
  productOptions,
  selectedVariant,
  hideOptionNames,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
  /** Option names already handled elsewhere (e.g. the comparison ladder
   *  owns the line's primary axis), so the pill grid skips them and
   *  renders only the Add-to-cart button for that axis. */
  hideOptionNames?: string[];
}) {
  const navigate = useNavigate();
  const {open} = useAside();
  const ctaLabelAvailable = 'Add to cart';
  const ctaLabelSoldOut = 'Sold out';
  const hidden = new Set((hideOptionNames ?? []).map((n) => n.trim().toLowerCase()));
  return (
    <div className="product-form">
      {productOptions.map((option) => {
        // If there is only a single value in the option values, don't display the option
        if (option.optionValues.length === 1) return null;
        // Skip axes owned by another selector (the comparison ladder).
        if (hidden.has(option.name.trim().toLowerCase())) return null;

        return (
          <div key={option.name} className="mb-4">
            <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
              {option.name}
            </h3>
            <div className="product-options-grid">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                if (isDifferentProduct) {
                  // SEO
                  // When the variant is a combined listing child product
                  // that leads to a different url, we need to render it
                  // as an anchor tag
                  return (
                    <Link
                      className="product-options-item"
                      key={option.name + name}
                      prefetch="viewport"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      aria-label={name}
                      aria-current={selected ? 'page' : undefined}
                      style={{
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  // SEO
                  // When the variant is an update to the search param,
                  // render it as a button with javascript navigating to
                  // the variant so that SEO bots do not index these as
                  // duplicated links
                  return (
                    <button
                      type="button"
                      className={`product-options-item${
                        exists && !selected ? ' link' : ''
                      }`}
                      key={option.name + name}
                      style={{
                        opacity: available ? 1 : 0.3,
                      }}
                      disabled={!exists}
                      aria-label={name}
                      aria-pressed={selected}
                      onClick={() => {
                        if (!selected) {
                          void navigate(`?${variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </button>
                  );
                }
              })}
            </div>
            <br />
          </div>
        );
      })}
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        onClick={() => {
          open('cart');
        }}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                  selectedVariant,
                },
              ]
            : []
        }
      >
        {selectedVariant?.availableForSale ? ctaLabelAvailable : ctaLabelSoldOut}
      </AddToCartButton>
    </div>
  );
}

function ProductOptionSwatch({
  swatch,
  name,
}: {
  swatch?: Maybe<ProductOptionValueSwatch> | undefined;
  name: string;
}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <div
      aria-hidden="true"
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && (
        <img src={image} alt="" width={20} height={20} loading="lazy" decoding="async" />
      )}
    </div>
  );
}
