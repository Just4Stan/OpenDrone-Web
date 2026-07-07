import {useCallback} from 'react';
import {Link} from 'react-router';
import {Money} from '@shopify/hydrogen';
import {SmoothImage} from './SmoothImage';
import {ProductGhostTile} from './ProductGhostTile';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import type {
  ProductItemFragment,
  CollectionItemFragment,
} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {useComingSoon} from '~/lib/coming-soon';
import {AddToCartButton} from './AddToCartButton';
import {StackQuickAdd, type StackOffer} from './StackQuickAdd';
import {useAside} from './Aside';
import {CompatBadge} from './slots/CompatBadge';
import {PRODUCT_CONTENT} from '~/lib/product-content';
import type {PartDef} from '~/lib/builder/registry';

/** Hover quick-add for catalog cards: the card's own variant prewired as a
 *  cart line, so ordering never requires opening the PDP. */
export type ProductQuickAdd = {
  lines: import('@shopify/hydrogen').OptimisticCartLineInput[];
  available: boolean;
  flyImage?: string | null;
};

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

/** First clause of a spec cell — "AT32F421G8U7, 120 MHz" → "AT32F421G8U7". */
const specClause = (s: string) => s.split(/[,(]/)[0].trim();

/**
 * One-line spec for a register row, composed from the product's editorial
 * spec table: firmware project + MCU/radio when present, else the first spec
 * rows. Derived from PRODUCT_CONTENT — never authored prose.
 */
function registerSpecLine(handle: string): string | null {
  const c = PRODUCT_CONTENT[handle];
  if (!c) return null;
  const rows = c.specs ?? [];
  const cell = (key: string) =>
    rows.find(([k]) => k.toLowerCase() === key)?.[1] ?? null;
  const parts: string[] = [];
  const fw = c.firmware?.project;
  if (fw && fw !== '—') parts.push(fw);
  const chip = cell('mcu') ?? cell('radio');
  if (chip) parts.push(specClause(chip));
  if (parts.length === 0) {
    for (const [, v] of rows.slice(0, 2)) if (v) parts.push(specClause(v));
  }
  return parts.slice(0, 2).join(' · ') || null;
}

/** Document number for a register row — "OD-02" from PRODUCT_CONTENT's
 *  fileNumber, or "—" when the product has no editorial file. */
function registerDocNo(handle: string): string {
  const n = PRODUCT_CONTENT[handle]?.fileNumber;
  return n && n !== '—' ? `OD-${n}` : '—';
}

/** Family label — the editorial family, else the Shopify productType. */
function registerFamily(handle: string, productType?: string | null): string | null {
  return PRODUCT_CONTENT[handle]?.family ?? productType ?? null;
}

export function ProductItem({
  product,
  loading,
  models,
  feature,
  variant = 'card',
  compatPart,
  isNew,
  onSale,
  to,
  title,
  priceOverride,
  imageOverride,
  comingSoon,
  quickAdd,
  stackOffers,
  lead,
}: {
  product: CollectionItemFragment | ProductItemFragment;
  loading?: 'eager' | 'lazy';
  models?: ProductModelChip[];
  /** Rendering mode. `card` is the classic browse tile; `register` is the
   *  ruled parts-register row used by the /collections/all register. */
  variant?: 'card' | 'register';
  /** Registry part backing this row, when the handle maps to a build slot —
   *  drives the CompatBadge chips on register rows. Render nothing when
   *  absent (non-parts: kits, spares, accessories). */
  compatPart?: PartDef;
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
  /** Hover quick-add: adds this card's variant without opening the PDP. */
  quickAdd?: ProductQuickAdd;
  /** Stack offers layered on the quick-add (FC/ESC cards): hovering the add
   *  button also offers the size-matched pair in one click. */
  stackOffers?: StackOffer[];
}) {
  const variantUrl = useVariantUrl(product.handle);
  const {open: openAside} = useAside();

  // Cursor-tracked gold spotlight (same recipe as .related-card): write the
  // pointer position into CSS vars the card's ::after radial reads. Mouse
  // only — touch/pen never hover — and the ::after itself is gated behind
  // @media (hover: hover) in app.css, so this is a no-op on touch devices.
  const onSpotMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
  }, []);
  const url = to ?? variantUrl;
  const displayTitle = title ?? product.title;
  const price = priceOverride ?? product.priceRange.minVariantPrice;
  const image = imageOverride ?? product.featuredImage;
  const hasModels = Boolean(models && models.length > 0);

  // Product-level coming-soon (PUBLIC_COMING_SOON / per-SKU override):
  // unlike the `comingSoon` prop (unreleased tier, non-clickable tile) the
  // card stays clickable — the PDP hosts the notify-at-launch signup — but
  // shows no price and no quick-add.
  const launchPending = useComingSoon(product.handle);
  const showPrice = !launchPending;

  // ── Register row — the ruled parts-register rendering (/collections/all).
  // A flat hairline-separated row instead of a card: doc number, square
  // thumb (dot-grid or hatch), title + spec line, family, CompatBadge chips,
  // status tag, price (fail-closed gated) and a hover/focus quick-add cell.
  if (variant === 'register') {
    const docNo = registerDocNo(product.handle);
    const family = registerFamily(
      product.handle,
      'productType' in product ? product.productType : null,
    );
    const specLine = registerSpecLine(product.handle);
    // NEW / SALE tags only — the coming-soon state is already stated by the
    // price cell, so a second "Coming soon" chip would just be noise.
    const statusTag = onSale ? 'Sale' : isNew ? 'New' : null;
    // Fail-closed price gate — never a numeral on a coming-soon row.
    const showRegPrice = showPrice && !comingSoon;
    const priceNode = () =>
      showRegPrice ? (
        <Money data={price} />
      ) : (
        <span className="register-soon">Coming soon</span>
      );

    const thumb = (
      <span
        className={`register-thumb${image ? '' : ' is-empty'} dot-grid`}
        aria-hidden="true"
      >
        {image ? (
          <SmoothImage
            alt={image.altText || displayTitle}
            aspectRatio="1/1"
            data={image}
            loading={loading}
            sizes="96px"
          />
        ) : (
          <span className="register-hatch hatch" />
        )}
      </span>
    );
    // Desktop hover plate — a larger render in a dot-grid callout panel.
    const plate =
      image && !comingSoon ? (
        <span className="register-plate dot-grid" aria-hidden="true">
          <SmoothImage
            alt=""
            aspectRatio="1/1"
            data={image}
            loading="lazy"
            sizes="220px"
          />
        </span>
      ) : null;

    const rowInner = (
      <>
        <span className="register-doc doc-annot">{docNo}</span>
        {thumb}
        {plate}
        <span className="register-titlecol">
          <span className="register-titlerow">
            <span className="register-title">{displayTitle}</span>
            <span className="register-price is-inline doc-cell">
              {priceNode()}
            </span>
          </span>
          {specLine ? (
            <span className="register-spec doc-annot">{specLine}</span>
          ) : null}
        </span>
        {family ? (
          <span className="register-family doc-annot">{family}</span>
        ) : null}
        {compatPart ? (
          <span className="register-compat">
            <CompatBadge part={compatPart} />
          </span>
        ) : null}
        {statusTag ? (
          <span
            className={`register-tag${
              statusTag === 'Sale' ? ' is-sale' : ' is-new'
            }`}
          >
            {statusTag}
          </span>
        ) : null}
        <span className="register-price is-trailing doc-cell">
          {priceNode()}
        </span>
      </>
    );

    // Unreleased tier — a non-interactive row (nothing to open or buy yet).
    if (comingSoon) {
      return (
        <div
          className="register-row register-row-wrap is-comingsoon"
          aria-disabled="true"
        >
          {rowInner}
        </div>
      );
    }

    const regQuickAdd =
      quickAdd && !launchPending ? (
        <div className="register-quickadd">
          <StackQuickAdd
            offers={stackOffers ?? []}
            flyImage={quickAdd.flyImage}
            onAdd={() => openAside('cart')}
          >
            <AddToCartButton
              className="register-add-btn keycap"
              lines={quickAdd.lines}
              disabled={!quickAdd.available}
              flyImage={quickAdd.flyImage}
              onClick={() => openAside('cart')}
            >
              <span className="register-add-plus" aria-hidden="true">
                +
              </span>
              <span className="register-add-label">Add to cart</span>
            </AddToCartButton>
          </StackQuickAdd>
        </div>
      ) : null;

    return (
      <div className="register-row register-row-wrap edge-light edge-light-wash">
        <Link
          className="register-link"
          prefetch="viewport"
          viewTransition
          to={url}
        >
          {rowInner}
        </Link>
        {regQuickAdd}
      </div>
    );
  }

  // Quick-add overlay: revealed on card hover (always visible on touch).
  // Rendered as a SIBLING of the card link, never inside it — a form inside
  // an anchor is invalid HTML and hijacks the navigation click.
  const quickAddNode =
    quickAdd && !comingSoon && !launchPending && !feature ? (
      <div className="product-card-quickadd">
        <StackQuickAdd
          offers={stackOffers ?? []}
          flyImage={quickAdd.flyImage}
          onAdd={() => openAside('cart')}
        >
          <AddToCartButton
            className="product-card-quickadd-btn"
            lines={quickAdd.lines}
            disabled={!quickAdd.available}
            flyImage={quickAdd.flyImage}
            onClick={() => openAside('cart')}
          >
            Add to cart
          </AddToCartButton>
        </StackQuickAdd>
      </div>
    ) : null;

  const badge = comingSoon || launchPending ? (
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
          {image ? (
            <SmoothImage
              alt={image.altText || product.title}
              data={image}
              loading={loading}
              sizes="(min-width: 64em) 340px, 100vw"
            />
          ) : (
            <ProductGhostTile
              type={('productType' in product && product.productType) || null}
              title={product.title}
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
              {showPrice ? (
                <span className="product-card-price">
                  <Money data={product.priceRange.minVariantPrice} />
                </span>
              ) : null}
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
      <div className={`product-card-media${image ? '' : ' is-empty'}`}>
        {badge}
        {image ? (
          <SmoothImage
            alt={image.altText || product.title}
            aspectRatio="1/1"
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 400px, 100vw"
          />
        ) : (
          <ProductGhostTile
            type={('productType' in product && product.productType) || null}
            title={displayTitle}
          />
        )}
      </div>
      <div className="product-card-body">
        <div className="product-card-row">
          <h2 className="product-card-title">{displayTitle}</h2>
          {showPrice ? (
            <span className="product-card-price">
              <Money data={price} />
            </span>
          ) : null}
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

  // Plain card — a single link wrapping the whole tile. With a quick-add the
  // wrapper becomes a div (the add button can't nest inside the anchor).
  if (!hasModels) {
    if (quickAddNode) {
      return (
        <div className="product-card has-quickadd" onPointerMove={onSpotMove}>
          <Link
            className="product-card-link"
            prefetch="viewport"
            viewTransition
            to={url}
          >
            {inner}
          </Link>
          {quickAddNode}
        </div>
      );
    }
    return (
      <Link
        className="product-card"
        prefetch="viewport"
        viewTransition
        to={url}
        onPointerMove={onSpotMove}
      >
        {inner}
      </Link>
    );
  }

  // Card with a model strip. The card chrome (border, hover lift) stays on
  // the outer element, but it can't be a <Link prefetch="viewport"> — the chips are their own
  // links and nesting anchors is invalid HTML. So the tile body is one link
  // and each model is a sibling link below it.
  return (
    <div
      className={`product-card has-models${quickAddNode ? ' has-quickadd' : ''}`}
      onPointerMove={onSpotMove}
    >
      <Link
        className="product-card-link"
        prefetch="viewport"
        viewTransition
        to={variantUrl}
      >
        {inner}
      </Link>
      {quickAddNode}
      {modelStrip}
    </div>
  );
}

/**
 * Styles for the parts-register rendering path (ProductItem variant="register").
 * Scoped under `.catalog-register` so it overrides the classic catalog defaults
 * in app.css without touching that file (parallel-lane safe) and never leaks to
 * other product-card consumers. Rendered once by the catalog route.
 */
export const REGISTER_STYLES = `
.catalog-register .parts-register {
  border-top: 1px solid var(--color-hairline);
}
.catalog-register .register-row-wrap {
  gap: var(--sp-4);
  min-height: 92px;
  padding-block: var(--sp-3);
  padding-inline: var(--sp-2);
  position: relative;
}
.catalog-register .register-link {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  flex: 1 1 auto;
  min-width: 0;
  text-decoration: none;
  color: var(--color-text);
}
.catalog-register .register-doc {
  flex: 0 0 auto;
  width: 62px;
  transition: color 0.18s ease;
}
.catalog-register .register-row-wrap:hover .register-doc,
.catalog-register .register-row-wrap:focus-within .register-doc {
  color: var(--color-gold);
}
.catalog-register .register-thumb {
  position: relative;
  flex: 0 0 auto;
  width: 96px;
  height: 96px;
  border: 1px solid var(--color-hairline);
  border-radius: var(--r-xs);
  overflow: hidden;
  background-color: var(--color-bg-elevated);
}
.catalog-register .register-thumb.is-empty {
  background-color: var(--color-bg);
}
.catalog-register .register-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.catalog-register .register-hatch {
  position: absolute;
  inset: 0;
}
.catalog-register .register-plate {
  display: none;
}
@media (hover: hover) and (min-width: 900px) {
  .catalog-register .register-plate {
    display: block;
    position: absolute;
    left: 70px;
    bottom: calc(100% + 6px);
    width: 220px;
    height: 220px;
    padding: 10px;
    border: 1px solid var(--color-hairline);
    background-color: var(--pod-bg-strong);
    box-shadow: var(--pod-shadow);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.16s ease, transform 0.16s ease;
    pointer-events: none;
    z-index: 30;
  }
  .catalog-register .register-plate img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .catalog-register .register-row-wrap:hover .register-plate {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .catalog-register .register-plate {
    transition: none;
  }
}
.catalog-register .register-titlecol {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.catalog-register .register-titlerow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
}
.catalog-register .register-title {
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.catalog-register .register-spec {
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.catalog-register .register-family {
  flex: 0 0 auto;
  width: 130px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.catalog-register .register-compat {
  flex: 0 0 auto;
}
.catalog-register .register-tag {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 2px 6px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--r-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}
.catalog-register .register-tag.is-new {
  color: var(--color-gold);
  border-color: var(--color-gold);
}
.catalog-register .register-tag.is-sale {
  color: var(--color-stock);
  border-color: var(--color-stock);
}
.catalog-register .register-price {
  flex: 0 0 auto;
  color: var(--color-text);
}
.catalog-register .register-price.is-trailing {
  width: 112px;
  text-align: right;
}
.catalog-register .register-price.is-inline {
  display: none;
}
.catalog-register .register-soon {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
}
.catalog-register .register-quickadd {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-left: var(--sp-3);
  border-left: 1px solid var(--color-hairline-faint);
  align-self: stretch;
}
.catalog-register .register-add-btn {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  padding: 0.4rem 0.9rem;
  min-height: 36px;
  background: var(--color-gold);
  color: var(--color-on-accent);
  border: none;
  border-radius: var(--r-sm);
  box-shadow: var(--pod-shadow);
  cursor: pointer;
  white-space: nowrap;
}
.catalog-register .register-add-btn:hover {
  background: var(--color-gold-hover);
}
.catalog-register .register-add-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
.catalog-register .register-add-plus {
  display: none;
}
@media (hover: hover) {
  .catalog-register .register-add-btn {
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
  .catalog-register .register-row-wrap:hover .register-add-btn,
  .catalog-register .register-row-wrap:focus-within .register-add-btn {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .catalog-register .register-add-btn {
    transition: none;
  }
}
.catalog-register .register-row-wrap.is-comingsoon {
  opacity: 0.6;
  pointer-events: none;
}
.catalog-register .register-row-wrap.is-comingsoon .register-thumb img {
  filter: grayscale(0.6);
}
@media (max-width: 1099px) {
  .catalog-register .register-compat {
    display: none;
  }
}
@media (max-width: 899px) {
  .catalog-register .register-family {
    display: none;
  }
}
@media (max-width: 767px) {
  .catalog-register .register-link {
    gap: var(--sp-3);
  }
  .catalog-register .register-row-wrap {
    min-height: 56px;
    padding-block: var(--sp-2);
    gap: var(--sp-3);
  }
  .catalog-register .register-doc {
    width: 52px;
    align-self: flex-start;
    padding-top: 2px;
  }
  .catalog-register .register-thumb {
    width: 64px;
    height: 64px;
  }
  .catalog-register .register-titlerow {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .catalog-register .register-title {
    white-space: normal;
  }
  .catalog-register .register-price.is-trailing {
    display: none;
  }
  .catalog-register .register-price.is-inline {
    display: inline-flex;
  }
  .catalog-register .register-tag {
    display: none;
  }
  .catalog-register .register-quickadd {
    border-left: 0;
    padding-left: var(--sp-2);
  }
  .catalog-register .register-add-btn {
    opacity: 1 !important;
    transform: none !important;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    display: grid;
    place-items: center;
  }
  .catalog-register .register-add-plus {
    display: block;
    font-size: 1.4rem;
    line-height: 1;
  }
  .catalog-register .register-add-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
}
@media (prefers-reduced-motion: no-preference) {
  .catalog-register .parts-register > * {
    animation: grid-card-in 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
    animation-delay: 0.22s;
  }
  .catalog-register .parts-register > *:nth-child(1) { animation-delay: 0.02s; }
  .catalog-register .parts-register > *:nth-child(2) { animation-delay: 0.06s; }
  .catalog-register .parts-register > *:nth-child(3) { animation-delay: 0.1s; }
  .catalog-register .parts-register > *:nth-child(4) { animation-delay: 0.14s; }
  .catalog-register .parts-register > *:nth-child(5) { animation-delay: 0.18s; }
}
/* Category rail — mono index with derived counts, gold-underline active. */
.catalog-register .catalog-filter {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-hairline-faint);
  position: relative;
}
.catalog-register .catalog-filter-count {
  flex: 0 0 auto;
  color: var(--color-text-dim);
}
.catalog-register .catalog-filter.is-active {
  color: var(--color-gold);
  font-weight: 600;
}
.catalog-register .catalog-filter.is-active .catalog-filter-count {
  color: var(--color-gold);
}
.catalog-register .catalog-filter.is-active::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 100%;
  height: 2px;
  background: var(--color-gold);
}
@media (max-width: 899px) {
  .catalog-register .catalog-filter {
    border: 1px solid var(--color-hairline);
    border-radius: var(--r-xs);
    padding: 0.4rem 0.7rem;
    justify-content: flex-start;
  }
  .catalog-register .catalog-filter.is-active {
    border-color: var(--color-gold);
    background: transparent;
    color: var(--color-gold);
  }
  .catalog-register .catalog-filter.is-active::after {
    display: none;
  }
}
`;
