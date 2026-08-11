import {Fragment, Suspense, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {
  Await,
  Link,
  redirect,
  useLoaderData,
  useRouteLoaderData,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';
import type {RootLoader} from '~/root';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import {Txt} from '~/components/Txt';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {RelatedProducts} from '~/components/RelatedProducts';
import {FirmwareSupport} from '~/components/FirmwareSupport';
import {CommitTimeline} from '~/components/CommitTimeline';
import {VariantLadder} from '~/components/VariantLadder';
import {BoardArt} from '~/components/BoardArt';
import {SchematicViewer} from '~/components/SchematicViewer';
import type {FrameViewerProps} from '~/components/FrameViewer';
import {SceneErrorBoundary} from '~/components/SceneErrorBoundary';
import {ProvenanceCard} from '~/components/ProvenanceCard';
import {BrandName} from '~/components/BrandName';
import {CommitHistoryCard, LatestCommitCard} from '~/components/LatestCommit';
import {AnimatedNumber} from '~/components/AnimatedNumber';
import {WatchCard} from '~/components/WatchCard';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {copy, copyText, editAttrs} from '~/lib/copy';
import {
  resolveChapters,
  type ChapterEntry,
  type ChapterType,
} from '~/lib/chapters';
import {buildSeoMeta, buildProductJsonLd, SITE_ORIGIN} from '~/lib/seo';
import {fetchCommitActivity, fetchContributors, fetchLatestCommits} from '~/lib/github';
import {ContributorGrid, ContributorGridSkeleton} from '~/components/Contributors';
import {
  fetchProductReviews,
  parseReviewAggregate,
  reviewsEnabled,
} from '~/lib/reviews';
import {
  ReviewAggregateLine,
  ReviewList,
  ReviewListFallback,
} from '~/components/ProductReviews';
import {OshwaMark} from '~/components/OshwaMark';
import {useNoHover, useIsMobile} from '~/lib/use-media-query';
import {
  PRODUCT_CONTENT,
  PRODUCT_CONTENT_FALLBACK,
  isComingSoon,
} from '~/lib/product-content';
import {useProductStatus} from '~/lib/coming-soon';
import {stackDiscountedPrice} from '~/lib/stack-discount';
import {trackEvent} from '~/lib/growth/plausible';
import {attributionSource} from '~/lib/growth/attribution';
import {NewsletterSignup} from '~/components/NewsletterSignup';
import type {
  ChapterPin,
  DownloadAsset,
  DownloadKind,
} from '~/lib/product-content';

export const meta: Route.MetaFunction = ({data, location}) =>
  buildSeoMeta({
    title: data?.product?.seo?.title || data?.product?.title || 'Product',
    description:
      data?.product?.seo?.description || data?.product?.description || undefined,
    image: data?.product?.selectedOrFirstAvailableVariant?.image?.url,
    type: 'product',
    // Canonical without the ?Model= query so variant links don't splinter.
    url: `${SITE_ORIGIN}${location.pathname}`,
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

  // OpenStack is no longer a product: the stack is bought from the FC/ESC
  // pages via the stack builder. Old links land on the FC.
  if (handle === 'openstack') {
    throw redirect('/products/openfc-lite', 301);
  }

  // Bundle products render from their own product but add the *component*
  // variants to cart; the stack builder needs its partner products' variants
  // the same way. Fetch both sets in parallel with the product itself.
  const bundleHandles =
    PRODUCT_CONTENT[handle]?.bundle?.components.map((c) => c.handle) ?? [];
  const stackHandles =
    PRODUCT_CONTENT[handle]?.stack?.partners.map((p) => p.handle) ?? [];

  const [{product}, ...partnerResults] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    ...[...bundleHandles, ...stackHandles].map((h) =>
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

  const partnerProducts = partnerResults
    .map((r) => r?.product)
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const bundleProducts = partnerProducts.filter((p) =>
    bundleHandles.includes(p.handle),
  );
  const stackProducts = partnerProducts.filter((p) =>
    stackHandles.includes(p.handle),
  );

  return {
    product,
    bundleProducts,
    stackProducts,
    // Whether the review env vars are configured — the client can't see
    // env, so the loader answers. False hides every review surface even
    // when the synced metafields carry a count (feature fully dormant).
    reviewsEnabled: reviewsEnabled(context.env),
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
      commitActivity: Promise.resolve([]),
      contributors: Promise.resolve([]),
      reviews: Promise.resolve(null),
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
      // Only the primary repo — fetching every tier's repo too tripled the
      // unauthenticated GitHub API calls per page and blew the 60/hr rate
      // limit, so the live commit fell back to the static card. The card's
      // resilient fallback still shows this commit for every tier.
      repoUrls.push(content.repoUrl);
    }
  }
  // Optional GITHUB_TOKEN lifts the API ceiling from 60 to 5000 calls an
  // hour; unset, both fetches degrade to their empty states.
  const ghToken = context.env.GITHUB_TOKEN;
  const latestCommits = fetchLatestCommits(repoUrls, ghToken).catch(() => []);

  // Commit-activity texture for the contributors chapter, same repo set and
  // the same best-effort rules: an empty array just means no strip.
  const commitActivity = fetchCommitActivity(repoUrls, ghToken).catch(() => []);

  // Contributor grid: every repo in the line (tier repos included) so the
  // section credits people whichever mount they worked on. Same
  // unauthenticated GitHub budget as the commit fetch; edge-cached 1 h in
  // fetchContributors, and the chapter renders its invitation state when
  // the list comes back empty.
  const contributorRepoUrls: string[] = [];
  if (content) {
    if (content.bundle) {
      for (const c of content.bundle.components) {
        const sub = PRODUCT_CONTENT[c.handle];
        if (sub?.repoUrl) contributorRepoUrls.push(sub.repoUrl);
      }
    } else {
      if (content.repoUrl) contributorRepoUrls.push(content.repoUrl);
      for (const v of Object.values(content.variants ?? {})) {
        if (v.repoUrl) contributorRepoUrls.push(v.repoUrl);
      }
    }
  }
  const contributors = fetchContributors(contributorRepoUrls, 12, ghToken).catch(
    () => [],
  );

  // Shopify's productRecommendations returns [] for new stores with no
  // purchase history. Fall back to "other products from the catalog" so
  // the You-might-also-like strip is never empty.
  const recommendations = storefront
    .query(PRODUCT_RECOMMENDATIONS_QUERY, {
      variables: {handle},
    })
    .then(async (res) => {
      // The legacy firmware-donation tip product (cart upsell removed
      // 2026-07) must stay out of recommendations while it still exists in
      // Shopify; the fallback query already excludes it server-side.
      const keep = (p: {handle: string; productType?: string | null}) =>
        p.handle !== handle && p.productType !== 'Donation';
      const rec = res?.productRecommendations?.filter(keep);
      if (rec && rec.length > 0) return rec;
      const fallback = await storefront
        .query(FALLBACK_PRODUCTS_QUERY, {variables: {first: 8}})
        .catch(() => null);
      const items = fallback?.products?.nodes ?? [];
      return items.filter(keep).slice(0, 4);
    })
    .catch(() => null);

  // Full review bodies from the Judge.me REST API — deferred so their
  // latency never blocks the PDP. Resolves null when the env vars are
  // unset or the API misbehaves; the chapter then falls back to the
  // metafield aggregate (or, with no aggregate, renders nothing at all).
  const reviews = fetchProductReviews(context.env, handle);

  return {recommendations, latestCommits, commitActivity, contributors, reviews};
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
  doc: '✓',
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
          <Txt
            id="product-chrome.download_cta"
            as="span"
            className="download-cta"
            aria-hidden="true"
          />
        </a>
      ))}
    </div>
  );
}

