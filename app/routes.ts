import {flatRoutes} from '@react-router/fs-routes';
import {type RouteConfig, route} from '@react-router/dev/routes';
import {hydrogenRoutes} from '@shopify/hydrogen';
import {LEGAL_SLUGS} from './lib/legal-slugs';

/**
 * Legal pages are served under `/en/…` and `/nl/…`, in addition to the
 * legacy unprefixed URLs (which redirect to the user's cached locale).
 *
 * The same route component file powers all three paths. Its loader
 * reads the URL via `resolveLegalLoader` to decide which language to
 * render, or to redirect unprefixed URLs to the canonical
 * locale-prefixed URL.
 */
const localeRoutes = LEGAL_SLUGS.flatMap((slug) => [
  route(`/en/${slug}`, `routes/${slug}.tsx`, {id: `${slug}-en`}),
  route(`/nl/${slug}`, `routes/${slug}.tsx`, {id: `${slug}-nl`}),
  route(`/fr/${slug}`, `routes/${slug}.tsx`, {id: `${slug}-fr`}),
]);

/**
 * The studio is a local authoring tool, not part of the storefront. It must
 * never reach production, so it is excluded here rather than merely hidden.
 *
 * `flatRoutes()` scans `app/routes/` unconditionally, so a file dropped there
 * ships in every build. `ignoredRouteFiles` is therefore the gate: in a
 * production build the studio route files are not compiled, not bundled and not
 * routable. `process.env.NODE_ENV` is the right test because this config runs in
 * Node at build time, where it is a real value rather than a Vite substitution.
 *
 * Keep this in step with the dev-only Vite plugin (`studio/vite-plugin-studio.ts`)
 * that serves the studio's write endpoint. Both halves have to be absent from
 * production for the guarantee to hold: this one removes the UI, that one
 * removes the ability to write files.
 */
const STUDIO_ROUTE_GLOBS = ['**/studio.tsx', '**/studio.*.tsx'];
const isProd = process.env.NODE_ENV === 'production';

export default hydrogenRoutes([
  ...(await flatRoutes(
    isProd ? {ignoredRouteFiles: STUDIO_ROUTE_GLOBS} : undefined,
  )),
  ...localeRoutes,
]) satisfies RouteConfig;
