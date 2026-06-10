import {Suspense, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  Await,
  Link,
  useLoaderData,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {RelatedProducts} from '~/components/RelatedProducts';
import {FirmwareSplit} from '~/components/FirmwareSplit';
import {VariantLadder} from '~/components/VariantLadder';
import {BoardArt} from '~/components/BoardArt';
import {SchematicViewer} from '~/components/SchematicViewer';
import type {FrameViewerProps} from '~/components/FrameViewer';
import {SceneErrorBoundary} from '~/components/SceneErrorBoundary';
import {ProvenanceCard} from '~/components/ProvenanceCard';
import {BrandName} from '~/components/BrandName';
import {CommitHistoryCard, LatestCommitCard} from '~/components/LatestCommit';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {buildSeoMeta, buildProductJsonLd} from '~/lib/seo';
import {fetchLatestCommits} from '~/lib/github';
import {
  PRODUCT_CONTENT,
  PRODUCT_CONTENT_FALLBACK,
} from '~/lib/product-content';
import type {
  DownloadAsset,
  DownloadKind,
  ProductContent,
} from '~/lib/product-content';

export const meta: Route.MetaFunction = ({data}) =>
  buildSeoMeta({
    title: data?.product?.seo?.title || data?.product?.title || 'Product',
    description:
      data?.product?.seo?.description || data?.product?.description || undefined,
    image: data?.product?.selectedOrFirstAvailableVariant?.image?.url,
    type: 'product',
  });

/**
 * Selecting a SKU only mutates this PDP's option query params (e.g. ?Model=…).
 * Skip the loader on those same-path navigations: re-running it means a
 * Shopify round-trip plus a full PDP re-render (3D viewer, chapters, deferred
 * recommendations) on every click — the source of the variant-switch lag. The
 * variant is resolved client-side from the already-loaded data instead.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context, params, request}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  // Bundle products (OpenStack) render from their own product but add the
  // *component* variants to cart. Fetch those components' variants in parallel
  // so the buy module can resolve the FC + ESC variant for the chosen size.
  const bundleHandles =
    PRODUCT_CONTENT[handle]?.bundle?.components.map((c) => c.handle) ?? [];

  const [{product}, ...bundleResults] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    ...bundleHandles.map((h) =>
      storefront
        .query(BUNDLE_COMPONENT_QUERY, {variables: {handle: h}})
        .catch(() => null),
    ),
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  const bundleProducts = bundleResults
    .map((r) => r?.product)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return {
    product,
    bundleProducts,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: Route.LoaderArgs) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    return {
      recommendations: Promise.resolve(null),
      latestCommits: Promise.resolve([]),
    };
  }

  // Latest-commit fetch is best-effort: if GitHub rate-limits us or
  // a repo moves, we render the PDP without the card rather than
  // failing the page.
  const content = PRODUCT_CONTENT[handle];
  const repoUrls: string[] = [];
  if (content) {
    if (content.bundle) {
      for (const c of content.bundle.components) {
        const sub = PRODUCT_CONTENT[c.handle];
        if (sub?.repoUrl) repoUrls.push(sub.repoUrl);
      }
    } else if (content.repoUrl) {
      repoUrls.push(content.repoUrl);
    }
  }
  const latestCommits = fetchLatestCommits(repoUrls).catch(() => []);

  // Shopify's productRecommendations returns [] for new stores with no
  // purchase history. Fall back to "other products from the catalog" so
  // the You-might-also-like strip is never empty.
  const recommendations = storefront
    .query(PRODUCT_RECOMMENDATIONS_QUERY, {
      variables: {handle},
    })
    .then(async (res) => {
      const rec = res?.productRecommendations;
      if (rec && rec.length > 0) return rec;
      const fallback = await storefront
        .query(FALLBACK_PRODUCTS_QUERY, {variables: {first: 8}})
        .catch(() => null);
      const items = fallback?.products?.nodes ?? [];
      return items.filter((p) => p.handle !== handle).slice(0, 4);
    })
    .catch(() => null);

  return {recommendations, latestCommits};
}

const DOWNLOAD_ICONS: Record<DownloadKind, string> = {
  schematic: '▱',
  step: '⬢',
  bom: '☰',
  gerber: '▦',
  manual: '✎',
  wiring: '⎔',
  flash: '⚡',
  changelog: '↻',
  sbom: '◫',
  firmware_manifest: '⌘',
  other: '↓',
};

function DownloadsGrid({downloads}: {downloads: DownloadAsset[]}) {
  if (downloads.length === 0) return null;
  return (
    <div className="downloads-grid">
      {downloads.map((d) => (
        <a
          key={d.href}
          href={d.href}
          target="_blank"
          rel="noopener noreferrer"
          className="download-card"
        >
          <span className="download-icon" aria-hidden="true">
            {DOWNLOAD_ICONS[d.kind] ?? DOWNLOAD_ICONS.other}
          </span>
          <span className="download-label">{d.label}</span>
          {d.note ? <span className="download-note">{d.note}</span> : null}
          {d.size ? <span className="download-size">{d.size}</span> : null}
          <span className="download-cta" aria-hidden="true">
            Download ↗
          </span>
        </a>
      ))}
    </div>
  );
}

type ChapterNumbers = {
  teardown?: string;
  openSource: string;
  inTheBox?: string;
  firmware?: string;
  specs?: string;
  downloads?: string;
};

/** Compute chapter numbers that stay contiguous when any chapter is hidden. */
function computeChapterNumbers(
  content: ProductContent,
  includeOpenSource = true,
): ChapterNumbers {
  let n = 1;
  const pad = (x: number) => x.toString().padStart(2, '0');
  const out: ChapterNumbers = {openSource: ''};

  if (content.teardown) {
    out.teardown = pad(n++);
  }
  // Accessories (fallback content) aren't open-hardware products — they get
  // no "Open for learning" chapter, so don't burn a chapter number on it.
  if (includeOpenSource) {
    out.openSource = pad(n++);
  }
  if (content.inTheBox.length > 0 || content.bundle) {
    out.inTheBox = pad(n++);
  }
  if (
    !content.bundle &&
    content.firmware.project &&
    content.firmware.project !== '—'
  ) {
    out.firmware = pad(n++);
  }
  if (content.specs.length > 0) {
    out.specs = pad(n++);
  }
  if (content.downloads.length > 0) {
    out.downloads = pad(n++);
  }
  return out;
}

/**
 * Merge a variant's spec deltas over the product's shared spec table,
 * matched by row key. A delta value of `null` hides the base row (e.g. the
 * cost-down Lite drops a sensor the standard board carries); a value
 * replaces the base row in place; an unknown key appends. Keeps every
 * tier's table coherent off one base instead of duplicating shared rows.
 */
function mergeSpecs(
  base: Array<[string, string]>,
  overrides?: Array<[string, string | null]>,
): Array<[string, string]> {
  if (!overrides?.length) return base;
  const out: Array<[string, string]> = base.map(([k, v]) => [k, v]);
  for (const [k, v] of overrides) {
    const idx = out.findIndex(([bk]) => bk === k);
    if (v === null) {
      if (idx !== -1) out.splice(idx, 1);
    } else if (idx !== -1) {
      out[idx] = [k, v];
    } else {
      out.push([k, v]);
    }
  }
  return out;
}

/**
 * Client-only loader for the exploded 3D frame viewer. The viewer pulls in
 * three.js + @react-three/fiber, so — like the homepage's HeroScene — we
 * code-split it and import it in the browser only, keeping the r3f runtime
 * out of the server render and the PDP's initial chunk.
 */
function ClientFrameViewer(props: FrameViewerProps) {
  const [Viewer, setViewer] = useState<React.ComponentType<FrameViewerProps> | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    void import('~/components/FrameViewer').then((m) => {
      if (alive) setViewer(() => m.FrameViewer);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!Viewer) return null;
  return <Viewer {...props} />;
}

/** Placeholder media slot. Renders a soft card with a geometric icon
 *  picked from `kind` until real images are wired in. */
function ChapterMediaPlaceholder({kind}: {kind: string}) {
  return (
    <div className="chapter-media-frame" aria-hidden="true">
      <svg
        viewBox="0 0 120 120"
        className="chapter-media-glyph"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === '01' ? (
          <>
            <rect x="22" y="22" width="76" height="76" rx="6" />
            <circle cx="36" cy="36" r="3" />
            <circle cx="84" cy="36" r="3" />
            <circle cx="36" cy="84" r="3" />
            <circle cx="84" cy="84" r="3" />
            <path d="M44 60h32M60 44v32" />
          </>
        ) : kind === '02' ? (
          <>
            <path d="M30 32h60v56H30z" />
            <path d="M30 32l30 18 30-18" />
            <path d="M60 50v38" />
          </>
        ) : kind === '03' ? (
          <>
            <path d="M24 38l36-14 36 14v44L60 96 24 82z" />
            <path d="M24 38l36 14 36-14" />
            <path d="M60 52v44" />
          </>
        ) : kind === '04' ? (
          <>
            <circle cx="60" cy="60" r="34" />
            <path d="M50 50h20M50 70h20M55 50v20M65 50v20" />
          </>
        ) : kind === '05' ? (
          <>
            <rect x="26" y="26" width="68" height="68" rx="4" />
            <path d="M26 46h68M26 66h68M26 86h68" />
            <path d="M46 26v68M66 26v68" />
          </>
        ) : (
          <>
            <path d="M30 32h60v56H30z" />
            <path d="M40 56l12 12 28-28" />
          </>
        )}
      </svg>
    </div>
  );
}

function Chapter({
  number,
  label,
  title,
  children,
  media,
  backdrop,
  wideMedia,
  bigMedia,
  noMedia,
}: {
  number: string;
  label: string;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Optional live media node — when omitted, the chapter renders the
   *  geometric placeholder glyph for this chapter number. */
  media?: React.ReactNode;
  /** Optional full-bleed, non-interactive layer rendered behind the chapter
   *  content (the exploded frame viewer). When set, the right-hand media
   *  slot is dropped and the text sits on top of this layer. */
  backdrop?: React.ReactNode;
  /** Flip the column split so the media takes most of the width and the text
   *  column narrows — used for the wide schematic viewer. */
  wideMedia?: boolean;
  /** Even the column split 50/50 so the media takes half the chapter width —
   *  used for the in-the-box parts shot. */
  bigMedia?: boolean;
  /** Drop the media column entirely so the body spans full width — used by
   *  chapters whose content (e.g. the spec table) needs no image. */
  noMedia?: boolean;
}) {
  return (
    <section
      className="chapter"
      data-chapter={number}
      data-backdrop={backdrop ? '' : undefined}
      data-wide-media={wideMedia ? '' : undefined}
      data-big-media={bigMedia ? '' : undefined}
      data-no-media={noMedia ? '' : undefined}
    >
      {backdrop ? <div className="chapter-backdrop">{backdrop}</div> : null}
      <div className="chapter-index">
        <span className="chapter-number">{number}</span>
        <span className="chapter-label">{label}</span>
      </div>
      <div className="chapter-body-col">
        <h2 className="chapter-title">{title}</h2>
        {children}
      </div>
      {backdrop || noMedia ? null : (
        <aside className="chapter-media">
          {media ? (
            <div className="chapter-media-frame chapter-media-frame--live">
              {media}
            </div>
          ) : (
            <ChapterMediaPlaceholder kind={number} />
          )}
        </aside>
      )}
    </section>
  );
}

/**
 * Scroll-reveal: walk every `.chapter` on the PDP and toggle `.is-visible`
 * when it enters the viewport. CSS handles the fade/translate.
 *
 * Keyed on the product handle: React Router reuses this Product component
 * across PDP navigations (only `:handle` changes), so a `[]`-dep effect
 * never re-runs and the new product's chapters never get observed → they
 * stay opacity 0. Re-running on handle change rebinds the IO to the new
 * DOM and also clears any `is-visible` left over from the prior product.
 */
function useChapterReveal(key: string) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const chapters = document.querySelectorAll('.chapter');
    // Reset any stale `is-visible` from a prior PDP so chapters above the
    // fold actually animate in instead of being pre-flagged visible.
    chapters.forEach((el) => el.classList.remove('is-visible'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      {rootMargin: '0px 0px -15% 0px', threshold: 0.05},
    );
    chapters.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [key]);
}

