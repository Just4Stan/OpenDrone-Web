import {redirect} from 'react-router';
import type {Route} from './+types/cart.$lines';
import {
  anyComingSoonLocks,
  comingSoonFlag,
  findLockedMerchandise,
} from '~/lib/coming-soon';

/**
 * Automatically creates a new cart based on the URL and redirects straight to checkout.
 * Expected URL structure:
 * ```js
 * /cart/<variant_id>:<quantity>
 *
 * ```
 *
 * More than one `<variant_id>:<quantity>` separated by a comma, can be supplied in the URL, for
 * carts with more than one product variant.
 *
 * @example
 * Example path creating a cart with two product variants, different quantities, and a discount code in the querystring:
 * ```js
 * /cart/41007289663544:1,41007289696312:2?discount=HYDROBOARD
 *
 * ```
 */
export async function loader({request, context, params}: Route.LoaderArgs) {
  const {cart} = context;
  const {lines} = params;
  if (!lines) return redirect('/cart');
  let linesMap = lines.split(',').map((line) => {
    const lineDetails = line.split(':');
    const variantId = lineDetails[0];
    const quantity = parseInt(lineDetails[1], 10);

    if (!quantity || quantity <= 0 || isNaN(quantity)) {
      throw new Response('Invalid quantity in cart link', {status: 400});
    }

    return {
      merchandiseId: `gid://shopify/ProductVariant/${variantId}`,
      quantity,
    };
  });

  // Server-side coming-soon gate: cart permalinks are the documented
  // agent/deep-link order path, so locked SKUs must be dropped here too.
  // Zero-cost when the shop is unlocked and nothing is override-locked.
  const soonFlag = comingSoonFlag(context.env);
  if (anyComingSoonLocks(soonFlag)) {
    const {lockedIds, lockedHandles} = await findLockedMerchandise(
      context.storefront,
      soonFlag,
      linesMap.map((l) => l.merchandiseId),
    );
    if (lockedIds.size > 0) {
      const open = linesMap.filter((l) => !lockedIds.has(l.merchandiseId));
      if (open.length === 0) {
        // Every requested line is locked — send the visitor to the PDP,
        // where the notify-at-launch signup lives (or the catalog when the
        // lookup couldn't resolve a handle).
        return redirect(
          lockedHandles[0]
            ? `/products/${lockedHandles[0]}`
            : '/collections/all',
        );
      }
      linesMap = open;
    }
  }

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const discount = searchParams.get('discount');
  const discountArray = discount ? [discount] : [];

  // create a cart
  const result = await cart.create({
    lines: linesMap,
    discountCodes: discountArray,
  });

  const cartResult = result.cart;

  if (result.errors?.length || !cartResult) {
    throw new Response('Link may be expired. Try checking the URL.', {
      status: 410,
    });
  }

  // Update cart id in cookie
  const headers = cart.setCartId(cartResult.id);

  // redirect to checkout
  if (cartResult.checkoutUrl) {
    return redirect(cartResult.checkoutUrl, {headers});
  } else {
    throw new Error('No checkout URL found');
  }
}

export default function Component() {
  return null;
}