/**
 * Intro line for the contributors chapter. It streams with the grid rather
 * than above it, because it can only promise avatars when there are avatars:
 * GitHub's unauthenticated API is 60 calls an hour per IP, so an empty list
 * is a normal outcome, not an error. The empty wording still says the work is
 * public and still invites, it just doesn't point at people who aren't there.
 */
function ContributorsIntro({empty, title}: {empty?: boolean; title?: string}) {
  if (empty || !title) {
    return (
      <Txt
        id="product-chrome.contributors_intro_empty"
        as="p"
        className="chapter-body"
      />
    );
  }
  // The product's name is Shopify data, so the sentence marks its slot with
  // `{product}` and is split around it here. One editable sentence beats
  // shipping "These are the GitHub accounts behind" and "; the next tile is
  // reserved." to the studio as two fragments nobody can read.
  const id = 'product-chrome.contributors_intro';
  const [before, after] = (copyText(id) ?? '').split('{product}');
  return (
    <p className="chapter-body" {...editAttrs(id)}>
      {before}
      {title}
      {after}
    </p>
  );
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
  title,
  titleId,
  children,
  media,
  backdrop,
  wideMedia,
  noMedia,
  textReveal,
  id,
}: {
  number: string;
  label: string;
  /** Optional anchor id so in-page links (buy-area stars) can target it. */
  id?: string;
  /**
   * The designed title, as a copy id. Rendered straight into the `<h2>` so the
   * heading carries its own studio annotation and its inline `*emphasis*`
   * without an extra wrapper element. `title` (the per-product override from
   * `content/chapters.json`) wins when set.
   */
  titleId?: string;
  title?: React.ReactNode;
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
  /** Let the media span the full chapter width below the copy — used for the
   *  wide schematic viewer. */
  wideMedia?: boolean;
  /** Leave the media slot empty for chapters whose content (e.g. the spec
   *  table) needs no image. The grid tracks stay put, so the body column
   *  keeps the same width and left edge as every other chapter. */
  noMedia?: boolean;
}) {
  return (
    <section
      id={id}
      className="chapter"
      data-chapter={number}
      data-backdrop={backdrop ? '' : undefined}
      data-wide-media={wideMedia ? '' : undefined}
      data-no-media={noMedia ? '' : undefined}
      data-text-pending={textReveal === false ? '' : undefined}
    >
      {backdrop ? <div className="chapter-backdrop">{backdrop}</div> : null}
      <div className="chapter-body-col">
        {title ? (
          <h2 className="chapter-title">{title}</h2>
        ) : titleId ? (
          <Txt id={titleId} as="h2" className="chapter-title" />
        ) : null}
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
  const {
    product,
    bundleProducts,
    stackProducts,
    recommendations,
    latestCommits,
    commitActivity,
    contributors,
    reviews,
    reviewsEnabled: reviewsOn,
  } = useLoaderData<typeof loader>();
  useChapterReveal(product.handle);

  // Funnel step 1: one `PDP View` per product per navigation, carrying the
  // product handle + first-touch channel props that aggregate pageviews
  // lack (Plausible pageviews cannot join page path to a custom source
  // prop, so the per-channel funnel needs its own event). Ref guard on
  // the handle: StrictMode's double effect run and unrelated re-renders
  // cannot double-fire; navigating away and back is a fresh view again
  // because the ref updates with the handle.
  const pdpViewTracked = useRef<string | null>(null);
  useEffect(() => {
    if (pdpViewTracked.current === product.handle) return;
    pdpViewTracked.current = product.handle;
    trackEvent('PDP View', {
      props: {product: product.handle, source: attributionSource()},
    });
  }, [product.handle]);

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

  // Coming-soon state: no prices, no add-to-cart — the buy module becomes a
  // notify-at-launch signup. Root data feeds the global flag + Turnstile key.
  const rootData = useRouteLoaderData<RootLoader>('root');
  const globalComingSoon = rootData?.comingSoon ?? true;
  // Lifecycle status drives the buy module: 'idea' and 'development' are
  // both not-purchasable (`soon`), but render different plates.
  const status = useProductStatus(product.handle);
  const soon = status !== 'live';

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title} = product;



  const primaryCollection = product.collections?.nodes?.[0];
  // isEditorial: this handle has a real PRODUCT_CONTENT entry. Fallback
  // products (accessories like straps and hardware kits) are not open-source
  // hardware — they must not claim a CERN-OHL-S license or render the
  // "Open for learning" chapter pointing at the GitHub org.
  const isEditorial = Boolean(PRODUCT_CONTENT[product.handle]);
  const content = PRODUCT_CONTENT[product.handle] ?? PRODUCT_CONTENT_FALLBACK;
  const hasHeroCopy = Boolean(content.hero.line1);
  // Star aggregate from the review-synced metafields. Gated on the loader's
  // env check so the whole feature stays invisible until the review
  // provider is configured — and on count > 0, so a zero-review store
  // (coming-soon today) renders no trace of it anywhere.
  const reviewAggregate = reviewsOn
    ? parseReviewAggregate(
        product.reviewsRating?.value,
        product.reviewsRatingCount?.value,
      )
    : null;

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

  // Gallery: dedupe by URL and, on tiered products, hide images whose
  // filename names a DIFFERENT tier (openesc-20x20-back.png has no business
  // in the 30×30 deck). Normalizes '20×20' → '20x20' for the filename match;
  // images naming no tier (lifestyle shots) always stay.
  const galleryImages = useMemo(() => {
    const nodes = product.images?.nodes?.length
      ? product.images.nodes
      : selectedVariant?.image
        ? [selectedVariant.image]
        : [];
    const seen = new Set<string>();
    const deduped = nodes.filter((img) => {
      const key = img.url.split('?')[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const tierKeys = content.variants ? Object.keys(content.variants) : [];
    if (tierKeys.length < 2) return deduped;
    const norm = (v: string) =>
      v.trim().toLowerCase().replace(/[×x]/g, 'x').replace(/\s+/g, '');
    const active = norm(activeTier);
    const keys = tierKeys.map(norm).filter(Boolean);
    // Longest-match-wins: tier keys can be substrings of each other
    // (Lite vs Lite-UFL). Naively excluding every other-tier key dropped
    // the Lite-UFL render under its own tier ("lite" matches inside
    // "lite-ufl"), leaving an empty gallery. An image belongs to the
    // longest tier key its filename contains; keep it when that's the
    // active tier or when it names no tier at all.
    return deduped.filter((img) => {
      const name = img.url.split('?')[0].toLowerCase();
      const best = keys
        .filter((k) => name.includes(k))
        .sort((a, b) => b.length - a.length)[0];
      return !best || best === active;
    });
  }, [product.images, selectedVariant?.image, content.variants, activeTier]);

  // GitHub links (repo card / issues / latest commit) follow the selected tier:
  // split-repo lines (OpenFC-Lite ↔ OpenFC-Lite-Mini, OpenESC-20x20 ↔
  // OpenESC-30x30) point at the tier's repo, others at the product default.
  const activeRepoUrl = activeVariant?.repoUrl ?? content.repoUrl;
  // OSHWA certification follows the selected tier — each certified board has its
  // own UID, so the chip links to the directory page for the active variant.
  const activeOshwaUid = activeVariant?.oshwaUid ?? content.oshwaUid;
  // Repo whose commit history backs the "Open for learning" row's 4th card —
  // the bundle's first component repo, else the selected tier's repo. Used as
  // the fallback link when the live latest-commit fetch is rate-limited.
  const commitHistoryRepoUrl = content.bundle
    ? content.bundle.components
        .map((c) => PRODUCT_CONTENT[c.handle]?.repoUrl)
        .find((url): url is string => Boolean(url))
    : activeRepoUrl;
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

  // "Buy it as a stack": for each configured partner (FC↔ESC), resolve the
  // variant matching the selected mount size and prebuild BOTH cart lines.
  // The offers surface as a hover flyout on the add-to-cart CTA, so ordering
  // the pair is one extra click; more partners later (an OpenFC Pro) just
  // become more rows. The 10% itself is the Shopify automatic BXGY at
  // checkout, and it is off the discountedHandle board ONLY (the OpenESC),
  // never the pair: when that board is the partner being added, its shown
  // price is pre-discounted (with the full price struck) so it matches what
  // checkout charges; when it is this product, the badge names it instead.
  const stackCfg = content.stack;
  const stackAxis = (stackCfg?.matchOption ?? 'Model').trim().toLowerCase();
  const stackMatchValue =
    selectedVariant?.selectedOptions?.find(
      (o: {name: string; value: string}) =>
        o.name.trim().toLowerCase() === stackAxis,
    )?.value ?? activeTier;
  const stackOffers = useMemo(() => {
    if (!stackCfg || !selectedVariant) return [];
    return stackCfg.partners.flatMap((pc) => {
      // A partner that hasn't launched can't join a stack offer — its price
      // and add-to-cart must stay hidden even when this product is live.
      if (isComingSoon(pc.handle, globalComingSoon)) return [];
      const pp = stackProducts?.find((p) => p.handle === pc.handle);
      const nodes = pp?.variants?.nodes ?? [];
      // Exact size match ONLY: the pill names the selected size, so a
      // fallback variant of another size would silently add the wrong board.
      // No match -> no offer.
      const match = nodes.find((n) =>
        n.selectedOptions?.some(
          (o) =>
            o.name.trim().toLowerCase() === stackAxis &&
            o.value.trim().toLowerCase() ===
              stackMatchValue.trim().toLowerCase(),
        ),
      );
      if (!match) return [];
      const pct = stackCfg.discountPct;
      const partnerDiscounted =
        Boolean(pct) && stackCfg.discountedHandle === pc.handle;
      const selfDiscounted =
        Boolean(pct) && stackCfg.discountedHandle === product.handle;
      return [
        {
          key: pc.handle,
          label: pc.label ?? pp?.title ?? pc.handle,
          size: stackMatchValue,
          price:
            partnerDiscounted && pct
              ? stackDiscountedPrice(match.price, pct)
              : match.price,
          compareAtPrice: partnerDiscounted ? match.price : null,
          pct,
          discountedLabel: selfDiscounted ? product.title : undefined,
          available:
            match.availableForSale &&
            Boolean(selectedVariant.availableForSale),
          lines: [
            {
              merchandiseId: selectedVariant.id,
              quantity: 1,
              selectedVariant,
            },
            {
              merchandiseId: match.id,
              quantity: 1,
              // Minimal optimistic shape: enough for useOptimisticCart to
              // render the pending line instead of console-erroring.
              selectedVariant: {
                id: match.id,
                title: stackMatchValue,
                availableForSale: match.availableForSale,
                price: match.price,
                image: null,
                product: {
                  title: pc.label ?? pp?.title ?? pc.handle,
                  handle: pc.handle,
                },
                selectedOptions: match.selectedOptions ?? [],
              } as unknown as NonNullable<
                typeof selectedVariant
              >,
            },
          ],
        },
      ];
    });
  }, [stackCfg, stackProducts, selectedVariant, stackAxis, stackMatchValue, globalComingSoon, product.handle, product.title]);

  // The teardown board art follows the selected tier: a variant's own
  // `boardArt` wins, otherwise the shared `teardown.boardArt` (the default
  // board) is shown. Lines without per-tier art just keep the default.
  const activeBoardArt = activeVariant?.boardArt ?? content.teardown?.boardArt;
  // The teardown pin list follows the tier the same way the board art does:
  // each board in a line has its own refdes layout, so a tier's own `pins`
  // win over the shared `teardown.pins` default. Keeps the hover-highlight
  // refdes matched to the board currently shown.
  // Memoised so its reference is stable per tier — the deferred-swap effect below
  // keys on it and calls setState, so a fresh `?? []` array every render would
  // loop it.
  const activePins = useMemo(
    () => activeVariant?.pins ?? content.teardown?.pins ?? [],
    [activeVariant, content.teardown],
  );
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
  // The teardown list lags a tier swap on purpose. When the board animates a
  // variant change its layers fly across the copy column (the intro cadence),
  // briefly covering the part list — so we hold the OLD pins and switch to the
  // new ones mid-flight, behind the flying boards, instead of snapping the list
  // the instant the tier changes. Reduced-motion (or mobile, where the swap is a
  // quick block slide with no cover) swaps immediately.
  const [displayedPins, setDisplayedPins] = useState(activePins);
  const [pinsSwapping, setPinsSwapping] = useState(false);
  // The component table crossfades on its OWN clock when the pins change — NOT
  // slaved to the board swap. (Tying it to onSwapSettle made the content switch
  // land ~1.1s in, after the dip had already faded back to opacity 1, so the new
  // rows snapped in visibly.) Now: fade out → switch the rows while fully hidden
  // (mid-dip) → fade in. activePins is a memo that only changes identity on a real
  // tier change, so the ref compare fires exactly once per switch.
  const prevPinsRef = useRef(activePins);
  useEffect(() => {
    if (prevPinsRef.current === activePins) return;
    prevPinsRef.current = activePins;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplayedPins(activePins);
      return;
    }
    setPinsSwapping(true);
    // Switch the rows at the dip's hidden trough (44–56% of 0.52s = 229–291ms),
    // then let the dip fade the new rows back in — no visible row snap.
    const tSwap = setTimeout(() => setDisplayedPins(activePins), 235);
    const tDone = setTimeout(() => setPinsSwapping(false), 520);
    return () => {
      clearTimeout(tSwap);
      clearTimeout(tDone);
    };
  }, [activePins]);
  // Partition pins by the dominant side of their refs. Until the map loads (or
  // for pins with no resolvable side) pins fall into `other`, rendered flat.
  const groupedPins = useMemo(() => {
    const top: ChapterPin[] = [];
    const bottom: ChapterPin[] = [];
    const other: ChapterPin[] = [];
    for (const pin of displayedPins) {
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
  }, [displayedPins, pinSides]);
  // Flat tour order for the mobile "swipe the board sideways to step through the
  // parts" gesture — front parts top→bottom, then back, then any unsided. Each
  // carries its full highlight spec (the same one its table row uses). Chip rows
  // (I/O pads) expand to one stop per chip.
  type TourPart = {
    refs: string[];
    union: boolean;
    groups?: string[][];
    name: string;
    cost?: string;
  };
  // Split the tour into a top-side row and a bottom-side row (mobile shows them
  // as two chip rows). Unsided pins ride along with the bottom row.
  const partRows = useMemo(() => {
    const toParts = (pins: ChapterPin[]) => {
      const out: TourPart[] = [];
      for (const pin of pins) {
        if (pin.chips?.length) {
          for (const chip of pin.chips)
            if (chip.refs?.length)
              out.push({
                refs: chip.refs,
                union: false,
                name: chip.label,
                cost: copyText('product-chrome.teardown_io_tag'),
              });
        } else if (pin.refs?.length) {
          out.push({
            refs: pin.refs,
            union: pin.box === 'union',
            groups: pin.boxGroups,
            name: pin.part,
            cost: pin.cost ?? '×1',
          });
        }
      }
      return out;
    };
    return {
      top: toParts(groupedPins.top),
      bottom: toParts([...groupedPins.bottom, ...groupedPins.other]),
    };
  }, [groupedPins]);
  const orderedParts = useMemo(
    () => [...partRows.top, ...partRows.bottom],
    [partRows],
  );
  const isMobile = useIsMobile();
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
  // BoardArt remounts on a product switch while the PDP stays mounted, so
  // reset the fly-in flag for the incoming board.
  useEffect(() => {
    setBoardFlying(false);
  }, [product.handle]);
  // Clear all hover highlight state. Called only when the pointer leaves the
  // whole list (not between rows) so the spotlight stays lit and just moves from
  // row to row — no off/on flicker crossing the dividers/gaps.
  const clearHover = () => {
    setHoveredRefs([]);
    setHoveredUnion(false);
    setHoveredGroups(undefined);
  };
  // Is this part the one currently lit on the board (its chip shows as active)?
  const partLit = (p: TourPart) =>
    p.refs.length === hoveredRefs.length &&
    p.refs.every((r) => hoveredRefs.includes(r));
  // One teardown-pin <li>: the part label (+ optional count); hover/focus
  // highlights its footprint(s) on the board (keyboard mirrors mouse for a11y).
  const renderPin = (pin: ChapterPin) => {
    const refs = pin.refs;
    // Chip-row pin (e.g. FC I/O pads): one row, a horizontal set of chips, each
    // highlighting its own pad group on hover/focus.
    if (pin.chips?.length) {
      return (
        <li key={pin.ref} className="teardown-pin teardown-io-row">
          <Txt
            id="product-chrome.teardown_io_tag"
            as="span"
            className="teardown-io-tag"
          />
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
  // <960px the pinned rail becomes a bottom bar (price + add-to-cart only):
  // phones previously had NO sticky buy control at all once the in-hero buy
  // module scrolled away.
  const [railMobile, setRailMobile] = useState(false);

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
  // charges), not the Shopify master-variant placeholder. Coming soon → no
  // offer at all: structured data must not leak a price the page hides.
  const jsonLdPrice = soon
    ? undefined
    : content.bundle
      ? bundlePrice
      : selectedVariant?.price;
  const productJsonLd = buildProductJsonLd({
    title: product.title,
    description: product.description,
    imageUrl: selectedVariant?.image?.url ?? galleryImages[0]?.url ?? null,
    url: `${SITE_ORIGIN}/products/${product.handle}`,
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
    // AggregateRating rides only when reviews are enabled and count > 0 —
    // same gate as the visible stars, so the structured data never claims
    // ratings the page doesn't show.
    rating: reviewAggregate,
  });

  // The ladder + buy module. These two nodes are rendered twice: once in the
  // hero (in normal flow — it scrolls past like any content) and, once the
  // in-hero selector has scrolled under the header, again in a compact bar
  // pinned to the top so a variant switcher + add-to-cart is always reachable.
  // Both copies share `activeTier`, so switching in either keeps them in sync.
  // Ladder clicks are the PDP's main variant switch: track them as
  // `Variant Select` (user-initiated only; deep links and Shopify
  // re-syncs go through setActiveTier directly and stay silent). Only an
  // actual change counts: the ladder fires onSelect for clicks on the
  // already-active tier too, and re-clicks are not selections.
  const selectTier = (value: string) => {
    if (value !== activeTier) {
      trackEvent('Variant Select', {
        props: {
          product: product.handle,
          variant: value,
          source: attributionSource(),
        },
      });
    }
    setActiveTier(value);
  };
  const railLadder =
    hasLadder && content.optionAxis && content.variants ? (
      <VariantLadder
        axis={content.optionAxis}
        variants={content.variants}
        productOptions={productOptions}
        activeValue={activeTier}
        onSelect={selectTier}
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
        onSelect={selectTier}
      />
    ) : null;
  // The two firmware trust chips stay ONE editable sentence each: the firmware
  // project's name and the component count are data, so the copy marks their
  // slots with `{project}` / `{count}` / `{firmwares}` and the sentence is split
  // around them here.
  const firmwareChipParts = (
    copyText('product-chrome.trust_chip_firmware') ?? ''
  ).split('{project}');
  const bundleChipParts = (
    copyText('product-chrome.trust_chip_firmware_bundle') ?? ''
  ).split('{firmwares}');
  const isBundle = Boolean(content.bundle);
  const buyPrice = isBundle ? bundlePrice : selectedVariant?.price;
  const buyAvailable = isBundle
    ? bundleAvailable
    : Boolean(selectedVariant?.availableForSale);
  // Coming-soon buy module: the price/stock/add-to-cart block becomes a
  // COMING SOON plate + notify-at-launch signup (same newsletter action,
  // tagged with this product's handle). Everything else on the PDP stays.
  const railBuyModule = soon ? (
    <div
      className={`product-buy is-comingsoon${status === 'idea' ? ' is-idea' : ''}`}
      data-buy-module
    >
      <div className="product-buy-price">
        <Txt
          id={
            status === 'idea'
              ? 'product-chrome.buy_status_concept'
              : 'product-chrome.buy_status_soon'
          }
          as="span"
          className="product-buy-soon"
          aria-label={copyText(
            status === 'idea'
              ? 'product-chrome.buy_status_concept'
              : 'product-chrome.buy_status_soon',
          )}
        />
        {content.statusNote ? (
          <span className="product-buy-sku">{content.statusNote}</span>
        ) : selectedVariant?.sku ? (
          <span className="product-buy-sku">
            {copyText('product-chrome.buy_sku_prefix')}{' '}
            {selectedVariant.sku}
          </span>
        ) : null}
      </div>
      {status === 'idea' ? (
        <Txt
          id="product-chrome.buy_idea_pitch"
          as="p"
          className="product-buy-idea-pitch"
        />
      ) : null}
      <NewsletterSignup
        notify={{productHandle: product.handle, productTitle: product.title}}
        turnstileSiteKey={rootData?.turnstileSiteKey ?? null}
        className="product-buy-notify"
      />
      {status === 'idea' ? (
        <a
          className="product-buy-idea-repo"
          href={content.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copyText('product-chrome.buy_idea_repo_cta')}
        </a>
      ) : null}
    </div>
  ) : (
    <div className="product-buy" data-buy-module>
      <div className="product-buy-price">
        {/* Price + the "incl. VAT" qualifier (Art. VI.45 WER pre-contractual
            info) grouped together — also fills the dead space beside the price. */}
        <span className="product-buy-amount">
          <ProductPrice
            price={buyPrice}
            compareAtPrice={isBundle ? undefined : selectedVariant?.compareAtPrice}
          />
          <Txt
            id="product-chrome.buy_vat_note"
            as="span"
            className="product-buy-vat"
          />
        </span>
        {isBundle ? (
          <span className="product-buy-sku">
            {/* Name the actual pair for the tier (20×20 ships the Mini). */}
            {content.variants?.[activeTier]?.highlights?.find(
              ([k]) => k === 'Pair',
            )?.[1] ?? `OpenFC-Lite + OpenESC · ${activeTier}`}
          </span>
        ) : selectedVariant?.sku ? (
          <span className="product-buy-sku">
            {copyText('product-chrome.buy_sku_prefix')}{' '}
            {selectedVariant.sku}
          </span>
        ) : null}
      </div>
      <span className={`product-buy-stock${buyAvailable ? '' : ' is-out'}`}>
        {isBundle
          ? copyText(
              buyAvailable
                ? 'product-chrome.buy_stock_bundle_in'
                : 'product-chrome.buy_stock_bundle_out',
            )
          : selectedVariant?.availableForSale
            ? copyText('product-chrome.buy_stock_in')
            : content.statusNote
              ? `${copyText('product-chrome.buy_stock_out') ?? ''} · ${content.statusNote}`
              : copyText('product-chrome.buy_stock_out')}
      </span>
      {!isBundle && selectedVariant && !selectedVariant.availableForSale ? (
        <NewsletterSignup
          notify={{productHandle: product.handle, productTitle: product.title}}
          turnstileSiteKey={rootData?.turnstileSiteKey ?? null}
          className="product-buy-notify"
        />
      ) : null}
      {/* Star aggregate + link to the reviews chapter. Renders nothing
          without reviews; CSS hides it in the compact pinned rail. */}
      <ReviewAggregateLine aggregate={reviewAggregate} />
      <ProductForm
        productOptions={productOptions}
        selectedVariant={selectedVariant}
        hideOptionNames={content.optionAxis ? [content.optionAxis] : undefined}
        bundleLines={isBundle ? bundleLines : undefined}
        bundleDisabled={isBundle ? !bundleAvailable : undefined}
        bundleCtaLabel={
          isBundle ? copyText('product-chrome.buy_bundle_cta') : undefined
        }
        stackOffers={stackOffers}
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
  // aside is open so it doesn't sit on top of the cart. It stays live through the
  // teardown chapter (the board no longer pins full-screen there) so variant/SKU
  // switching is reachable everywhere on the page, not just above the fold.
  const railSuppressed = railPinned && asideType !== 'closed';
  const pinnedRail = (
    <div
      className={`buy-rail is-pinned${railMobile ? ' is-mobile' : ''}${railSuppressed ? ' is-suppressed' : ''}`}
      style={railBox && !railMobile ? {right: railBox.right} : undefined}
    >
      {railMobile ? railLadderCompact : railLadder}
      {railBuyModule}
    </div>
  );

  /** Copy id behind a free-text chapter: one pair of strings per chapter id. */
  const proseKey = (id: string | undefined, part: 'title' | 'body') =>
    `products.${product.handle}.${id ?? ''}_${part}`;

  /**
   * Does a chapter of this type have anything to show on THIS product?
   *
   * These are the conditions that used to gate each inline block, unchanged.
   * They stay in the route rather than moving into the config because their
   * answers come from three places `content/chapters.json` cannot see: whether
   * the handle has an editorial entry at all, the product's lifecycle status,
   * and the Shopify review metafields.
   */
  const present = (type: ChapterType, entry: ChapterEntry): boolean => {
    switch (type) {
      // Accessories (fallback content) aren't open-hardware products — no
      // "Open for learning" chapter, and no chapter number burnt on it.
      case 'openSource':
        return isEditorial;
      case 'teardown':
        return Boolean(content.teardown);
      case 'specs':
        return content.specs.length > 0;
      case 'inTheBox':
        return content.inTheBox.length > 0 || Boolean(content.bundle);
      case 'downloads':
        return content.downloads.length > 0;
      // The firmware credit needs no price, so it shows even while the
      // product is coming soon.
      case 'firmware':
        return (
          !content.bundle &&
          Boolean(content.firmware.project) &&
          content.firmware.project !== '—'
        );
      // Every editorial product has a public repo, so the chapter always exists
      // for them — the grid degrades to the "+ you" invitation when the GitHub
      // API is rate-limited.
      case 'contributors':
        return isEditorial;
      // Only when the feature is enabled AND the synced metafields carry at
      // least one rating, so a zero-review store shows no trace of it.
      case 'reviews':
        return Boolean(reviewAggregate);
      // A free-text chapter exists once it has words. Keyed by the chapter's
      // id, so several of them on one page stay distinct.
      case 'prose':
        return copy(proseKey(entry.id, 'body')) !== undefined;
      default:
        return false;
    }
  };

  /**
   * How each chapter type draws itself.
   *
   * The data model picks which of these run and in what order; it does not pick
   * how they look. `n` is the number `resolveChapters` assigned from position,
   * so it cannot drift from the render order. `title` is the studio's optional
   * override — absent, the designed title (inline `<em>` and all) stands.
   */
  const chapterNodes: Partial<
    Record<
      ChapterType,
      (n: string, title?: string, id?: string) => React.ReactNode
    >
  > = {
    /** What the board is published as: repos, license, latest commit. */
    openSource: (n, title) => (
      <Chapter
        number={n}
        label="Open for learning"
        title={title}
        titleId="product-chrome.ch_open_source_title"
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
                  className="open-source-card open-source-card--github"
                >
                  <p className="open-source-card-label">{c.title}</p>
                  <Txt
                    id="product-chrome.os_card_repo_title"
                    as="p"
                    className="open-source-card-title"
                  />
                  <Txt
                    id="product-chrome.os_card_repo_sub_bundle"
                    as="p"
                    className="open-source-card-sub"
                  />
                </a>
              );
            })
          ) : (
            <>
              {/* Build-video bubble leads the row on products that have a film
                  (FC, ESC); other products fall back to the issues card. */}
              {content.video ? (
                <WatchCard
                  videoId={content.video.id}
                  title={content.video.title}
                  channel={content.video.channel}
                />
              ) : null}
              <a
                href={activeRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="open-source-card open-source-card--github"
              >
                <Txt
                  id="product-chrome.os_card_study_label"
                  as="p"
                  className="open-source-card-label"
                />
                <Txt
                  id="product-chrome.os_card_repo_title"
                  as="p"
                  className="open-source-card-title"
                />
                {/* CAD products (the frame) have no schematic/PCB. */}
                <Txt
                  id={
                    content.teardown?.frameViewer
                      ? 'product-chrome.os_card_repo_sub_cad'
                      : 'product-chrome.os_card_repo_sub'
                  }
                  as="p"
                  className="open-source-card-sub"
                />
              </a>
              {content.video ? null : (
                <a
                  href={`${activeRepoUrl}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="open-source-card"
                >
                  <Txt
                    id="product-chrome.os_card_issues_label"
                    as="p"
                    className="open-source-card-label"
                  />
                  <Txt
                    id="product-chrome.os_card_issues_title"
                    as="p"
                    className="open-source-card-title"
                  />
                  <Txt
                    id="product-chrome.os_card_issues_sub"
                    as="p"
                    className="open-source-card-sub"
                  />
                </a>
              )}
            </>
          )}
          {activeOshwaUid ? (
            // OSHWA-certified: lead with the open-hardware certification (links
            // the public cert page for this UID) and keep the CERN-OHL-S license
            // name on the sub-line — the certification attests the license, it
            // doesn't replace it.
            <a
              href={`https://certification.oshwa.org/${activeOshwaUid.toLowerCase()}.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="open-source-card open-source-card--oshwa"
            >
              <OshwaMark
                uid={activeOshwaUid}
                title={`${copyText('product-chrome.oshwa_mark_title') ?? ''} · ${activeOshwaUid}`}
                className="open-source-card-oshwa-mark"
              />
              <Txt
                id="product-chrome.os_card_oshwa_sub"
                as="p"
                className="open-source-card-sub open-source-card-sub--oshwa"
              />
            </a>
          ) : (
            <a
              href="https://ohwr.org/cern_ohl_s_v2.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="open-source-card open-source-card--cern"
            >
              <Txt
                id="product-chrome.os_card_license_label"
                as="p"
                className="open-source-card-label"
              />
              <Txt
                id="product-chrome.os_card_license_title"
                as="p"
                className="open-source-card-title"
              />
              <Txt
                id="product-chrome.os_card_license_sub"
                as="p"
                className="open-source-card-sub"
              />
            </a>
          )}
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
                {(commits) => {
                  // Bundles show one commit card per component repo; a single
                  // product (incl. split-repo lines) prefers the selected tier's
                  // repo so the card tracks the ladder. But the loader only
                  // fetches the product-default repo (per-tier fetches blew the
                  // 60/hr unauth rate limit), so on split-repo tiers no commit
                  // matches activeRepoUrl — fall back to the fetched commit
                  // rather than degrading to the static changelog card.
                  const all = commits ?? [];
                  const matched = all.filter(
                    (c) => c.repoUrl === activeRepoUrl,
                  );
                  const shown = content.bundle
                    ? all
                    : matched.length
                      ? matched
                      : all;
                  return shown.length ? (
                    shown.map((c) => (
                      <LatestCommitCard key={c.sha + c.repoUrl} commit={c} />
                    ))
                  ) : (
                    <CommitHistoryCard repoUrl={commitHistoryRepoUrl} />
                  );
                }}
              </Await>
            </Suspense>
          ) : null}
        </div>
      </Chapter>
    ),
    /** What it is made of: board art or exploded frame, plus the pin map. */
    teardown: (n, title) => (
        <Chapter
          number={n}
          label="Teardown"
          title={title}
          titleId={
            frameViewer
              ? 'product-chrome.ch_teardown_title_frame'
              : 'product-chrome.ch_teardown_title'
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
                />
                {/* Part tour: which component is lit + how far through the set.
                    Swipe the board sideways (or tap a part) to step. Each tick is
                    tappable to jump straight to that part. */}
                {isMobile && orderedParts.length ? (
                  <div className="board-part-tour">
                    <p className="board-part-tour-head" aria-live="polite">
                      <Txt
                        id="product-chrome.teardown_tour_heading"
                        as="span"
                        className="board-deck-name"
                      />
                      <Txt
                        id="product-chrome.teardown_tour_hint"
                        as="span"
                        className="board-deck-hint"
                      />
                    </p>
                    {/* Real, labelled, thumb-sized chips split into a top-side and
                        a bottom-side row — not one long scroller. Tap one to
                        spotlight that part on the board; each row scrolls for the
                        rest. */}
                    {[
                      {
                        key: 'top',
                        label: copyText('product-chrome.teardown_side_top'),
                        aria: copyText('product-chrome.teardown_side_top_aria'),
                        parts: partRows.top,
                      },
                      {
                        key: 'bottom',
                        label: copyText('product-chrome.teardown_side_bottom'),
                        aria: copyText(
                          'product-chrome.teardown_side_bottom_aria',
                        ),
                        parts: partRows.bottom,
                      },
                    ]
                      .filter((row) => row.parts.length)
                      .map((row) => (
                        <div
                          key={row.key}
                          className="board-part-chips"
                          aria-label={row.aria}
                        >
                          <span className="board-part-chips-side">{row.label}</span>
                          {row.parts.map((p, i) => {
                            const lit = partLit(p);
                            return (
                              <button
                                type="button"
                                key={p.name + i}
                                className={`board-part-chip${lit ? ' is-active' : ''}`}
                                aria-pressed={lit}
                                onClick={() => {
                                  setHoveredRefs([...p.refs]);
                                  setHoveredUnion(p.union);
                                  setHoveredGroups(p.groups);
                                }}
                              >
                                {/* Just the model/short name on the chip (e.g.
                                    "RP2354A"), not the whole descriptive sentence
                                    — split off anything after a dash/middot. */}
                                {p.name.split(/\s+[—–·-]\s+/)[0]}
                                {p.cost && p.cost !== '×1' ? (
                                  <span className="board-part-chip-qty">{p.cost}</span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                  </div>
                ) : null}
              </>
            ) : undefined
          }
        >
          {groupedPins.top.length > 0 && groupedPins.bottom.length > 0 ? (
            <div
              className={`teardown-sides${boardFlying ? ' is-locked' : ''}${
                pinsSwapping ? ' is-swapping' : ''
              }`}
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
              className={`teardown-sides${boardFlying ? ' is-locked' : ''}${
                pinsSwapping ? ' is-swapping' : ''
              }`}
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
              {copyText('product-chrome.teardown_inspect_cta')}
            </a>
          ) : null}
        </Chapter>
    ),
    /** What it measures. */
    specs: (n, title) => (
        <Chapter
          number={n}
          label="Datasheet"
          title={title}
          titleId="product-chrome.ch_specs_title"
          noMedia
        >
          <dl className="spec-table">
            {mergedSpecs.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                {/* Count-up on the numeric runs the first time the table
                    scrolls into view. spec-table already sets tabular-nums,
                    so digits don't jitter mid-count; reduced-motion and
                    variant-switch re-renders are handled inside. */}
                <dd>
                  <AnimatedNumber value={v} />
                </dd>
              </div>
            ))}
          </dl>
          {content.footnote ? (
            <p className="chapter-footnote">{content.footnote}</p>
          ) : null}
        </Chapter>
    ),
    /** What ships. */
    inTheBox: (n, title) => (
        <Chapter
          number={n}
          label="In the box"
          title={title}
          titleId={
            content.bundle
              ? 'product-chrome.ch_in_the_box_title_bundle'
              : 'product-chrome.ch_in_the_box_title'
          }
        >
          {content.bundle ? (
            <Txt
              id="product-chrome.in_the_box_bundle_body"
              as="p"
              className="chapter-body"
            />
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
                    {copyText('product-chrome.bundle_component_firmware_label')}{' '}
                    <span>{c.firmware}</span>
                  </p>
                  <Txt
                    id="product-chrome.bundle_component_more"
                    as="span"
                    className="bundle-component-more"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          ) : null}
          <ProvenanceCard
            designNote={
              // The frame is a CAD product — "schematic, PCB, BOM" is PCB
              // wording that doesn't apply to carbon plates.
              content.teardown?.frameViewer
                ? copyText('product-chrome.provenance_design_note_cad')
                : undefined
            }
          />
        </Chapter>
    ),
    /** The files themselves. */
    downloads: (n, title) => (
        <Chapter
          number={n}
          label="Downloads"
          title={title}
          titleId="product-chrome.ch_downloads_title"
        >
          <Txt
            id="product-chrome.downloads_intro"
            as="p"
            className="chapter-body"
          />
          <DownloadsGrid downloads={content.downloads} />
        </Chapter>
    ),
    /** The open firmware the board runs, and how to support its devs. */
    firmware: (n, title) => (
        <Chapter
          number={n}
          label="Firmware"
          title={title}
          titleId="product-chrome.ch_firmware_title"
          media={
            content.firmware.logo ? (
              /* Not loading="lazy": same reason as the contributor avatars,
                 a lazy image inside a content-visibility: auto chapter is
                 treated as far offscreen and never fetched. */
              <img
                className={
                  content.firmware.logoDark
                    ? 'firmware-logo firmware-logo--tile'
                    : 'firmware-logo'
                }
                src={content.firmware.logo}
                alt={`${content.firmware.project} ${copyText('product-chrome.firmware_logo_alt_suffix') ?? ''}`}
                decoding="async"
              />
            ) : undefined
          }
        >
          <FirmwareSupport
            firmwareProject={content.firmware.project}
            firmwareUrl={content.firmware.projectUrl}
          />
        </Chapter>
    ),
    /**
     * Who built it. GitHub accounts with commits on the product's repos,
     * streamed in deferred. The grid always closes with a "+ you" tile pointing
     * at the issues page; when GitHub rate-limits the fetch the chapter still
     * renders with just that invitation.
     */
    contributors: (n, title) => (
        <Chapter
          number={n}
          label="Contributors"
          title={title}
          titleId="product-chrome.ch_contributors_title"
          noMedia
        >
          {/* Repo activity as engraving behind the text: one faint tick per
              commit, streamed with the same best-effort GitHub budget as the
              grid below. Null on failure, invisible on quiet repos. */}
          <Suspense fallback={null}>
            <Await resolve={commitActivity} errorElement={null}>
              {(commits) => <CommitTimeline commits={commits} />}
            </Await>
          </Suspense>
          {/* The intro has to stream with the grid, not ahead of it. GitHub's
              unauthenticated API allows 60 calls an hour per IP, so an empty
              list is routine, and "these are the accounts behind X" above a
              lone "+ you?" tile reads as nobody having built the thing. */}
          <Suspense
            fallback={
              <>
                <ContributorsIntro empty />
                <ContributorGridSkeleton />
              </>
            }
          >
            <Await
              resolve={contributors}
              errorElement={
                <>
                  <ContributorsIntro empty />
                  <ContributorGrid
                    contributors={[]}
                    issuesUrl={`${activeRepoUrl}/issues`}
                  />
                </>
              }
            >
              {(list) => (
                <>
                  <ContributorsIntro empty={!list?.length} title={product.title} />
                  <ContributorGrid
                    contributors={list ?? []}
                    issuesUrl={`${activeRepoUrl}/issues`}
                  />
                </>
              )}
            </Await>
          </Suspense>
        </Chapter>
    ),
    /**
     * Judge.me data, own markup (no widget). Bodies stream in deferred; a fetch
     * failure degrades to the aggregate count line.
     */
    reviews: (n, title) => {
      // `present` already ruled this out, but the aggregate is read half a
      // dozen times below and the compiler wants the narrowing spelled out.
      if (!reviewAggregate) return null;
      return (
        <Chapter
          id="reviews"
          number={n}
          label="Reviews"
          title={title}
          titleId="product-chrome.ch_reviews_title"
          noMedia
        >
          {/* The aggregate is Shopify data, so the framing sentence marks its
              slots with `{average}`, `{count}` and `{ratings}` and stays one
              editable string. */}
          <p className="chapter-body" {...editAttrs('product-chrome.reviews_intro')}>
            {(copyText('product-chrome.reviews_intro') ?? '')
              .replace('{average}', reviewAggregate.value.toFixed(1))
              .replace('{count}', String(reviewAggregate.count))
              .replace(
                '{ratings}',
                copyText(
                  reviewAggregate.count === 1
                    ? 'product-chrome.reviews_rating_one'
                    : 'product-chrome.reviews_rating_many',
                ) ?? '',
              )}
          </p>
          <Suspense
            fallback={<ReviewListFallback totalCount={reviewAggregate.count} />}
          >
            <Await
              resolve={reviews}
              errorElement={
                <ReviewListFallback totalCount={reviewAggregate.count} />
              }
            >
              {(list) =>
                list && list.length > 0 ? (
                  <ReviewList
                    reviews={list}
                    totalCount={reviewAggregate.count}
                  />
                ) : (
                  <ReviewListFallback totalCount={reviewAggregate.count} />
                )
              }
            </Await>
          </Suspense>
        </Chapter>
      );
    },
    /**
     * The generic type. Everything it says comes from the copy store, so the maintainer
     * can add as many as he likes without a code change.
     */
    prose: (n, title, id) => {
      const titleId = proseKey(id, 'title');
      // A missing title must leave no heading at all. `<Txt>` renders nothing
      // for an absent key, but the element is still truthy, so Chapter would
      // draw an empty <h2>.
      const heading =
        title ??
        (copy(titleId) === undefined ? null : <Txt id={titleId} as="span" />);
      return (
        <Chapter number={n} label="Free text" title={heading} noMedia>
          <Txt id={proseKey(id, 'body')} as="p" className="chapter-body" />
        </Chapter>
      );
    },
  };

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
            {copyText('product-chrome.hero_eyebrow_file')} {content.fileNumber} ·{' '}
            {content.family}
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

          <ul
            className="trust-chips"
            aria-label={copyText('product-chrome.trust_chips_aria')}
          >
            {isEditorial ? (
              <li>
                <Link
                  to="/open-source"
                  prefetch="viewport"
                  className="trust-chip trust-chip-green trust-chip-link"
                >
                  {copyText('product-chrome.trust_chip_open_source')}
                </Link>
              </li>
            ) : null}
            {activeOshwaUid ? (
              <li>
                <a
                  href={`https://certification.oshwa.org/${activeOshwaUid.toLowerCase()}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="trust-chip trust-chip-oshwa trust-chip-link"
                  title={`${copyText('product-chrome.oshwa_mark_title') ?? ''} · ${activeOshwaUid}`}
                >
                  <img
                    src="/logos/oshwa.svg"
                    alt=""
                    aria-hidden="true"
                    className="trust-chip-oshwa-mark"
                  />
                  {copyText('product-chrome.trust_chip_oshwa')} ·{' '}
                  {activeOshwaUid}
                </a>
              </li>
            ) : null}
            {content.bundle ? (
              <li>
                <Link
                  to="/firmware-partners"
                  prefetch="viewport"
                  className="trust-chip trust-chip-gold trust-chip-link"
                >
                  {bundleChipParts[0]}
                  {content.bundle.components.map((c) => c.firmware).join(' + ')}
                  {bundleChipParts[1]}
                </Link>
              </li>
            ) : content.firmware.project && content.firmware.project !== '—' ? (
              <li>
                <Link
                  to="/firmware-partners"
                  prefetch="viewport"
                  className="trust-chip trust-chip-gold trust-chip-link"
                >
                  {firmwareChipParts[0]}
                  {content.firmware.project}
                  {firmwareChipParts[1]}
                </Link>
              </li>
            ) : null}
          </ul>

          {/* In-flow buy box — scrolls past with the page like any content,
              so nothing vanishes or leaves a gap. The sentinel sits BELOW the
              buy module: the compact top bar takes over only once the whole
              module (CTA included) is under the header, otherwise the two
              overlap now that the column scrolls normally. */}
          <div className="buy-rail">
            {railLadder}
            {railBuyModule}
            <div
              ref={railSentinelRef}
              className="buy-rail-sentinel"
              aria-hidden="true"
            />
          </div>
          {/* Separate compact bar pinned to the top while the in-hero selector
              is out of view, so variants stay switchable from anywhere. Coming
              soon: nothing to buy, so no pinned bar — an email form fixed to
              the viewport would be noise, and the in-flow signup is enough. */}
          {railPinned && !soon ? createPortal(pinnedRail, document.body) : null}

          {content.pairCta ? (
            <Link className="pair-cta" to={content.pairCta.to} prefetch="viewport">
              <span className="pair-cta-eyebrow">{content.pairCta.eyebrow}</span>
              <span className="pair-cta-title">{content.pairCta.title}</span>
              <span className="pair-cta-arrow" aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>
      </section>

      {/* === Chapters, in the order `content/chapters.json` puts them === */}
      {resolveChapters(product.handle, present).map((c) => (
        <Fragment key={c.id}>
          {chapterNodes[c.type]?.(c.number, c.title, c.id)}
        </Fragment>
      ))}

      <RelatedProducts recommendations={recommendations} />
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              // Coming soon → no price anywhere, analytics payload included.
              price: soon ? '0' : selectedVariant?.price.amount || '0',
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
    # Review aggregates synced into the standard product metafields by the
    # review provider (see app/lib/reviews.ts). Null when no reviews exist.
    reviewsRating: metafield(namespace: "reviews", key: "rating") {
      value
    }
    reviewsRatingCount: metafield(namespace: "reviews", key: "rating_count") {
      value
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

// Shared card shape for the related strip — enough for a spec-forward card
// (render, price band) plus the single variant a quick-add needs. Multi-
// variant lines get no quick-add, so two variant nodes is enough to tell
// "one" from "many" without dragging the whole ladder over the wire.
const RELATED_PRODUCT_CARD_FRAGMENT = `#graphql
  fragment RelatedProductCard on Product {
    id
    handle
    title
    productType
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
    variants(first: 2) {
      nodes {
        id
        availableForSale
        price {
          amount
          currencyCode
        }
        image {
          url
          altText
        }
        selectedOptions {
          name
          value
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
      ...RelatedProductCard
    }
  }
  ${RELATED_PRODUCT_CARD_FRAGMENT}
` as const;

const FALLBACK_PRODUCTS_QUERY = `#graphql
  query FallbackProducts(
    $country: CountryCode
    $first: Int!
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    # The legacy firmware-donation tip product is not catalog; keep it out of related cards.
    products(
      first: $first
      sortKey: BEST_SELLING
      query: "-product_type:Donation"
    ) {
      nodes {
        ...RelatedProductCard
      }
    }
  }
  ${RELATED_PRODUCT_CARD_FRAGMENT}
` as const;
