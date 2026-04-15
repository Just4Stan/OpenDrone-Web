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
  const base = origin || 'https://opendrone.eu';
  if (!path.startsWith('/')) path = `/${path}`;
  return `${base.replace(/\/$/, '')}${path}`;
}

export function buildSeoMeta({
  title,
  description,
  image,
  type = 'website',
  robots,
  locale = DEFAULT_LOCALE,
  alternateLocales,
  canonical,
}: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  type?: 'website' | 'article' | 'product';
  robots?: string;
  locale?: string;
  alternateLocales?: string[];
  canonical?: string;
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

  if (canonical) {
    meta.push({tagName: 'link', rel: 'canonical', href: canonical});
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
  const url = (siteUrl || 'https://opendrone.eu').replace(/\/$/, '');
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
