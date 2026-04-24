import {Suspense, useEffect} from 'react';
import {Await, Link, useLoaderData} from 'react-router';
import type {Route} from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {ProductCompliance} from '~/components/ProductCompliance';
import {RelatedProducts} from '~/components/RelatedProducts';
import {FirmwareSplit} from '~/components/FirmwareSplit';
import {ProvenanceCard} from '~/components/ProvenanceCard';
import {
  LatestCommitGrid,
  LatestCommitSkeleton,
} from '~/components/LatestCommit';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {buildSeoMeta} from '~/lib/seo';
import {getCompanyIdentity} from '~/lib/company';
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

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  const company = getCompanyIdentity(
    context.env as unknown as Record<string, string | undefined>,
  );

  return {
    product,
    company,
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
function computeChapterNumbers(content: ProductContent): ChapterNumbers {
  let n = 1;
  const pad = (x: number) => x.toString().padStart(2, '0');
  const out: ChapterNumbers = {openSource: ''};

  if (content.teardown) {
    out.teardown = pad(n++);
  }
  out.openSource = pad(n++);
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

function Chapter({
  number,
  label,
  title,
  children,
}: {
  number: string;
  label: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="chapter" data-chapter={number}>
      <div className="chapter-index">
        <div className="chapter-number">{number}</div>
        <div className="chapter-label">{label}</div>
      </div>
      <div className="chapter-body-col">
        <h2 className="chapter-title">{title}</h2>
        {children}
      </div>
    </section>
  );
}

/**
 * Scroll-reveal: walk every `.chapter` on the PDP and toggle `.is-visible`
 * when it enters the viewport. CSS handles the fade/translate.
 */
function useChapterReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const chapters = document.querySelectorAll('.chapter');
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
  }, []);
}

