import type {CompanyIdentity} from '~/lib/company';

const STORE_NAME = 'OpenDrone';
const DEFAULT_LOCALE = 'en_US';

export const DEFAULT_SEO_DESCRIPTION =
  'Open source drone electronics designed in Belgium.';

function stripHtml(value?: string | null) {
  if (!value) return '';

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, maxLength = 160) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export function buildPageTitle(title?: string | null) {
  return title ? `${title} | ${STORE_NAME}` : STORE_NAME;
}

export function buildMetaDescription(
  primary?: string | null,
  fallback = DEFAULT_SEO_DESCRIPTION,
) {
  const description = stripHtml(primary) || fallback;
  return truncate(description);
}

export function buildCanonicalUrl(path: string, origin?: string) {
  const base = origin || 'https://opendrone.be';
  if (!path.startsWith('/')) path = `/${path}`;
  return `${base.replace(/\/$/, '')}${path}`;
}

export type HreflangAlternate = {
  lang: string; // e.g. 'en', 'nl', 'x-default'
  href: string; // absolute or origin-relative URL
};

export function buildSeoMeta({
  title,
  description,
  image,
  type = 'website',
  robots,
  locale = DEFAULT_LOCALE,
  alternateLocales,
  canonical,
  url,
  hreflang,
}: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  type?: 'website' | 'article' | 'product';
  robots?: string;
  locale?: string;
  alternateLocales?: string[];
  canonical?: string;
  /**
   * Full request URL (e.g. `request.url`). When provided, the helper
   * auto-emits `<link rel="canonical">` unless `canonical` is passed
   * explicitly.
   */
  url?: string;
  /**
   * Explicit hreflang alternates for i18n-aware pages. Callers should
   * include an `x-default` entry pointing at the canonical locale.
   */
  hreflang?: HreflangAlternate[];
}) {
  const resolvedTitle = buildPageTitle(title);
  const resolvedDescription = buildMetaDescription(description);

  const meta: Array<Record<string, string>> = [
    {title: resolvedTitle},
    {name: 'description', content: resolvedDescription},
    {property: 'og:site_name', content: STORE_NAME},
    {property: 'og:title', content: resolvedTitle},
    {property: 'og:description', content: resolvedDescription},
    {property: 'og:type', content: type},
    {property: 'og:locale', content: locale},
    {name: 'twitter:card', content: 'summary_large_image'},
    {property: 'og:image', content: image || '/og-image.svg'},
  ];

  for (const alt of alternateLocales || []) {
    meta.push({property: 'og:locale:alternate', content: alt});
  }

  // Canonical — either passed in or derived from the request URL. Strips
  // query + hash so `?foo=bar` variants don't splinter into many canonicals.
  let resolvedCanonical = canonical;
  if (!resolvedCanonical && url) {
    try {
      const parsed = new URL(url);
      resolvedCanonical = `${parsed.origin}${parsed.pathname}`;
    } catch {
      /* ignore malformed URL */
    }
  }
  if (resolvedCanonical) {
    meta.push({tagName: 'link', rel: 'canonical', href: resolvedCanonical});
    meta.push({property: 'og:url', content: resolvedCanonical});
  }

  if (hreflang?.length) {
    for (const alt of hreflang) {
      meta.push({
        tagName: 'link',
        rel: 'alternate',
        hrefLang: alt.lang,
        href: alt.href,
      });
    }
  }

  if (robots) {
    meta.push({name: 'robots', content: robots});
  }

  return meta;
}

/**
 * schema.org Organization JSON-LD — emit in root Layout <head>. Identifies
 * the selling entity (Incutec BV) for search engines, not the OpenDrone
 * product brand.
 */
export function buildOrgJsonLd(company: CompanyIdentity, siteUrl?: string) {
  const url = (siteUrl || 'https://opendrone.be').replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url,
    email: company.email,
    telephone: company.tel,
    address: {
      '@type': 'PostalAddress',
      streetAddress: company.address,
      addressCountry: 'BE',
    },
    identifier: [
      {'@type': 'PropertyValue', propertyID: 'KBO', value: company.kbo},
      {'@type': 'PropertyValue', propertyID: 'VAT', value: company.vat},
    ],
    brand: {
      '@type': 'Brand',
      name: STORE_NAME,
    },
  };
}

/**
 * schema.org Product JSON-LD — emit on PDP. Drives Google rich-result
 * cards for product listings (price, availability, brand). Skipped when
 * the variant has no price (combined-listing parents) so we don't post
 * a malformed offer.
 */
type ProductJsonLdInput = {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  url: string;
  vendor?: string | null;
  sku?: string | null;
  gtin?: string | null;
  price?: {amount: string; currencyCode: string} | null;
  availableForSale: boolean;
  productHandle: string;
};

export function buildProductJsonLd(input: ProductJsonLdInput) {
  const product: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.title,
    url: input.url,
    productID: input.productHandle,
  };
  if (input.description) {
    product.description = stripHtml(input.description).slice(0, 5000);
  }
  if (input.imageUrl) product.image = input.imageUrl;
  if (input.vendor) {
    product.brand = {'@type': 'Brand', name: input.vendor};
  }
  if (input.sku) product.sku = input.sku;
  if (input.gtin) product.gtin = input.gtin;
  if (input.price) {
    product.offers = {
      '@type': 'Offer',
      url: input.url,
      price: input.price.amount,
      priceCurrency: input.price.currencyCode,
      availability: input.availableForSale
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      priceValidUntil: nextYearIso(),
    };
  }
  return product;
}

function nextYearIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
