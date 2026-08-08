import {redirect, useLoaderData, type HeadersFunction} from 'react-router';
import type {Route} from './+types/account.orders.$id';

// Order detail PII — block intermediate + bfcache.
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'private, no-store',
});
import {Money, Image} from '@shopify/hydrogen';
import type {
  OrderLineItemFullFragment,
  OrderQuery,
} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {buildSeoMeta} from '~/lib/seo';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

/** One copy string with `{placeholders}` filled in. */
function fill(id: string, fallback: string, vars: Record<string, string>) {
  let out = copyText(id) ?? fallback;
  for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, v);
  return out;
}

export const meta: Route.MetaFunction = ({data}) =>
  buildSeoMeta({
    title: data?.order?.name
      ? fill('account.order.title', 'Order {name}', {name: data.order.name})
      : (copyText('account.order.meta_title') ?? 'Order'),
    description:
      copyText('account.order.meta_description') ??
      'Review order details, line items, and fulfillment status.',
    robots: 'noindex,nofollow',
  });

export async function loader({params, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  await customerAccount.handleAuthStatus();
  if (!params.id) {
    return redirect('/account/orders');
  }

  let orderId: string;
  try {
    orderId = atob(params.id);
  } catch {
    throw new Response('Invalid order ID', {status: 400});
  }
  const {data, errors}: {data: OrderQuery; errors?: Array<{message: string}>} =
    await customerAccount.query(CUSTOMER_ORDER_QUERY, {
      variables: {
        orderId,
        language: customerAccount.i18n.language,
      },
    });

  if (errors?.length || !data?.order) {
    throw new Response('Order not found', {status: 404});
  }

  const {order} = data;

  // Extract line items directly from nodes array
  const lineItems = order.lineItems.nodes;

  // Extract discount applications directly from nodes array
  const discountApplications = order.discountApplications.nodes;

  // Get fulfillment status from first fulfillment node
  const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';

  // Get first discount value with proper type checking
  const firstDiscount = discountApplications[0]?.value;

  // Type guard for MoneyV2 discount
  const discountValue =
    firstDiscount?.__typename === 'MoneyV2'
      ? (firstDiscount as Extract<
          typeof firstDiscount,
          {__typename: 'MoneyV2'}
        >)
      : null;

  // Type guard for percentage discount
  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue'
      ? (
          firstDiscount as Extract<
            typeof firstDiscount,
            {__typename: 'PricingPercentageValue'}
          >
        ).percentage
      : null;

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  } = useLoaderData<typeof loader>();
  return (
    <div className="account-order">
      <header className="page-header">
        <Txt id="account.order.eyebrow" as="p" className="page-eyebrow" />
        <h2 className="page-title">
          {fill('account.order.title', 'Order {name}', {name: order.name})}
        </h2>
        <p className="page-description">
          {fill('account.order.placed_on', 'Placed on {date}', {
            date: new Date(order.processedAt!).toDateString(),
          })}
          {order.confirmationNumber
            ? ` ${fill(
                'account.order.placed_confirmation',
                '- Confirmation {number}',
                {number: order.confirmationNumber},
              )}`
            : ''}
        </p>
      </header>
      <div className="account-order-layout">
        <div className="account-order-table-wrap">
          <table>
            <thead>
              <tr>
                <Txt id="account.order.col_product" as="th" scope="col" />
                <Txt id="account.order.col_price" as="th" scope="col" />
                <Txt id="account.order.col_quantity" as="th" scope="col" />
                <Txt id="account.order.col_total" as="th" scope="col" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem, lineItemIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
              ))}
            </tbody>
            <tfoot>
              {((discountValue && discountValue.amount) ||
                discountPercentage) && (
                <tr>
                  <Txt
                    id="account.order.discounts"
                    as="th"
                    scope="row"
                    colSpan={3}
                  />
                  <td>
                    {discountPercentage ? (
                      <span>
                        {fill('account.order.discount_off', '-{percentage}% OFF', {
                          percentage: String(discountPercentage),
                        })}
                      </span>
                    ) : (
                      discountValue && <Money data={discountValue!} />
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <Txt
                  id="account.order.subtotal"
                  as="th"
                  scope="row"
                  colSpan={3}
                />
                <td>
                  <Money data={order.subtotal!} />
                </td>
              </tr>
              <tr>
                <Txt id="account.order.tax" as="th" scope="row" colSpan={3} />
                <td>
                  <Money data={order.totalTax!} />
                </td>
              </tr>
              <tr>
                <Txt id="account.order.total" as="th" scope="row" colSpan={3} />
                <td>
                  <Money data={order.totalPrice!} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <aside className="account-order-sidebar">
          <Txt id="account.order.shipping_address" as="h3" />
          {order?.shippingAddress ? (
            <address>
              <p>{order.shippingAddress.name}</p>
              {order.shippingAddress.formatted ? (
                <p>{order.shippingAddress.formatted}</p>
              ) : (
                ''
              )}
              {order.shippingAddress.formattedArea ? (
                <p>{order.shippingAddress.formattedArea}</p>
              ) : (
                ''
              )}
            </address>
          ) : (
            <Txt id="account.order.no_shipping_address" as="p" />
          )}
          <Txt id="account.order.status" as="h3" />
          <div>
            <p>{fulfillmentStatus}</p>
          </div>
          {/* Carrier + tracking number inline — Sendcloud writes these back
              onto the fulfillment; saves a hop to the Shopify status page. */}
          {order.fulfillments.nodes.some(
            (f) => f.trackingInformation?.length,
          ) ? (
            <>
              <Txt id="account.order.tracking" as="h3" />
              <div>
                {order.fulfillments.nodes.flatMap(
                  (f, i) =>
                    f.trackingInformation?.map((t, j) => (
                      <p key={`${i}-${j}`}>
                        {t.url ? (
                          <a target="_blank" href={t.url} rel="noreferrer">
                            {t.company ? `${t.company} · ` : ''}
                            {t.number ??
                              (copyText('account.order.track_parcel') ??
                                'Track parcel')}{' '}
                            ↗
                          </a>
                        ) : (
                          <>
                            {t.company ? `${t.company} · ` : ''}
                            {t.number}
                          </>
                        )}
                      </p>
                    )) ?? [],
                )}
              </div>
            </>
          ) : null}
        </aside>
      </div>
      <p className="account-order-status-link">
        <a target="_blank" href={order.statusPageUrl} rel="noreferrer">
          <Txt id="account.order.view_status" />
        </a>
      </p>
    </div>
  );
}

function OrderLineRow({lineItem}: {lineItem: OrderLineItemFullFragment}) {
  const quantity = lineItem.quantity ?? 0;
  const unitAmount = Number(lineItem.price?.amount ?? 0);
  const discountAmount = Number(lineItem.totalDiscount?.amount ?? 0);
  const lineTotal = {
    amount: Math.max(0, unitAmount * quantity - discountAmount).toFixed(2),
    currencyCode: lineItem.price?.currencyCode ?? 'USD',
  };

  return (
    <tr key={lineItem.id}>
      <td>
        <div>
          {lineItem?.image && (
            <div>
              <Image data={lineItem.image} width={96} height={96} alt={lineItem.title} />
            </div>
          )}
          <div>
            <p>{lineItem.title}</p>
            <small>{lineItem.variantTitle}</small>
          </div>
        </div>
      </td>
      <td>
        <Money data={lineItem.price!} />
      </td>
      <td>{lineItem.quantity}</td>
      <td>
        <Money data={lineTotal} />
      </td>
    </tr>
  );
}
