import {flatRoutes} from '@react-router/fs-routes';
import {type RouteConfig, route} from '@react-router/dev/routes';
import {hydrogenRoutes} from '@shopify/hydrogen';

/**
 * Legal pages are served under `/en/…` and `/nl/…`, in addition to the
 * legacy unprefixed URLs (which redirect to the user's cached locale).
 *
 * The same route component file powers all three paths. Its loader
 * reads the URL via `resolveLegalLoader` to decide which language to
 * render, or to redirect unprefixed URLs to the canonical
 * locale-prefixed URL.
 */
const LOCALIZED_LEGAL_SLUGS = [
  'algemene-voorwaarden',
  'privacy',
  'cookies',
  'herroepingsrecht',
  'shipping',
  'warranty',
  'contact',
  'security',
  'export-compliance',
  'legal',
  'cookie-settings',
  'terms',
] as const;

const localeRoutes = LOCALIZED_LEGAL_SLUGS.flatMap((slug) => [
  route(`/en/${slug}`, `routes/${slug}.tsx`, {id: `${slug}-en`}),
  route(`/nl/${slug}`, `routes/${slug}.tsx`, {id: `${slug}-nl`}),
]);

export default hydrogenRoutes([
  ...(await flatRoutes()),
  ...localeRoutes,
]) satisfies RouteConfig;
