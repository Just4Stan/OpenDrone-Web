import {useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import {isComingSoon} from '~/lib/product-content';

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