export default function Product() {
  const {product, company, recommendations, latestCommits} =
    useLoaderData<typeof loader>();
  useChapterReveal();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

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
  const content = PRODUCT_CONTENT[product.handle] ?? PRODUCT_CONTENT_FALLBACK;
  const hasHeroCopy = Boolean(content.hero.line1);
  const chapterNums = computeChapterNumbers(content);
  const commitSkeletonCount = content.bundle
    ? content.bundle.components.length
    : 1;

  // primaryCollection is retained in the loader but we deliberately
  // don't render a breadcrumb on the PDP — the editorial hero with
  // the "File 0N · Family" eyebrow is the navigation clue instead.
  void primaryCollection;

  return (
    <div className="product-page">
      {/* === HERO: headline left, gallery right === */}
      <section className="product-hero">
        <div className="product-hero-copy">
          <p className="product-hero-eyebrow">
            File {content.fileNumber} · {content.family}
          </p>
          {hasHeroCopy ? (
            <h1 className="product-hero-headline">
              <span>{content.hero.line1}</span>
              <span>
                <em>{content.hero.line2Italic}</em>
              </span>
              <span>{content.hero.line3}</span>
            </h1>
          ) : (
            <h1 className="product-hero-headline">
              <span>{title}</span>
            </h1>
          )}
          {content.hero.lead ? (
            <p className="product-hero-lead">{content.hero.lead}</p>
          ) : null}

          <ul className="trust-chips" aria-label="Certifications">
            <li>
              <Link
                to="/open-source"
                prefetch="intent"
                className="trust-chip trust-chip-green trust-chip-link"
              >
                ● Open source · CERN-OHL-S-2.0
              </Link>
            </li>
            {content.bundle ? (
              <li>
                <Link
                  to="/firmware-partners"
                  prefetch="intent"
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
                  prefetch="intent"
                  className="trust-chip trust-chip-gold trust-chip-link"
                >
                  €1 → {content.firmware.project} maintainers
                </Link>
              </li>
            ) : null}
            <li className="trust-chip">
              {selectedVariant?.availableForSale ? 'In stock' : 'Sold out'}
            </li>
          </ul>

          <div className="product-buy">
            <div className="product-buy-price">
              <ProductPrice
                price={selectedVariant?.price}
                compareAtPrice={selectedVariant?.compareAtPrice}
              />
              {selectedVariant?.sku ? (
                <span className="product-buy-sku">SKU {selectedVariant.sku}</span>
              ) : null}
            </div>
            <ProductForm
              productOptions={productOptions}
              selectedVariant={selectedVariant}
            />
          </div>

          {content.pairCta ? (
            <Link className="pair-cta" to={content.pairCta.to} prefetch="intent">
              <span className="pair-cta-eyebrow">{content.pairCta.eyebrow}</span>
              <span className="pair-cta-title">{content.pairCta.title}</span>
              <span className="pair-cta-arrow" aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>

        <div className="product-hero-right">
          <div className="product-hero-media">
            <ProductGallery
              images={galleryImages}
              activeImageId={selectedVariant?.image?.id ?? null}
            />
          </div>
        </div>
      </section>

      {/* === Chapter: Teardown === */}
      {content.teardown && chapterNums.teardown ? (
        <Chapter
          number={chapterNums.teardown}
          label="Teardown"
          title={content.teardown.title}
        >
          <p className="chapter-body">{content.teardown.body}</p>
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
        </Chapter>
      ) : null}

      {/* === Chapter: Open for learning === */}
      <Chapter
        number={chapterNums.openSource}
        label="Open for learning"
        title="Published so you can study it. Produced so you don't have to."
      >
        <p className="chapter-body">
          The schematic, PCB, BOM and 3D STEP are on GitHub under CERN-OHL-S v2.
          Read them, fork them, ship a variant — the license is the contract.
          What you buy here is the production run: EU manufacturing, CE / EMC,
          QC, packaging, support. That pays for the next design.
        </p>
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
                  Schematic · PCB · BOM · 3D STEP · design notes
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
              Strong reciprocal — share your changes
            </p>
          </a>
        </div>
        <Suspense
          fallback={
            <>
              <p className="chapter-subhead">Live from the repo</p>
              <LatestCommitSkeleton count={commitSkeletonCount} />
            </>
          }
        >
          <Await resolve={latestCommits} errorElement={null}>
            {(commits) => {
              if (!commits || commits.length === 0) return null;
              return (
                <>
                  <p className="chapter-subhead">Live from the repo</p>
                  <LatestCommitGrid commits={commits} />
                </>
              );
            }}
          </Await>
        </Suspense>
      </Chapter>

      {/* === Chapter: In the box (always) === */}
      {(content.inTheBox.length > 0 || content.bundle) &&
      chapterNums.inTheBox ? (
        <Chapter
          number={chapterNums.inTheBox}
          label="In the box"
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
              The bundle is just OpenFC and OpenESC shipped together. No
              combined SKU, no tied hardware — each board is the same one
              you can buy on its own. What you save is courier-and-handling.
              What you don&apos;t lose is the €1 split: each firmware
              project still gets paid from this order.
            </p>
          ) : (
            <p className="chapter-body">
              No stock photo of an open box. Here is the actual parts list.
              Anything missing from a build, say so — we&apos;ll ship it.
            </p>
          )}
          {content.inTheBox.length > 0 ? (
            <ul className="in-the-box">
              {content.inTheBox.map((it) => (
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
                  prefetch="intent"
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
          <ProvenanceCard />
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
        >
          <FirmwareSplit
            price={selectedVariant?.price}
            productTitle={product.title}
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
        >
          <dl className="spec-table">
            {content.specs.map(([k, v]) => (
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
            Straight from the repo. If a link 404s, the file moved — open
            an issue on the matching GitHub repo and we&apos;ll point it
            back.
          </p>
          <DownloadsGrid downloads={content.downloads} />
        </Chapter>
      ) : null}

      {/* === Compliance: SCOPE-locked, unmoved === */}
      <ProductCompliance
        product={{
          title: product.title,
          vendor: product.vendor,
          handle: product.handle,
          safetyWarningsNl: product.safetyWarningsNl,
          datasheetUrl: product.datasheetUrl,
          manualUrl: product.manualUrl,
          docUrl: product.docUrl,
          sbomUrl: product.sbomUrl,
          githubRepo: product.githubRepo,
          modelNumber: product.modelNumber,
          batchId: product.batchId,
        }}
        company={company}
      />

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
    safetyWarningsNl: metafield(namespace: "custom", key: "safety_warnings_nl") {
      ...ComplianceMetafield
    }
    datasheetUrl: metafield(namespace: "custom", key: "datasheet_url") {
      ...ComplianceMetafield
    }
    manualUrl: metafield(namespace: "custom", key: "manual_url") {
      ...ComplianceMetafield
    }
    docUrl: metafield(namespace: "custom", key: "doc_url") {
      ...ComplianceMetafield
    }
    sbomUrl: metafield(namespace: "custom", key: "sbom_url") {
      ...ComplianceMetafield
    }
    githubRepo: metafield(namespace: "custom", key: "github_repo") {
      ...ComplianceMetafield
    }
    modelNumber: metafield(namespace: "custom", key: "model_number") {
      ...ComplianceMetafield
    }
    batchId: metafield(namespace: "custom", key: "batch_id") {
      ...ComplianceMetafield
    }
  }
  fragment ComplianceMetafield on Metafield {
    key
    namespace
    type
    value
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
