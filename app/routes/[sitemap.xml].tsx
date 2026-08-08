import type {Route} from './+types/[sitemap.xml]';
import {getSitemapIndex} from '@shopify/hydrogen';

export async function loader({
  request,
  context: {storefront},
}: Route.LoaderArgs) {
  const response = await getSitemapIndex({
    storefront,
    request,
    // Routes that exist only in this codebase; see [sitemap-static.xml].tsx.
    customChildSitemaps: ['/sitemap-static.xml'],
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}
