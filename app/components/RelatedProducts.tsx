import {Suspense} from 'react';
import {Await, Link} from 'react-router';
import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {OptimisticCartLineInput} from '@shopify/hydrogen';
import {SmoothImage} from '~/components/SmoothImage';
import {AddToCartButton} from '~/components/AddToCartButton';
import {CompatBadge} from '~/components/slots/CompatBadge';
import {useAside} from '~/components/Aside';
import {useComingSoon} from '~/lib/coming-soon';
import {PRODUCT_CONTENT} from '~/lib/product-content';
import {PART_CATALOG, type PartDef} from '~/lib/builder/registry';

/** The slice of a product the related strip needs — matches what the
 *  recommendations + fallback queries in products.$handle.tsx select. */
export type RelatedProduct = {
  id: string;
  handle: string;
  title: string;
  productType?: string | null;
  featuredImage?: {
    id?: string | null;
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  priceRange: {
    minVariantPrice: MoneyV2;
    maxVariantPrice: MoneyV2;
  };
  variants?: {
    nodes: Array<{
      id: string;
      availableForSale: boolean;
      price: MoneyV2;
      image?: {url: string; altText?: string | null} | null;
      selectedOptions: Array<{name: string; value: string}>;
    }>;
  };
};

/** First clause of a spec cell — "AT32F421G8U7, 120 MHz" → "AT32F421G8U7". */
const clause = (s: string) => s.split(/[,(]/)[0].trim();

/**
 * One-line spec for a related card, composed from the product's editorial
 * spec table (product-content.ts): firmware project + MCU/radio when the
 * board has them, else the first spec rows, else the Shopify productType.
 * Derived, never invented — every cell already ships on the PDP.
 */
function specLineOf(p: RelatedProduct): string | null {
  const c = PRODUCT_CONTENT[p.handle];
  // No editorial file → the eyebrow already shows the productType; a second
  // identical line under the title would just stutter.
  if (!c) return null;
  const rows = c.specs ?? [];
  const cell = (key: string) =>
    rows.find(([k]) => k.toLowerCase() === key)?.[1];
  const parts: string[] = [];
  const fw = c.firmware?.project;
  if (fw && fw !== '—') parts.push(fw);
  const chip = cell('mcu') ?? cell('radio');
  if (chip) parts.push(clause(chip));
  if (parts.length === 0) {
    for (const [, v] of rows.slice(0, 2)) parts.push(clause(v));
  }
  return parts.slice(0, 2).join(' · ') || null;
}

/** Mono eyebrow in catalog-number language: "FILE 02 · FLIGHT CONTROLLER". */
function fileLineOf(p: RelatedProduct): string | null {
  const c = PRODUCT_CONTENT[p.handle];
  if (c && c.fileNumber !== '—') return `File ${c.fileNumber} · ${c.family}`;
  return p.productType ?? null;
}

/** Register document number — "OD-02" from the editorial file number. */
function docNoOf(p: RelatedProduct): string | null {
  const c = PRODUCT_CONTENT[p.handle];
  if (c && c.fileNumber !== '—') return `OD-${c.fileNumber}`;
  return null;
}

/** Product family for the register FAMILY cell (editorial, else Shopify type). */
function familyOf(p: RelatedProduct): string | null {
  return PRODUCT_CONTENT[p.handle]?.family ?? p.productType ?? null;
}

/** The first PART_CATALOG entry a handle maps to (for CompatBadge chips);
 *  null for handles the registry doesn't carry (kits/accessories). */
function partForHandle(handle: string): PartDef | null {
  return (
    PART_CATALOG.find(
      (p) => p.commerce.kind === 'shopify' && p.commerce.handle === handle,
    ) ?? null
  );
}

export function RelatedProducts({
  recommendations,
}: {
  recommendations: Promise<RelatedProduct[] | null>;
}) {
  return (
    <section className="related-products" aria-label="Related products">
      <h2 className="section-heading">Related hardware</h2>
      <Suspense fallback={<RelatedSkeleton />}>
        <Await resolve={recommendations} errorElement={null}>
          {(items) => {
            if (!items || items.length === 0) return null;
            return (
              <div className="related-register">
                {items.slice(0, 4).map((product) => (
                  <RelatedRow key={product.id} product={product} />
                ))}
              </div>
            );
          }}
        </Await>
      </Suspense>
    </section>
  );
}

function RelatedRow({product}: {product: RelatedProduct}) {
  const {open: openAside} = useAside();
  const comingSoon = useComingSoon(product.handle);
  const image = product.featuredImage;
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  const priced = parseFloat(min.amount) > 0;
  const fromPrice = priced && parseFloat(max.amount) > parseFloat(min.amount);
  const specLine = specLineOf(product);
  const docNo = docNoOf(product);
  const family = familyOf(product);
  const part = partForHandle(product.handle);

  // Quick-add only when the product has exactly ONE variant — a multi-model
  // line (FC/ESC/RX) must send the buyer to the PDP to pick a mount/model —
  // and never while the product is still gated coming-soon.
  const only =
    !comingSoon && product.variants?.nodes?.length === 1
      ? product.variants.nodes[0]
      : null;
  const lines: OptimisticCartLineInput[] = only
    ? [
        {
          merchandiseId: only.id,
          quantity: 1,
          selectedVariant: {
            id: only.id,
            title: product.title,
            availableForSale: only.availableForSale,
            price: only.price,
            image: only.image ?? product.featuredImage ?? null,
            product: {title: product.title, handle: product.handle},
            selectedOptions: only.selectedOptions ?? [],
          } as unknown as NonNullable<
            OptimisticCartLineInput['selectedVariant']
          >,
        },
      ]
    : [];

  return (
    <div
      className={`related-row register-row edge-light edge-light-wash${
        only ? ' has-quickadd' : ''
      }`}
    >
      <Link
        className="related-row-link"
        prefetch="viewport"
        viewTransition
        to={`/products/${product.handle}`}
      >
        {docNo ? <span className="related-row-doc doc-annot">{docNo}</span> : null}
        <span
          className={`related-row-thumb${image ? '' : ' hatch'}`}
          aria-hidden="true"
        >
          {image ? (
            <SmoothImage
              alt={image.altText || product.title}
              aspectRatio="1/1"
              data={image}
              loading="lazy"
              sizes="96px"
            />
          ) : null}
        </span>
        <span className="related-row-main">
          <span className="related-row-title">{product.title}</span>
          {specLine ? (
            <span className="related-row-spec doc-cell">{specLine}</span>
          ) : null}
        </span>
        {family ? (
          <span className="related-row-family doc-label">{family}</span>
        ) : null}
        {part ? (
          <CompatBadge part={part} className="related-row-compat" />
        ) : null}
        {/* Price is gated on coming-soon exactly like ProductItem's
            showPrice — useComingSoon() is fail-closed (defaults locked when
            root data is missing), so a locked shop never leaks a number. */}
        <span className="related-row-price doc-cell">
          {priced && !comingSoon ? (
            <>
              {fromPrice ? (
                <span className="related-row-from">from</span>
              ) : null}
              <Money as="span" data={min} />
            </>
          ) : (
            <span>&nbsp;</span>
          )}
        </span>
      </Link>
      {only ? (
        <div className="related-row-quickadd">
          <AddToCartButton
            className="product-card-quickadd-btn"
            lines={lines}
            disabled={!only.availableForSale}
            flyImage={only.image?.url ?? product.featuredImage?.url ?? null}
            onClick={() => openAside('cart')}
          >
            Add to cart
          </AddToCartButton>
        </div>
      ) : null}
    </div>
  );
}

const SKELETON_IDS = ['s1', 's2', 's3', 's4'];

function RelatedSkeleton() {
  return (
    <div className="related-register" aria-hidden="true">
      {SKELETON_IDS.map((id) => (
        <div key={id} className="related-row register-row related-row-skeleton">
          <span className="related-row-thumb animate-pulse" />
          <span className="related-row-main">
            <span className="h-4 w-3/4 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
            <span className="h-3 w-1/3 bg-[var(--color-bg-elevated)] rounded animate-pulse" />
          </span>
        </div>
      ))}
    </div>
  );
}
