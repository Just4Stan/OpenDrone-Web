import type {Route} from './+types/api.status.$repo[.json]';
import {
  ROADMAP,
  fetchStatusFlags,
  type ProductStatus,
} from '~/lib/roadmap-data';

/**
 * Shields.io endpoint badge for a board repo's product status.
 *
 * `https://img.shields.io/endpoint?url=https://opendrone.be/api/status/<Repo>.json`
 * renders the same status the roadmap and the shop resolve, from the same
 * `status-*` topic fetch, so a README badge can never disagree with the
 * site. Repos are limited to the ones ROADMAP links; anything else is 404.
 * A repo whose topic cannot be fetched gets its static fallback, exactly
 * like every other surface (docs/product-status.md).
 *
 * Cache: 600 s, the same ceiling as the feeds, so a topic flip reaches the
 * badge in the same window it reaches the shop. `cacheSeconds` tells
 * shields not to hold it longer either.
 */

const COLOR: Record<ProductStatus, string> = {
  launched: 'ffb700',
  beta: 'ffb700',
  alpha: 'e08c00',
  'in-progress': '6b6459',
  planned: '6b6459',
};

const LABEL: Record<ProductStatus, string> = {
  launched: 'launched',
  beta: 'beta',
  alpha: 'alpha',
  'in-progress': 'in progress',
  planned: 'planned',
};

export async function loader({params, context}: Route.LoaderArgs) {
  const repo = params.repo ?? '';
  const link = `https://github.com/OpenDrone-hw/${repo}`;
  const item = ROADMAP.find((r) => r.link === link);
  if (!/^[A-Za-z0-9._-]+$/.test(repo) || !item) {
    return new Response('not found', {status: 404});
  }
  const env = context.env as unknown as Record<string, string | undefined>;
  const flags = await fetchStatusFlags(env.GITHUB_STATUS_TOKEN).catch(
    () => ({}) as Record<string, ProductStatus>,
  );
  const status: ProductStatus = flags[link] ?? item.status;
  const body = {
    schemaVersion: 1,
    label: 'status',
    message: LABEL[status],
    color: COLOR[status],
    cacheSeconds: 600,
  };
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
