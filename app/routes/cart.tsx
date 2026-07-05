import {useLoaderData, data, type HeadersFunction} from 'react-router';
import type {Route} from './+types/cart';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {buildSeoMeta} from '~/lib/seo';
import {DONATION_PRODUCT_QUERY} from '~/lib/fragments';
import {
  anyComingSoonLocks,
  comingSoonFlag,
  findLockedMerchandise,
} from '~/lib/coming-soon';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Cart',
    description: 'Review the items currently in your OpenDrone cart.',
    robots: 'noindex,nofollow',
  });

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function action({request, context}: Route.ActionArgs) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result: CartQueryDataReturn;
  // Set when the coming-soon gate drops some (but not all) requested lines,
  // so the cart drawer can tell the visitor what didn't make it in.
  let comingSoonNotice: string | null = null;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd: {
      // Server-side coming-soon gate: the client hides add-to-cart for
      // locked products, but a direct POST could still push one into the
      // cart. Zero-cost when the shop is unlocked and nothing is
      // override-locked — no extra query.
      let lines = inputs.lines ?? [];
      const soonFlag = comingSoonFlag(context.env);
      if (lines.length > 0 && anyComingSoonLocks(soonFlag)) {
        const {lockedIds} = await findLockedMerchandise(
          context.storefront,
          soonFlag,
          lines
            .map((l) => l.merchandiseId)
            .filter((id): id is string => Boolean(id)),
        );
        if (lockedIds.size > 0) {
          const open = lines.filter(
            (l) => !l.merchandiseId || !lockedIds.has(l.merchandiseId),
          );
          if (open.length === 0) {
            return data(
              {
                cart: null,
                errors: [
                  {
                    message:
                      'This product is coming soon and not orderable yet. Join the launch list on the product page instead.',
                  },
                ],
                warnings: [],
                analytics: {cartId: null},
              },
              {status: 409},
            );
          }
          comingSoonNotice =
            'Some items are coming soon and were not added to the cart.';
          lines = open;
        }
      }
      result = await cart.addLines(lines);
      break;
    }
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = (
        formDiscountCode ? [formDiscountCode] : []
      ) as string[];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesAdd: {
      const formGiftCardCode = inputs.giftCardCode;

      const giftCardCodes = (
        formGiftCardCode ? [formGiftCardCode] : []
      ) as string[];

      result = await cart.addGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesRemove: {
      const appliedGiftCardIds = inputs.giftCardCodes as string[];
      result = await cart.removeGiftCardCodes(appliedGiftCardIds);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      // Allowlist the fields a client may set and force the cart's
      // market to Belgium regardless of what the client sends. Without
      // this a malicious POST could switch countryCode to a sanctioned
      // region between server render and checkout, or inject an
      // arbitrary email/phone into analytics and abandoned-cart flows.
      const buyer = inputs.buyerIdentity ?? {};
      result = await cart.updateBuyerIdentity({
        countryCode: 'BE',
        email: buyer.email,
        phone: buyer.phone,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    // Only allow relative paths to prevent open redirect
    if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      status = 303;
      headers.set('Location', redirectTo);
    }
  }

  return data(
    {
      cart: cartResult,
      errors,
      warnings: comingSoonNotice
        ? [...(warnings ?? []), {message: comingSoonNotice}]
        : warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

export async function loader({context}: Route.LoaderArgs) {
  const {cart, storefront} = context;

  // Fetch both in parallel. Donation product is optional — if the store
  // doesn't have a `firmware-donation` product yet the upsell just hides.
  const [cartData, donationData] = await Promise.all([
    cart.get(),
    storefront
      .query(DONATION_PRODUCT_QUERY, {
        variables: {handle: 'firmware-donation'},
        cache: storefront.CacheShort(),
      })
      .catch(() => null),
  ]);

  return {cart: cartData, donationProduct: donationData?.product ?? null};
}

export default function Cart() {
  const {cart, donationProduct} = useLoaderData<typeof loader>();

  return (
    <div className="cart page-shell">
      <header className="page-header">
        <p className="page-eyebrow">Checkout</p>
        <h1 className="page-title">Your cart</h1>
        <p className="page-description">
          Review your selected hardware before heading to Shopify checkout.
        </p>
      </header>
      <CartMain layout="page" cart={cart} donationProduct={donationProduct} />
    </div>
  );
}
