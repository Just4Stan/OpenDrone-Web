import {useLoaderData, data, type HeadersFunction} from 'react-router';
import type {Route} from './+types/cart';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {buildSeoMeta} from '~/lib/seo';

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

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
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
      warnings,
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

// Minimal query for the optional `firmware-donation` product. Uses the
// Storefront API's product-by-handle lookup so a missing product resolves
// to null instead of erroring. Variants become the tier buttons.
const DONATION_PRODUCT_QUERY = `#graphql
  query DonationProduct(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      handle
      description
      variants(first: 10) {
        nodes {
          id
          title
          availableForSale
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
` as const;
