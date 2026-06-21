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
import {useNoHover, useIsMobile} from '~/lib/use-media-query';
import {
  PRODUCT_CONTENT,
  PRODUCT_CONTENT_FALLBACK,
} from '~/lib/product-content';
import type {
  ChapterPin,
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
  textReveal,
}: {
  number: string;
  label: string;
  title: React.ReactNode;
  children: React.ReactNode;
  /** When defined, gate the body text's slide-in on this flag (false = held off
   *  to the left, hidden). Used by the teardown so the copy slides in only after
   *  the board layers have flown in. Undefined = no gating (normal reveal). */
  textReveal?: boolean;
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
      data-text-pending={textReveal === false ? '' : undefined}
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
  // The teardown pin list follows the tier the same way the board art does:
  // each board in a line has its own refdes layout, so a tier's own `pins`
  // win over the shared `teardown.pins` default. Keeps the hover-highlight
  // refdes matched to the board currently shown.
  const activePins = activeVariant?.pins ?? content.teardown?.pins ?? [];
  // Group the teardown pins by board side — Top (front) first, then Bottom
  // (back) — reading each refdes's side from the board's components.json. Done
  // at runtime so it stays accurate per tier with no manual side tagging.
  const componentsSrc = activeBoardArt?.src.replace(
    /board\.svg$/,
    'components.json',
  );
  const [pinSides, setPinSides] = useState<Map<string, 'F' | 'B'>>(new Map());
  useEffect(() => {
    if (!componentsSrc) return;
    let alive = true;
    fetch(componentsSrc)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const comps =
          (d as {components?: Array<{ref?: string; layer?: string}>})
            ?.components ?? [];
        const m = new Map<string, 'F' | 'B'>();
        for (const c of comps) {
          if (c.ref && (c.layer === 'F' || c.layer === 'B')) m.set(c.ref, c.layer);
        }
        setPinSides(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [componentsSrc]);
  // Partition pins by the dominant side of their refs. Until the map loads (or
  // for pins with no resolvable side) pins fall into `other`, rendered flat.
  const groupedPins = useMemo(() => {
    const top: ChapterPin[] = [];
    const bottom: ChapterPin[] = [];
    const other: ChapterPin[] = [];
    for (const pin of activePins) {
      if (!pin.refs?.length || pinSides.size === 0) {
        other.push(pin);
        continue;
      }
      let f = 0;
      let b = 0;
      for (const r of pin.refs) {
        const s = pinSides.get(r);
        if (s === 'F') f++;
        else if (s === 'B') b++;
      }
      if (f === 0 && b === 0) other.push(pin);
      else if (f >= b) top.push(pin);
      else bottom.push(pin);
    }
    return {top, bottom, other};
  }, [activePins, pinSides]);
  // Flat tour order for the mobile "swipe the board sideways to step through the
  // parts" gesture — front parts top→bottom, then back, then any unsided. Each
  // carries its full highlight spec (the same one its table row uses). Chip rows
  // (I/O pads) expand to one stop per chip.
  const orderedParts = useMemo(() => {
    const out: Array<{
      refs: string[];
      union: boolean;
      groups?: string[][];
      name: string;
    }> = [];
    for (const pin of [
      ...groupedPins.top,
      ...groupedPins.bottom,
      ...groupedPins.other,
    ]) {
      if (pin.chips?.length) {
        for (const chip of pin.chips)
          if (chip.refs?.length)
            out.push({refs: chip.refs, union: false, name: chip.label});
      } else if (pin.refs?.length) {
        out.push({
          refs: pin.refs,
          union: pin.box === 'union',
          groups: pin.boxGroups,
          name: pin.part,
        });
      }
    }
    return out;
  }, [groupedPins]);
  const isMobile = useIsMobile();
  // CAD products (the frame) carry an exploded 3D viewer instead of a
  // layered board SVG; when present it takes the teardown media slot. Like
  // boardArt, a tier's own model (3" vs 5") wins over the shared default.
  const frameViewer = activeVariant?.frameViewer ?? content.teardown?.frameViewer;
  // True for the mobile PCB explorer (any board product, not the frame viewer).
  const choreoOn = isMobile && !!activeBoardArt && !frameViewer;
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
  // Refdes of the teardown pin the visitor is hovering/focusing — highlighted
  // on the board by BoardArt. Lives here (the common ancestor of the pin list
  // and the board) so a hover lights the matching footprint.
  const [hoveredRefs, setHoveredRefs] = useState<string[]>([]);
  // Whether the current highlight is actually drawn on the visible layer (fed by
  // BoardArt). A part can be "selected" but hidden if you've flicked to another
  // layer — used so a re-tap re-asserts instead of toggling an invisible part off.
  const [highlightVisible, setHighlightVisible] = useState(false);
  // On touch there's no hover: a tap emits synthetic mouseenter→...→mouseleave/
  // blur, so the hover handlers would light the part then instantly clear it.
  // Switch to a tap-only model on touch (click toggles; no auto-clear).
  const noHover = useNoHover();
  // Whether the hovered pin wants ONE union box (dense arrays) vs a box per part.
  const [hoveredUnion, setHoveredUnion] = useState(false);
  // Per-group boxes (e.g. ESC motor pads → one box per motor), if the pin sets them.
  const [hoveredGroups, setHoveredGroups] = useState<string[][] | undefined>(
    undefined,
  );
  // True while the board's first-reveal fly-in is animating — locks the parts
  // list so a hover can't fight the animation.
  const [boardFlying, setBoardFlying] = useState(false);
  // The teardown text slides in from the left AFTER the board layers finish
  // flying in: flip `textIn` when the fly completes (boardFlying true→false), with
  // a fallback so it always reveals even if the board never flies (reduced motion
  // / never centred).
  const [textIn, setTextIn] = useState(false);
  // Slide the teardown copy in from the left once the section is actually on
  // screen — a beat after it centres (the board's layers are flying in), so it
  // reads like a final layer. Driven by the section's OWN visibility (not a blind
  // timer, which fired before the user scrolled down → the slide played offscreen
  // and was never seen).
  useEffect(() => {
    // Re-arm on every product switch (the PDP stays mounted across nav, so this
    // must reset or the new product's copy would already be "in").
    setTextIn(false);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setTextIn(true);
      return;
    }
    const el = document.querySelector('.teardown-sides');
    if (!el) {
      setTextIn(true); // no teardown list to gate
      return;
    }
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          timer = window.setTimeout(() => setTextIn(true), 600);
        }
      },
      {rootMargin: '-40% 0px -40% 0px'},
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [product.handle]);
  // Co-trigger: the board's own fly starting is a sure sign the teardown is on
  // screen, so slide the copy in a beat later too (belt-and-suspenders with the
  // observer above — textIn latches, so whichever fires first wins).
  useEffect(() => {
    if (!boardFlying) return;
    const t = setTimeout(() => setTextIn(true), 600);
    return () => clearTimeout(t);
  }, [boardFlying]);
  // The connector lines are the LAST thing in: after the fly finishes (layers
  // selectable), they stroke-draw from the bubbles to the rail. Trigger ~0.4s
  // after the fly completes (boardFlying true→false).
  const [linesReady, setLinesReady] = useState(false);
  const flewRef = useRef(false);
  useEffect(() => {
    if (boardFlying) {
      flewRef.current = true;
      return;
    }
    if (flewRef.current && !linesReady) {
      const t = setTimeout(() => setLinesReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [boardFlying, linesReady]);
  // Re-arm the connector lines on every product switch (the PDP stays mounted
  // across nav, only BoardArt remounts). Without this they'd keep their already-
  // drawn state instead of redrawing for the new board. Reduced motion shows them
  // immediately with no draw animation. (No blind timer — if the board never
  // flies there's no rail for the lines to connect to, so they stay hidden.)
  useEffect(() => {
    setLinesReady(false);
    flewRef.current = false;
    setBoardFlying(false);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setLinesReady(true);
    }
  }, [product.handle]);
  // Clear all hover highlight state. Called only when the pointer leaves the
  // whole list (not between rows) so the spotlight stays lit and just moves from
  // row to row — no off/on flicker crossing the dividers/gaps.
  const clearHover = () => {
    setHoveredRefs([]);
    setHoveredUnion(false);
    setHoveredGroups(undefined);
  };
  // Which tour stop is currently lit (−1 = none) — for the part counter + so a
  // sideways flick knows where to step from.
  const focusedPartIdx = orderedParts.findIndex(
    (p) =>
      p.refs.length === hoveredRefs.length &&
      p.refs.every((r) => hoveredRefs.includes(r)),
  );
  // Sideways flick on the board steps through the parts: highlight the next/prev
  // one (BoardArt flips to its face). Mirrors the vertical layer flick.
  const stepPart = (dir: number) => {
    if (!orderedParts.length) return;
    const next =
      focusedPartIdx < 0
        ? dir > 0
          ? 0
          : orderedParts.length - 1
        : Math.min(orderedParts.length - 1, Math.max(0, focusedPartIdx + dir));
    const part = orderedParts[next];
    setHoveredRefs([...part.refs]);
    setHoveredUnion(part.union);
    setHoveredGroups(part.groups);
  };
  // One teardown-pin <li>: the part label (+ optional count); hover/focus
  // highlights its footprint(s) on the board (keyboard mirrors mouse for a11y).
  const renderPin = (pin: ChapterPin) => {
    const refs = pin.refs;
    // Chip-row pin (e.g. FC I/O pads): one row, a horizontal set of chips, each
    // highlighting its own pad group on hover/focus.
    if (pin.chips?.length) {
      return (
        <li key={pin.ref} className="teardown-pin teardown-io-row">
          <span className="teardown-io-tag">I/O</span>
          <div className="teardown-io-chips">
            {pin.chips.map((chip) => {
              const chipActive =
                hoveredRefs.length === chip.refs.length &&
                chip.refs.every((r) => hoveredRefs.includes(r));
              const on = () => {
                // Fresh array each tap so BoardArt's auto-flip effect re-fires —
                // re-tapping a part hidden under another layer flips back to it.
                setHoveredRefs([...chip.refs]);
                setHoveredUnion(false);
                setHoveredGroups(undefined);
              };
              // Touch: tap toggles this chip's spotlight. Only toggle OFF when
              // it's actually lit on the visible layer — otherwise (you've
              // flicked to another layer) re-tap re-asserts + flips to its face.
              const chipHandlers = noHover
                ? {
                    onClick: () =>
                      chipActive && highlightVisible ? clearHover() : on(),
                  }
                : {onMouseEnter: on, onFocus: on, onBlur: clearHover};
              return (
                <button
                  type="button"
                  key={chip.label}
                  className={`teardown-io-chip${chipActive ? ' is-active' : ''}`}
                  {...chipHandlers}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </li>
      );
    }
    const hoverable = !!refs?.length;
    const enter = () => {
      // Fresh array each tap so BoardArt's auto-flip effect re-fires even on the
      // same part — re-tapping one hidden under another layer flips back to it.
      setHoveredRefs(refs ? [...refs] : []);
      setHoveredUnion(pin.box === 'union');
      setHoveredGroups(pin.boxGroups);
    };
    // Is this row's footprint set the one currently lit? (used for tap-toggle)
    const isActive =
      hoverable &&
      hoveredRefs.length === refs!.length &&
      refs!.every((r) => hoveredRefs.includes(r));
    // Touch has no hover: a tap toggles this row's spotlight on/off. On desktop
    // the click toggle is harmless — hover already drives the highlight.
    // Toggle OFF only when actually lit on the visible layer; otherwise re-tap
    // re-asserts (and BoardArt flips to the part's face) — no invisible dead tap.
    const tap = () => (isActive && highlightVisible ? clearHover() : enter());
    // No per-row onMouseLeave — clearing happens on the container leave so the
    // spotlight stays lit while moving between rows (onBlur covers keyboard).
    // On touch, drop every hover/focus handler — a tap's synthetic mouse +
    // blur events would clear the spotlight the click just set. Click alone
    // toggles, and it persists (no container mouseleave on touch either).
    const handlers = !hoverable
      ? {}
      : noHover
        ? {onClick: tap, tabIndex: 0}
        : {
            onMouseEnter: enter,
            onClick: tap,
            onFocus: enter,
            onBlur: clearHover,
            tabIndex: 0,
          };
    return (
      <li
        key={pin.ref}
        className={
          hoverable
            ? `teardown-pin teardown-pin-hoverable${isActive ? ' is-active' : ''}`
            : undefined
        }
        {...handlers}
      >
        <span className="teardown-pin-part">{pin.part}</span>
        <span className="teardown-pin-cost">{pin.cost ?? '×1'}</span>
      </li>
    );
  };
  // While a component is highlighted, dim the rest of the page a touch (light
  // mode) so the eye is drawn to the board — a focus accent. Toggled via a class
  // on <html> so the dim (an ::after overlay) + the board's lift are pure CSS.
  useEffect(() => {
    const on = hoveredRefs.length > 0;
    document.documentElement.classList.toggle('board-focus', on);
    return () => document.documentElement.classList.remove('board-focus');
  }, [hoveredRefs]);
  // Subtle connector lines tying each Top/Bottom pin bubble to its matching face
  // box in the board's layer rail, so it reads "these parts live on that side".
  // Drawn on a fixed, full-viewport SVG and recomputed on scroll/resize (the
  // board is sticky while the list scrolls, so the endpoints drift). Imperative
  // via rAF so scrolling doesn't trigger React re-renders.
  const teardownLinksRef = useRef<SVGSVGElement>(null);
  // The link SVG is portaled to <body> so its `position: fixed` is viewport-
  // relative (a transformed ancestor — board column / page-transition wrapper —
  // would otherwise contain `fixed`, throwing the coords off and making it
  // scroll at the wrong rate). Mount client-side only to avoid SSR mismatch.
  const [linksMounted, setLinksMounted] = useState(false);
  useEffect(() => setLinksMounted(true), []);
  useEffect(() => {
    const svg = teardownLinksRef.current;
    if (!svg) return;
    const paths = svg.querySelectorAll('path');
    const dots = svg.querySelectorAll('circle');
    let raf = 0;
    const draw = () => {
      raf = 0;
      const bubbles = document.querySelectorAll<HTMLElement>('.teardown-side');
      const hideSvg = () => {
        svg.style.display = 'none';
      };
      if (bubbles.length < 2) return hideSvg();
      const ends = [
        document.querySelector<HTMLElement>(
          '.board-folder-tabs [data-slug="front"]',
        ),
        document.querySelector<HTMLElement>(
          '.board-folder-tabs [data-slug="back"]',
        ),
      ];
      const H = window.innerHeight;
      // Collect the visible segments (bubble edge → rail-box edge).
      const segs: Array<{i: number; bx: number; by: number; rx: number; ry: number}> =
        [];
      for (let i = 0; i < 2; i++) {
        const b = bubbles[i];
        const r = ends[i];
        if (!b || !r) continue;
        const bb = b.getBoundingClientRect();
        const rr = r.getBoundingClientRect();
        const bx = bb.right;
        const by = bb.top + bb.height / 2;
        const rx = rr.left;
        const ry = rr.top + rr.height / 2;
        if (rr.width > 0 && rx > bx && Math.max(by, ry) > 0 && Math.min(by, ry) < H)
          segs.push({i, bx, by, rx, ry});
      }
      const present = new Set(segs.map((s) => s.i));
      for (let i = 0; i < 2; i++) {
        if (present.has(i)) continue;
        paths[i]?.setAttribute('d', '');
        dots[i * 2]?.setAttribute('r', '0');
        dots[i * 2 + 1]?.setAttribute('r', '0');
      }
      if (!segs.length) return hideSvg();
      // Size + position the SVG to JUST the lines' bounding box (in the empty
      // gutter) — NOT the whole viewport. A full-screen fixed overlay forced the
      // compositor to re-blend the entire page over every animating element each
      // frame (idle GPU). A small box overlapping nothing is nearly free.
      const PAD = 12;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const s of segs) {
        minX = Math.min(minX, s.bx - 5, s.rx + 5);
        maxX = Math.max(maxX, s.bx - 5, s.rx + 5);
        minY = Math.min(minY, s.by, s.ry);
        maxY = Math.max(maxY, s.by, s.ry);
      }
      const ox = minX - PAD;
      const oy = minY - PAD;
      const w = maxX - minX + 2 * PAD;
      const h = maxY - minY + 2 * PAD;
      svg.style.display = 'block';
      svg.style.left = `${ox}px`;
      svg.style.top = `${oy}px`;
      svg.style.width = `${w}px`;
      svg.style.height = `${h}px`;
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      for (const s of segs) {
        const x0 = s.bx - 5;
        const x1 = s.rx + 5;
        const dx = Math.max(40, (x1 - x0) * 0.5);
        const X = (v: number) => v - ox;
        const Y = (v: number) => v - oy;
        paths[s.i].setAttribute(
          'd',
          `M${X(x0)},${Y(s.by)} C${X(x0 + dx)},${Y(s.by)} ${X(x1 - dx)},${Y(
            s.ry,
          )} ${X(x1)},${Y(s.ry)}`,
        );
        const cb = dots[s.i * 2];
        const cr = dots[s.i * 2 + 1];
        cb.setAttribute('cx', String(X(s.bx)));
        cb.setAttribute('cy', String(Y(s.by)));
        cb.setAttribute('r', '3.5');
        cr.setAttribute('cx', String(X(s.rx)));
        cr.setAttribute('cy', String(Y(s.ry)));
        cr.setAttribute('r', '3.5');
      }
    };
    // Redraw on scroll/resize only (rAF-throttled) — NOT a continuous loop,
    // which pinned the GPU at idle. The portal (viewport-fixed coords) is what
    // keeps the links connected; a per-event redraw tracks scroll fine.
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          draw();
        });
    };
    draw();
    // Board SVG + rail stream in async — nudge a few redraws after mount (these
    // re-run whenever the deps change, so they also catch the post-entrance
    // settle when boardFlying flips false).
    const timers = [150, 500, 1200].map((t) => setTimeout(draw, t));
    // While the entrance runs (board fly + text slide), the bubbles AND the rail
    // move via CSS transforms that fire no scroll/resize — so redraw every frame
    // so the connector lines track them live (and stay connected after, with no
    // scroll needed). Bounded to the entrance via boardFlying, NOT perpetual.
    let loopRaf = 0;
    const loop = () => {
      draw();
      loopRaf = boardFlying ? requestAnimationFrame(loop) : 0;
    };
    if (boardFlying) loopRaf = requestAnimationFrame(loop);
    window.addEventListener('scroll', onScroll, {passive: true, capture: true});
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, {capture: true});
      window.removeEventListener('resize', onScroll);
      timers.forEach(clearTimeout);
      if (raf) cancelAnimationFrame(raf);
      if (loopRaf) cancelAnimationFrame(loopRaf);
    };
  }, [activeBoardArt, groupedPins, linksMounted, boardFlying]);
  // <960px the pinned rail becomes a bottom bar (price + add-to-cart only):
  // phones previously had NO sticky buy control at all once the in-hero buy
  // module scrolled away.
  const [railMobile, setRailMobile] = useState(false);
  // On a phone the teardown board is sticky and full-width; the pinned mobile
  // buy rail (~98px) would otherwise sit on top of the part list, leaving no
  // room to see board + controls together. Suppress the rail while the teardown
  // board fills the screen — it re-pins the moment you scroll past the chapter.
  const [teardownActive, setTeardownActive] = useState(false);
  useEffect(() => {
    // Gate on `choreoOn` (any mobile board product) not `railMobile`, so the
    // explorer state + buy-rail suppression work even on boards without a tier
    // ladder, and so it switches OFF the moment the board scrolls away (Phase D).
    if (!choreoOn) {
      setTeardownActive(false);
      return;
    }
    // Observe the CHAPTER (whose top edge is stable w.r.t. scroll) via a centred
    // band, NOT the board/list — those shift when the explorer classes hide the
    // rail or ride the board up, which fed back into the observer and flickered.
    const el = document.querySelector('.chapter:has(.board-art)');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => setTeardownActive(e.isIntersecting),
      {threshold: 0, rootMargin: '-30% 0px -30% 0px'},
    );
    io.observe(el);
    return () => io.disconnect();
  }, [choreoOn, product.handle]);

  // The mobile PCB explorer is now FULLY MANUAL — no auto-play, no scroll-driven
  // body-class toggles (those fed an IntersectionObserver→layout→observer loop
  // that flickered even when idle). The board stays sticky, the layer rail is
  // tappable, and tapping a part highlights it. Nothing here moves the elements
  // the observers watch, so it's stable.
  useEffect(() => {
    if (!hasLadder) return;
    const sentinel = railSentinelRef.current;
    const section = heroSectionRef.current;
    if (!sentinel || !section) return;
    const HEADER = 56; // --header-height
    const isDesktop = () => window.matchMedia('(min-width: 960px)').matches;
    const measure = () => {
      // Anchor the pinned rail's right edge to the floating header pill's right
      // edge so the two pills line up exactly (fall back to the hero section if
      // the header isn't found). clientWidth excludes the scrollbar so the edge
      // sits on the content gutter, not over the scrollbar.
      const headerEl = document.querySelector('.site-header-main');
      const refRight = (headerEl ?? section).getBoundingClientRect().right;
      const right = Math.round(document.documentElement.clientWidth - refRight);
      setRailBox({right});
      setRailMobile(!isDesktop());
    };
    measure();
    const io = new IntersectionObserver(
      ([entry]) =>
        setRailPinned(
          !entry.isIntersecting && entry.boundingClientRect.top < HEADER,
        ),
      {rootMargin: `-${HEADER}px 0px 0px 0px`, threshold: 0},
    );
    io.observe(sentinel);
    const onResize = () => {
      measure();
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
  // Compact (name-pill) variant switcher for the pinned MOBILE buy bar — keeps
  // variant selection reachable there without the full spec ladder's height.
  const railLadderCompact =
    hasLadder && content.optionAxis && content.variants ? (
      <VariantLadder
        compact
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
        {/* Price + the "incl. VAT" qualifier (Art. VI.45 WER pre-contractual
            info) grouped together — also fills the dead space beside the price. */}
        <span className="product-buy-amount">
          <ProductPrice
            price={buyPrice}
            compareAtPrice={isBundle ? undefined : selectedVariant?.compareAtPrice}
          />
          <span className="product-buy-vat">incl.&nbsp;VAT</span>
        </span>
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

  // The compact pinned copy. Desktop: top-right bar with ladder + buy module.
  // Mobile (<960px): bottom bar with the buy module only — the ladder chips
  // don't fit and the in-hero selector is a short scroll away. Portaled to
  // <body> so the fixed overlay escapes the hero's sticky/stacking context —
  // otherwise the chapter media (sticky to the same top-right spot) paints
  // over it and swallows clicks. Suppressed (CSS-hidden, not unmounted — an
  // in-flight add-to-cart submit must survive opening the drawer) while an
  // aside is open so it doesn't sit on top of the cart.
  const railSuppressed =
    railPinned &&
    (asideType !== 'closed' || (railMobile && teardownActive));
  const pinnedRail = (
    <div
      className={`buy-rail is-pinned${railMobile ? ' is-mobile' : ''}${railSuppressed ? ' is-suppressed' : ''}`}
      style={railBox && !railMobile ? {right: railBox.right} : undefined}
    >
      {railMobile ? railLadderCompact : railLadder}
      {railBuyModule}
    </div>
  );

  return (
    <div className="product-page">
      <script
        type="application/ld+json"
         
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
                  €1 → {content.firmware.project} devs
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
          title={
            frameViewer
              ? 'Every arm, plate and standoff — exploded'
              : 'Some layers of copper with components on top'
          }
          textReveal={frameViewer ? undefined : textIn}
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
              // Key by product HANDLE (not src): stays mounted across TIER swaps
              // so it swaps between warmed boards instantly (no remount/refetch),
              // but REMOUNTS on a product switch (FC↔ESC↔RX) so the one-shot
              // fly-in re-arms and plays for the new board. `srcs` prefetches the
              // tiers up front.
              <>
                <BoardArt
                  key={product.handle}
                  src={activeBoardArt.src}
                  srcs={boardArtSrcs}
                  inspectUrl={activeBoardArt.inspectUrl}
                  layerFns={activeBoardArt.layers}
                  handle={product.handle}
                  componentsSrc={activeBoardArt.src.replace(
                    /board\.svg$/,
                    'components.json',
                  )}
                  highlightRefs={hoveredRefs}
                  highlightUnion={hoveredUnion}
                  highlightGroups={hoveredGroups}
                  onFlying={setBoardFlying}
                  onHighlightVisible={setHighlightVisible}
                  onSwipeHorizontal={isMobile ? stepPart : undefined}
                />
                {/* Part tour: which component is lit + how far through the set.
                    Swipe the board sideways (or tap a part) to step. Each tick is
                    tappable to jump straight to that part. */}
                {isMobile && orderedParts.length ? (
                  <div className="board-part-tour">
                    <div className="board-deck-dots" aria-label="Component">
                      {orderedParts.map((p, i) => (
                        <button
                          type="button"
                          key={p.name + i}
                          className={`board-deck-dot${
                            i === focusedPartIdx ? ' is-active' : ''
                          }`}
                          aria-label={`Highlight ${p.name}`}
                          aria-current={i === focusedPartIdx ? 'true' : undefined}
                          onClick={() => {
                            setHoveredRefs([...p.refs]);
                            setHoveredUnion(p.union);
                            setHoveredGroups(p.groups);
                          }}
                        />
                      ))}
                    </div>
                    <p className="board-deck-meta" aria-live="polite">
                      <span className="board-deck-count">
                        {focusedPartIdx < 0
                          ? `0/${orderedParts.length}`
                          : `${focusedPartIdx + 1}/${orderedParts.length}`}
                      </span>
                      <span className="board-deck-name">
                        {focusedPartIdx < 0
                          ? 'Components'
                          : orderedParts[focusedPartIdx].name}
                      </span>
                      <span className="board-deck-hint">Swipe ←/→ · tap a part</span>
                    </p>
                  </div>
                ) : null}
              </>
            ) : undefined
          }
        >
          {!frameViewer && activeBoardArt ? (
            <div className="teardown-guide">
              <p className="teardown-hint">
                Flick the board ↑/↓ for layers · ←/→ for parts · or tap any part
              </p>
              <button
                type="button"
                className="teardown-skip"
                onClick={() => {
                  const ch = document.querySelector('.chapter:has(.board-art)');
                  const next = ch?.nextElementSibling ?? ch;
                  next?.scrollIntoView({behavior: 'smooth', block: 'start'});
                }}
              >
                Skip teardown ↓
              </button>
            </div>
          ) : null}
          {linksMounted && !isMobile
            ? createPortal(
                <svg
                  ref={teardownLinksRef}
                  className={`teardown-links${linesReady ? ' is-drawn' : ''}`}
                  aria-hidden="true"
                >
                  {/* pathLength normalises each line to 100 so the dash draw-in
                      (stroke-dashoffset 100→0) is length-independent even as the
                      path is recomputed on scroll. */}
                  <path d="" pathLength={100} />
                  <path d="" pathLength={100} />
                  <circle r="0" />
                  <circle r="0" />
                  <circle r="0" />
                  <circle r="0" />
                </svg>,
                document.body,
              )
            : null}
          {groupedPins.top.length > 0 && groupedPins.bottom.length > 0 ? (
            <div
              className={`teardown-sides${boardFlying ? ' is-locked' : ''}`}
              onMouseLeave={noHover ? undefined : clearHover}
            >
              <section className="teardown-side">
                <ul className="teardown-pins">
                  {groupedPins.top.map(renderPin)}
                </ul>
              </section>
              <section className="teardown-side">
                <ul className="teardown-pins">
                  {[...groupedPins.bottom, ...groupedPins.other].map(renderPin)}
                </ul>
              </section>
            </div>
          ) : (
            <div
              className={`teardown-sides${boardFlying ? ' is-locked' : ''}`}
              onMouseLeave={noHover ? undefined : clearHover}
            >
              <section className="teardown-side">
                <ul className="teardown-pins">
                  {[
                    ...groupedPins.top,
                    ...groupedPins.bottom,
                    ...groupedPins.other,
                  ].map(renderPin)}
                </ul>
              </section>
            </div>
          )}
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
              inspectUrl={
                activeBoardArt?.schematicUrl ?? activeBoardArt?.inspectUrl
              }
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
              'What you get'
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
          ) : null}
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
              What <em>you</em> pay, what the <em>developers</em> get.
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
          title="Every spec, one table"
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
