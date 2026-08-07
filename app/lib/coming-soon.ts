import {useRouteLoaderData} from 'react-router';
import type {Storefront} from '@shopify/hydrogen';
import type {RootLoader} from '~/root';
import {
  isComingSoon,
  resolveStatus,
  PRODUCT_CONTENT,
  type ProductStatus,
} from '~/lib/product-content';

/**
 * Coming-soon state for a product, resolved from the root loader's
 * PUBLIC_COMING_SOON flag + the per-product override in product-content.ts.
 * Works in any component under root — no prop drilling. Defaults to
 * coming-soon when root data is unavailable (error boundaries), matching
 * the flag's fail-closed default.
 */
export function useComingSoon(handle?: string | null): boolean {
  const data = useRouteLoaderData<RootLoader>('root');
  return isComingSoon(handle, data?.comingSoon ?? true);
}

/**
 * Lifecycle status for a product, same resolution + fail-closed default
 * as {@link useComingSoon} (missing root data = 'development', never a
 * buyable state by accident).
 */
export function useProductStatus(handle?: string | null): ProductStatus {
  const data = useRouteLoaderData<RootLoader>('root');
  return resolveStatus(handle, data?.comingSoon ?? true);
}

/**
 * Resolve the global coming-soon flag from env — the single rule (shared
 * with root.tsx): defaults ON, `PUBLIC_COMING_SOON=0` unlocks the shop.
 * Server-side twin of {@link useComingSoon} for loaders/actions that have
 * no root loader data (feeds, cart gate).
 */
export function comingSoonFlag(env: {PUBLIC_COMING_SOON?: string}): boolean {
  return env.PUBLIC_COMING_SOON !== '0';
}

/**
 * Whether ANY product can currently be locked: the global flag is on, or
 * it's off but a per-product `comingSoon: true` override keeps a SKU
 * teasing. Guards the zero-cost unlock path — when this is false the cart
 * gate and feeds skip their coming-soon work entirely, so the unlocked
 * shop pays nothing for the feature.
 */
export function anyComingSoonLocks(globalFlag: boolean): boolean {
  if (globalFlag) return true;
  return Object.values(PRODUCT_CONTENT).some(
    (c) => c.comingSoon === true || c.status === 'idea' || c.status === 'development',
  );
}

// Server-side purchase gate: resolve variant gids → product handles in one
// storefront round-trip so cart mutations can drop lines for coming-soon
// products. The client already hides add-to-cart; this closes the direct
// POST / cart-permalink path.
const COMING_SOON_VARIANT_PRODUCTS_QUERY = `#graphql
  query ComingSoonVariantProducts($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        product {
          handle
        }
      }
    }
  }
` as const;

/**
 * Given cart-line merchandise gids, return the set that belongs to
 * coming-soon products (plus their handles, for messaging/redirects).
 * Callers must check {@link anyComingSoonLocks} first — this always
 * queries. Fail-closed: if the lookup errors while the gate is active,
 * every requested id is treated as locked (matching the `?? true`
 * default everywhere else in the feature).
 */
export async function findLockedMerchandise(
  storefront: Storefront,
  globalFlag: boolean,
  merchandiseIds: string[],
): Promise<{lockedIds: Set<string>; lockedHandles: string[]}> {
  const ids = [...new Set(merchandiseIds)].filter(Boolean);
  if (ids.length === 0) return {lockedIds: new Set(), lockedHandles: []};
  try {
    const data = await storefront.query(COMING_SOON_VARIANT_PRODUCTS_QUERY, {
      variables: {ids},
      cache: storefront.CacheShort(),
    });
    const lockedIds = new Set<string>();
    const lockedHandles = new Set<string>();
    for (const node of data.nodes ?? []) {
      const handle = node?.product?.handle;
      if (node?.id && handle && isComingSoon(handle, globalFlag)) {
        lockedIds.add(node.id);
        lockedHandles.add(handle);
      }
    }
    return {lockedIds, lockedHandles: [...lockedHandles]};
  } catch (err) {
    console.error('[coming-soon] variant lookup failed — blocking lines', err);
    return {lockedIds: new Set(ids), lockedHandles: []};
  }
}
