import type {Route} from './+types/[sitemap-static.xml]';

/**
 * Child sitemap for the routes that exist only in this codebase. Hydrogen's
 * sitemap index covers Shopify-hosted resources (products, collections,
 * blogs, pages); everything below would be invisible to crawlers without
 * this file. Referenced from the index via `customChildSitemaps` in
 * [sitemap.xml].tsx.
 *
 * Redirect-only routes (/contribute, /incutec, /contact, /releases, /blog,
 * /terms and the un-prefixed legal slugs) and robots-disallowed ones
 * (/cart, /account, /api, /support, /search, /policies) stay out. Legal
 * pages are served per locale, so each locale variant is listed; the pages
 * themselves carry the hreflang alternates.
 */
const STATIC_PATHS = [
  '/',
  '/open-source',
  '/production',
  '/roadmap',
  '/contributing',
  '/timeline',
  '/firmware-partners',
  '/collections/all',
  '/newsletter',
];

const LEGAL_SLUGS = [
  'legal',
  'privacy',
  'algemene-voorwaarden',
  'herroepingsrecht',
  'shipping',
  'warranty',
  'security',
  'cookies',
  'end-use',
];

const LOCALES = ['en', 'nl', 'fr'];

const ALL_PATHS = [
  ...STATIC_PATHS,
  ...LOCALES.flatMap((l) => LEGAL_SLUGS.map((s) => `/${l}/${s}`)),
];

export function loader({request}: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ALL_PATHS.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}