export default function Product() {
  const {product, bundleProducts, recommendations, latestCommits} =
    useLoaderData<typeof loader>();
  useChapterReveal(product.handle);

  // Resolve the selected variant client-side from the URL options. Paired with
  // `shouldRevalidate` (above), switching SKUs is instant — no Shopify
  // round-trip, no full-page revalidation. The candidate list already carries
  // every tier's price/stock for a line product, so we match the URL against it
  // and fall back to the server's default variant when no options are set.
  const [searchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const selectedVariant = useMemo(() => {
    const params = new URLSearchParams(searchKey);
    const match = getAdjacentAndFirstAvailableVariants(product).find(
      (v) =>
        (v.selectedOptions?.length ?? 0) > 0 &&
        v.selectedOptions!.every((o) => params.get(o.name) === o.value),
    );
    return (
      (match as unknown as typeof product.selectedOrFirstAvailableVariant) ??
      product.selectedOrFirstAvailableVariant
    );
  }, [searchKey, product]);

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant?.selectedOptions ?? []);

  // Hide the pinned buy rail while an aside (cart/search/mobile nav) is open —
  // otherwise the fixed overlay sits on top of the cart drawer.
  const {type: asideType} = useAside();

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title} = product;

  const galleryImages = product.images?.nodes?.length
    ? product.images.nodes
    : selectedVariant?.image
      ? [selectedVariant.image]
      : [];

  const primaryCollection = product.collections?.nodes?.[0];
  // isEditorial: this handle has a real PRODUCT_CONTENT entry. Fallback
  // products (accessories like straps and hardware kits) are not open-source
  // hardware — they must not claim a CERN-OHL-S license or render the
  // "Open for learning" chapter pointing at the GitHub org.
  const isEditorial = Boolean(PRODUCT_CONTENT[product.handle]);
  const content = PRODUCT_CONTENT[product.handle] ?? PRODUCT_CONTENT_FALLBACK;
  const hasHeroCopy = Boolean(content.hero.line1);
  const chapterNums = computeChapterNumbers(content, isEditorial);

  // Repo whose commit history backs the "Open for learning" row's 4th card —
  // the bundle's first component repo, else this product's own. Used as the
  // fallback link when the live latest-commit fetch is rate-limited.
  const commitHistoryRepoUrl = content.bundle
    ? content.bundle.components
        .map((c) => PRODUCT_CONTENT[c.handle]?.repoUrl)
        .find((url): url is string => Boolean(url))
    : content.repoUrl;

  // Comparison-ladder state for product lines (OpenRX/OpenESC). The
  // editorial `variants` map is the tier source of truth; the active tier
  // drives the spec/in-the-box preview and, once Shopify carries the
  // matching option, the buy module follows via the selected variant.
  const variantKeys = content.variants ? Object.keys(content.variants) : [];
  const hasLadder = Boolean(content.optionAxis && variantKeys.length > 0);
  const matchKey = (val?: string) =>
    val
      ? variantKeys.find(
          (k) => k.trim().toLowerCase() === val.trim().toLowerCase(),
        )
      : undefined;
  const shopifyAxisValue = content.optionAxis
    ? selectedVariant?.selectedOptions?.find(
        (o) =>
          o.name.trim().toLowerCase() ===
          content.optionAxis!.trim().toLowerCase(),
      )?.value
    : undefined;
  const [activeTier, setActiveTier] = useState(
    matchKey(shopifyAxisValue) ?? variantKeys[0] ?? '',
  );
  // Re-sync if Shopify resolves a different variant (deep-link with
  // ?Model=Mono, or the optimistic variant settling on another tier).
  useEffect(() => {
    const k = matchKey(shopifyAxisValue);
    if (k && k !== activeTier) setActiveTier(k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyAxisValue]);
  const activeVariant = content.variants?.[activeTier];
  const mergedSpecs = mergeSpecs(content.specs, activeVariant?.specs);
  const mergedBox = [...content.inTheBox, ...(activeVariant?.inTheBox ?? [])];

  // Bundle (OpenStack): resolve each component's variant for the active size,
  // so add-to-cart drops the real FC + ESC lines and the buy module shows the
  // combined price. The size axis is matched by name ("Model") + the active
  // tier key; a component with no matching variant falls back to its first.
  const bundleComponents = content.bundle?.components ?? [];
  const bundleVariants = bundleComponents.map((c) => {
    const bp = bundleProducts?.find((p) => p?.handle === c.handle);
    const nodes = bp?.variants?.nodes ?? [];
    const match = nodes.find((n) =>
      n.selectedOptions?.some(
        (o) =>
          o.name.trim().toLowerCase() === 'model' &&
          o.value.trim().toLowerCase() === activeTier.trim().toLowerCase(),
      ),
    );
    return match ?? nodes[0] ?? null;
  });
  const bundleReady =
    Boolean(content.bundle) && bundleVariants.every((v) => v != null);
  const bundleLines = bundleReady
    ? bundleVariants.map((v) => ({merchandiseId: v!.id, quantity: 1}))
    : [];
  const bundleAvailable =
    bundleReady && bundleVariants.every((v) => v!.availableForSale);
  const bundlePrice = bundleReady
    ? {
        amount: bundleVariants
          .reduce((s, v) => s + parseFloat(v!.price.amount), 0)
          .toFixed(2),
        currencyCode: bundleVariants[0]!.price.currencyCode,
      }
    : undefined;
  // The teardown board art follows the selected tier: a variant's own
  // `boardArt` wins, otherwise the shared `teardown.boardArt` (the default
  // board) is shown. Lines without per-tier art just keep the default.
  const activeBoardArt = activeVariant?.boardArt ?? content.teardown?.boardArt;
  // CAD products (the frame) carry an exploded 3D viewer instead of a
  // layered board SVG; when present it takes the teardown media slot. Like
  // boardArt, a tier's own model (3" vs 5") wins over the shared default.
  const frameViewer = activeVariant?.frameViewer ?? content.teardown?.frameViewer;
  // Every frame model across all tiers, so the viewer can preload them and
  // switch tiers instantly (toggle visibility) instead of re-fetching the
  // multi-MB GLB on each swap.
  const frameViewerSrcs = useMemo(() => {
    const set = new Set<string>();
    if (content.teardown?.frameViewer) set.add(content.teardown.frameViewer.src);
    for (const v of Object.values(content.variants ?? {})) {
      if (v.frameViewer) set.add(v.frameViewer.src);
    }
    return [...set];
  }, [content]);
  // Every tier's board SVG, so BoardArt can warm them all and a tier toggle
  // swaps in instantly instead of refetching + flashing blank.
  const boardArtSrcs = useMemo(() => {
    const set = new Set<string>();
    if (content.teardown?.boardArt) set.add(content.teardown.boardArt.src);
    for (const v of Object.values(content.variants ?? {})) {
      if (v.boardArt) set.add(v.boardArt.src);
    }
    return [...set];
  }, [content]);
  // The schematic viewer follows the same board as the layer viewer — its
  // sheets live at /schematics/<board-handle>/ (same handle as the board art).
  const schematicHandle =
    activeBoardArt?.src.match(/\/boards\/([^/]+)\//)?.[1] ?? null;
  // Every tier's schematic handle (derived from its board src), so the viewer
  // can warm sibling manifests + sheets and a tier toggle swaps in instantly.
  const schematicHandles = useMemo(
    () =>
      boardArtSrcs
        .map((s) => s.match(/\/boards\/([^/]+)\//)?.[1])
        .filter((h): h is string => Boolean(h)),
    [boardArtSrcs],
  );

  // Compact buy bar (line products, desktop): the in-hero ladder + add-to-cart
  // scroll past normally; once the in-hero selector passes under the header a
  // separate compact bar pins to the top so a buyer can switch SKUs from
  // anywhere and compare spec tables. Scrolling back up hides it again. The pin
  // is driven by a zero-height sentinel sitting just below the in-hero selector.
  // The pinned bar shrink-wraps to its content (chips + price + add-to-cart) and
  // anchors to the content's right edge, so it grows leftward as more SKUs are
  // added rather than stretching into a full-width banner. `railBox.right`
  // mirrors the gap from the viewport's right edge to the hero's right edge.
  const heroSectionRef = useRef<HTMLElement>(null);
  const railSentinelRef = useRef<HTMLDivElement>(null);
  const [railPinned, setRailPinned] = useState(false);
  const [railBox, setRailBox] = useState<{right: number} | null>(null);
  useEffect(() => {
    if (!hasLadder) return;
    const sentinel = railSentinelRef.current;
    const section = heroSectionRef.current;
    if (!sentinel || !section) return;
    const HEADER = 56; // --header-height
    const isDesktop = () => window.matchMedia('(min-width: 960px)').matches;
    const measure = () => {
      const r = section.getBoundingClientRect();
      // clientWidth excludes the scrollbar, so the rail's right edge lines up
      // with the content gutter rather than floating over the scrollbar.
      const right = Math.round(document.documentElement.clientWidth - r.right);
      setRailBox({right});
    };
    measure();
    const io = new IntersectionObserver(
      ([entry]) =>
        setRailPinned(
          isDesktop() &&
            !entry.isIntersecting &&
            entry.boundingClientRect.top < HEADER,
        ),
      {rootMargin: `-${HEADER}px 0px 0px 0px`, threshold: 0},
    );
    io.observe(sentinel);
    const onResize = () => {
      measure();
      if (!isDesktop()) setRailPinned(false);
    };
    window.addEventListener('resize', onResize);
    return () => {
      io.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [product.handle, hasLadder]);

  // primaryCollection is retained in the loader but we deliberately
  // don't render a breadcrumb on the PDP — the editorial hero with
  // the "File 0N · Family" eyebrow is the navigation clue instead.
  void primaryCollection;

  // Bundles advertise the composed component price (what add-to-cart actually
  // charges), not the Shopify master-variant placeholder.
  const jsonLdPrice = content.bundle ? bundlePrice : selectedVariant?.price;
  const productJsonLd = buildProductJsonLd({
    title: product.title,
    description: product.description,
    imageUrl: selectedVariant?.image?.url ?? galleryImages[0]?.url ?? null,
    url: `https://opendrone.be/products/${product.handle}`,
    vendor: product.vendor,
    sku: selectedVariant?.sku ?? null,
    price: jsonLdPrice
      ? {
          amount: jsonLdPrice.amount,
          currencyCode: jsonLdPrice.currencyCode,
        }
      : null,
    availableForSale: content.bundle
      ? bundleAvailable
      : (selectedVariant?.availableForSale ?? false),
    productHandle: product.handle,
  });

  // The ladder + buy module. These two nodes are rendered twice: once in the
  // hero (in normal flow — it scrolls past like any content) and, once the
  // in-hero selector has scrolled under the header, again in a compact bar
  // pinned to the top so a variant switcher + add-to-cart is always reachable.
  // Both copies share `activeTier`, so switching in either keeps them in sync.
  const railLadder =
    hasLadder && content.optionAxis && content.variants ? (
      <VariantLadder
        axis={content.optionAxis}
        variants={content.variants}
        productOptions={productOptions}
        activeValue={activeTier}
        onSelect={setActiveTier}
      />
    ) : null;
  const isBundle = Boolean(content.bundle);
  const buyPrice = isBundle ? bundlePrice : selectedVariant?.price;
  const buyAvailable = isBundle
    ? bundleAvailable
    : Boolean(selectedVariant?.availableForSale);
  const railBuyModule = (
    <div className="product-buy" data-buy-module>
      <div className="product-buy-price">
        <ProductPrice
          price={buyPrice}
          compareAtPrice={isBundle ? undefined : selectedVariant?.compareAtPrice}
        />
        {isBundle ? (
          <span className="product-buy-sku">
            {/* Name the actual pair for the tier (20×20 ships the Mini). */}
            {content.variants?.[activeTier]?.highlights?.find(
              ([k]) => k === 'Pair',
            )?.[1] ?? `OpenFC-Lite + OpenESC · ${activeTier}`}
          </span>
        ) : selectedVariant?.sku ? (
          <span className="product-buy-sku">SKU {selectedVariant.sku}</span>
        ) : null}
      </div>
      <span className={`product-buy-stock${buyAvailable ? '' : ' is-out'}`}>
        {isBundle
          ? buyAvailable
            ? 'Both boards in stock · ships from Belgium'
            : 'One or both boards unavailable'
          : selectedVariant?.availableForSale
            ? 'In stock · ships from Belgium'
            : 'Sold out'}
      </span>
      <ProductForm
        productOptions={productOptions}
        selectedVariant={selectedVariant}
        hideOptionNames={content.optionAxis ? [content.optionAxis] : undefined}
        bundleLines={isBundle ? bundleLines : undefined}
        bundleDisabled={isBundle ? !bundleAvailable : undefined}
        bundleCtaLabel={isBundle ? 'Add the stack: both boards' : undefined}
      />
    </div>
  );

  // The compact, top-pinned copy. Portaled to <body> so the fixed overlay
  // escapes the hero's sticky/stacking context — otherwise the chapter media
  // (sticky to the same top-right spot) paints over it and swallows clicks.
  // Suppressed (CSS-hidden, not unmounted — an in-flight add-to-cart submit
  // must survive opening the drawer) while an aside is open so it doesn't sit
  // on top of the cart.
  const railSuppressed = railPinned && asideType !== 'closed';
  const pinnedRail = (
    <div
      className={`buy-rail is-pinned${railSuppressed ? ' is-suppressed' : ''}`}
      style={railBox ? {right: railBox.right} : undefined}
    >
      {railLadder}
      {railBuyModule}
    </div>
  );

  return (
    <div className="product-page">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: JSON.stringify(productJsonLd)}}
      />
      {/* === HERO: gallery left, copy + sticky buy module right === */}
      <section className="product-hero" ref={heroSectionRef}>
        <div className="product-hero-gallery-col">
          <div className="product-hero-media">
            <ProductGallery
              images={galleryImages}
              activeImageId={selectedVariant?.image?.id ?? null}
            />
          </div>
        </div>

        <div className="product-hero-copy">
          <p className="product-hero-eyebrow">
            File {content.fileNumber} · {content.family}
          </p>
          {hasHeroCopy ? (
            <h1 className="product-hero-headline">
              {/* Skip empty lines — single-line heroes (OpenESC) otherwise
                  render stray empty <em>/<span> nodes and join spaces. */}
              <span>{content.hero.line1}</span>
              {content.hero.line2Italic ? (
                <>
                  {' '}
                  <span>
                    <em>{content.hero.line2Italic}</em>
                  </span>
                </>
              ) : null}
              {content.hero.line3 ? (
                <>
                  {' '}
                  <span>{content.hero.line3}</span>
                </>
              ) : null}
            </h1>
          ) : (
            <h1 className="product-hero-headline">
              <span>
                <BrandName>{title}</BrandName>
              </span>
            </h1>
          )}
          {content.hero.lead ? (
            <p className="product-hero-lead">{content.hero.lead}</p>
          ) : null}

          <ul className="trust-chips" aria-label="Certifications">
            {isEditorial ? (
              <li>
                <Link
                  to="/open-source"
                  prefetch="viewport"
                  className="trust-chip trust-chip-green trust-chip-link"
                >
                  Open source · CERN-OHL-S-2.0
                </Link>
              </li>
            ) : null}
            {content.bundle ? (
              <li>
                <Link
                  to="/firmware-partners"
                  prefetch="viewport"
                  className="trust-chip trust-chip-gold trust-chip-link"
                >
                  €1 × {content.bundle.components.length} →{' '}
                  {content.bundle.components.map((c) => c.firmware).join(' + ')}
                </Link>
              </li>
            ) : content.firmware.project && content.firmware.project !== '—' ? (
              <li>
                <Link
                  to="/firmware-partners"
                  prefetch="viewport"
                  className="trust-chip trust-chip-gold trust-chip-link"
                >
                  €1 → {content.firmware.project} maintainers
                </Link>
              </li>
            ) : null}
          </ul>

          {/* In-flow buy box — scrolls past with the page like any content,
              so nothing vanishes or leaves a gap. The sentinel sits between
              the selector and the buy module: once the selector scrolls under
              the header the compact top bar takes over. */}
          <div className="buy-rail">
            {railLadder}
            <div
              ref={railSentinelRef}
              className="buy-rail-sentinel"
              aria-hidden="true"
            />
            {railBuyModule}
          </div>
          {/* Separate compact bar pinned to the top while the in-hero selector
              is out of view, so variants stay switchable from anywhere. */}
          {railPinned ? createPortal(pinnedRail, document.body) : null}

          {content.pairCta ? (
            <Link className="pair-cta" to={content.pairCta.to} prefetch="viewport">
              <span className="pair-cta-eyebrow">{content.pairCta.eyebrow}</span>
              <span className="pair-cta-title">{content.pairCta.title}</span>
              <span className="pair-cta-arrow" aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </section>

      {/* === Chapter: Teardown === */}
      {content.teardown && chapterNums.teardown ? (
        <Chapter
          number={chapterNums.teardown}
          label="Teardown"
          title={content.teardown.title}
          backdrop={
            frameViewer ? (
              // No key on src: keep the canvas mounted across tier switches so
              // the viewer toggles between preloaded models instantly rather
              // than remounting and re-fetching the GLB. Wrapped so a WebGL
              // failure drops the (decorative) viewer instead of crashing the
              // whole product page.
              <SceneErrorBoundary fallback={null}>
                <ClientFrameViewer
                  src={frameViewer.src}
                  srcs={frameViewerSrcs}
                  inspectUrl={frameViewer.inspectUrl}
                />
              </SceneErrorBoundary>
            ) : undefined
          }
          media={
            !frameViewer && activeBoardArt ? (
              // No key: keep the component mounted across tier switches so it
              // swaps between warmed boards instantly (no remount, no refetch,
              // no blank frame). `srcs` lets it prefetch every tier up front.
              <BoardArt
                src={activeBoardArt.src}
                srcs={boardArtSrcs}
                inspectUrl={activeBoardArt.inspectUrl}
                layerFns={activeBoardArt.layers}
                handle={product.handle}
              />
            ) : undefined
          }
        >
          {content.teardown.body ? (
            <p className="chapter-body">{content.teardown.body}</p>
          ) : null}
          <ul className="teardown-pins">
            {content.teardown.pins.map((pin) => (
              <li key={pin.ref}>
                <span className="teardown-pin-ref">{pin.ref}</span>
                <span className="teardown-pin-part">{pin.part}</span>
                {pin.cost ? (
                  <span className="teardown-pin-cost">{pin.cost}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {!frameViewer && activeBoardArt?.inspectUrl ? (
            <a
              className="board-art-inspect teardown-inspect"
              href={activeBoardArt.inspectUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Inspect interactively ↗
            </a>
          ) : null}
        </Chapter>
      ) : null}

      {/* === Chapter: Open for learning === */}
      {!isEditorial ? null : (
      <Chapter
        number={chapterNums.openSource}
        label="Open for learning"
        title="Published so you can study it. Produced so you don't have to."
        wideMedia={!!schematicHandle}
        media={
          schematicHandle ? (
            // No key: keep the viewer mounted across tier switches so it swaps
            // between warmed manifests + sheets instantly instead of remounting
            // and refetching. `handles` lets it preload every tier up front.
            <SchematicViewer
              handle={schematicHandle}
              handles={schematicHandles}
              inspectUrl={activeBoardArt?.inspectUrl}
            />
          ) : undefined
        }
      >
        <div className="open-source-cards">
          {content.bundle ? (
            content.bundle.components.map((c) => {
              const repo = PRODUCT_CONTENT[c.handle]?.repoUrl;
              if (!repo) return null;
              return (
                <a
                  key={c.handle}
                  href={repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="open-source-card"
                >
                  <p className="open-source-card-label">{c.title}</p>
                  <p className="open-source-card-title">GitHub repo ↗</p>
                  <p className="open-source-card-sub">
                    Schematic · PCB · BOM · 3D STEP
                  </p>
                </a>
              );
            })
          ) : (
            <>
              <a
                href={content.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="open-source-card"
              >
                <p className="open-source-card-label">Study</p>
                <p className="open-source-card-title">GitHub repo ↗</p>
                <p className="open-source-card-sub">
                  {/* CAD products (the frame) have no schematic/PCB. */}
                  {content.teardown?.frameViewer
                    ? '3D CAD · STEP · hardware BOM'
                    : 'Schematic · PCB · BOM · 3D STEP · design notes'}
                </p>
              </a>
              <a
                href={`${content.repoUrl}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className="open-source-card"
              >
                <p className="open-source-card-label">Iterate</p>
                <p className="open-source-card-title">Open issues ↗</p>
                <p className="open-source-card-sub">
                  Rev candidates · bugs · community discussion
                </p>
              </a>
            </>
          )}
          <a
            href="https://ohwr.org/cern_ohl_s_v2.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="open-source-card"
          >
            <p className="open-source-card-label">License</p>
            <p className="open-source-card-title">CERN-OHL-S v2 ↗</p>
            <p className="open-source-card-sub">
              Strong reciprocal: share your changes
            </p>
          </a>
          {/* The latest commit rides in the same row as the resource cards —
              streams in as a 4th card once the deferred GitHub fetch lands.
              GitHub's unauthenticated API rate-limits the edge under load, so
              when the fetch comes back empty we still render a 4th card: a
              static link to the repo's commit history. The bubble is always
              present, it just degrades from a live commit to a changelog link. */}
          {commitHistoryRepoUrl ? (
            <Suspense
              fallback={<CommitHistoryCard repoUrl={commitHistoryRepoUrl} />}
            >
              <Await
                resolve={latestCommits}
                errorElement={
                  <CommitHistoryCard repoUrl={commitHistoryRepoUrl} />
                }
              >
                {(commits) =>
                  commits && commits.length ? (
                    commits.map((c) => (
                      <LatestCommitCard key={c.sha + c.repoUrl} commit={c} />
                    ))
                  ) : (
                    <CommitHistoryCard repoUrl={commitHistoryRepoUrl} />
                  )
                }
              </Await>
            </Suspense>
          ) : null}
        </div>
      </Chapter>
      )}

      {/* === Chapter: In the box (always) === */}
      {(content.inTheBox.length > 0 || content.bundle) &&
      chapterNums.inTheBox ? (
        <Chapter
          number={chapterNums.inTheBox}
          label="In the box"
          bigMedia
          title={
            content.bundle ? (
              <>
                Two boards, two firmwares,{' '}
                <em>two maintainers paid.</em>
              </>
            ) : (
              <>
                Everything that ships,{' '}
                <em>down to the grommet.</em>
              </>
            )
          }
        >
          {content.bundle ? (
            <p className="chapter-body">
              The bundle is just OpenFC-Lite and OpenESC shipped together. No
              combined SKU, no tied hardware: each board is the same one
              you can buy on its own. What you save is courier-and-handling.
              What you don&apos;t lose is the €1 split: each firmware
              project still gets paid from this order.
            </p>
          ) : (
            <p className="chapter-body">
              Here is the actual parts list. Anything missing from a build,
              say so and we&apos;ll ship it.
            </p>
          )}
          {mergedBox.length > 0 ? (
            <ul className="in-the-box">
              {mergedBox.map((it) => (
                <li key={`${it.qty ?? ''}${it.item}`}>
                  {it.qty ? (
                    <span className="in-the-box-qty">{it.qty}</span>
                  ) : null}
                  <span className="in-the-box-item">{it.item}</span>
                  {it.note ? (
                    <span className="in-the-box-note">{it.note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {content.bundle ? (
            <div className="bundle-components">
              {content.bundle.components.map((c) => (
                <Link
                  key={c.handle}
                  to={`/products/${c.handle}`}
                  prefetch="viewport"
                  className="bundle-component-card"
                >
                  <p className="bundle-component-title">{c.title}</p>
                  <p className="bundle-component-blurb">{c.blurb}</p>
                  <p className="bundle-component-firmware">
                    Firmware ·{' '}
                    <span>{c.firmware}</span>
                  </p>
                  <span className="bundle-component-more" aria-hidden="true">
                    View the board →
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          <ProvenanceCard
            designNote={
              // The frame is a CAD product — "schematic, PCB, BOM" is PCB
              // wording that doesn't apply to carbon plates.
              content.teardown?.frameViewer
                ? 'CAD, materials, hardware kit'
                : undefined
            }
          />
        </Chapter>
      ) : null}

      {/* === Chapter: The €1 — singles with a firmware project === */}
      {!content.bundle &&
      content.firmware.project &&
      content.firmware.project !== '—' &&
      chapterNums.firmware ? (
        <Chapter
          number={chapterNums.firmware}
          label="The €1"
          title={
            <>
              What <em>you</em> pay, what the{' '}
              <em>people who wrote the firmware</em> get.
            </>
          }
          media={
            content.firmware.logo ? (
              <img
                className={
                  content.firmware.logoDark
                    ? 'firmware-logo firmware-logo--tile'
                    : 'firmware-logo'
                }
                src={content.firmware.logo}
                alt={`${content.firmware.project} logo`}
                loading="lazy"
              />
            ) : undefined
          }
        >
          <FirmwareSplit
            price={selectedVariant?.price}
            firmwareProject={content.firmware.project}
            firmwareUrl={content.firmware.projectUrl}
          />
        </Chapter>
      ) : null}

      {/* === Chapter: Specs === */}
      {content.specs.length > 0 && chapterNums.specs ? (
        <Chapter
          number={chapterNums.specs}
          label="Datasheet"
          title="Every spec, in one table."
          noMedia
        >
          <dl className="spec-table">
            {mergedSpecs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {content.footnote ? (
            <p className="chapter-footnote">{content.footnote}</p>
          ) : null}
        </Chapter>
      ) : null}

      {/* === Chapter: Downloads — schematic, STEP, BOM, manuals === */}
      {content.downloads.length > 0 && chapterNums.downloads ? (
        <Chapter
          number={chapterNums.downloads}
          label="Downloads"
          title={
            <>
              Files you can fork,{' '}
              <em>build on, or audit.</em>
            </>
          }
        >
          <p className="chapter-body">
            Straight from the repo. If a link 404s, the file moved; open
            an issue on the matching GitHub repo and we&apos;ll point it
            back.
          </p>
          <DownloadsGrid downloads={content.downloads} />
        </Chapter>
      ) : null}

      <RelatedProducts recommendations={recommendations} />
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    images(first: 10) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    collections(first: 1) {
      nodes {
        handle
        title
      }
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;

// Bundle component lookup: just enough of each FC/ESC product to resolve the
// variant for the selected mount size and price/stock it. The bundle page
// renders from its own product; this only powers the two-line add-to-cart.
const BUNDLE_COMPONENT_QUERY = `#graphql
  query BundleComponent(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      handle
      title
      variants(first: 20) {
        nodes {
          id
          sku
          availableForSale
          price {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
` as const;

const PRODUCT_RECOMMENDATIONS_QUERY = `#graphql
  query ProductRecommendations(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productHandle: $handle) {
      id
      handle
      title
      featuredImage {
        id
        url
        altText
        width
        height
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
    }
  }
` as const;

const FALLBACK_PRODUCTS_QUERY = `#graphql
  query FallbackProducts(
    $country: CountryCode
    $first: Int!
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes {
        id
        handle
        title
        featuredImage {
          id
          url
          altText
          width
          height
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
          maxVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;
