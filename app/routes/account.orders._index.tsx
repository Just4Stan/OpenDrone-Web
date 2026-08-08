import {
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from 'react-router';
import type {Route} from './+types/account.orders._index';
import type {HeadersFunction} from 'react-router';
import {useRef} from 'react';

// Order-history PII — block intermediate + bfcache.
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'private, no-store',
});
import {
  Money,
  getPaginationVariables,
  flattenConnection,
} from '@shopify/hydrogen';
import {
  buildOrderSearchQuery,
  parseOrderFilters,
  ORDER_FILTER_FIELDS,
  type OrderFilterParams,
} from '~/lib/orderFilters';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {buildSeoMeta} from '~/lib/seo';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

type OrdersLoaderData = {
  customer: CustomerOrdersFragment;
  filters: OrderFilterParams;
};

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('account.orders.meta_title') ?? 'Orders',
    description:
      copyText('account.orders.meta_description') ??
      'View and filter your OpenDrone order history.',
    robots: 'noindex,nofollow',
  });

export async function loader({request, context}: Route.LoaderArgs) {
  const {customerAccount} = context;
  await customerAccount.handleAuthStatus();
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const url = new URL(request.url);
  const filters = parseOrderFilters(url.searchParams);
  const query = buildOrderSearchQuery(filters);

  const {data, errors} = await customerAccount.query(CUSTOMER_ORDERS_QUERY, {
    variables: {
      ...paginationVariables,
      query,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Response('Customer orders not found', {status: 404});
  }

  return {customer: data.customer, filters};
}

export default function Orders() {
  const {customer, filters} = useLoaderData<OrdersLoaderData>();
  const {orders} = customer;

  return (
    <div className="orders">
      <OrderSearchForm currentFilters={filters} />
      <OrdersTable orders={orders} filters={filters} />
    </div>
  );
}

function OrdersTable({
  orders,
  filters,
}: {
  orders: CustomerOrdersFragment['orders'];
  filters: OrderFilterParams;
}) {
  const hasFilters = !!(filters.name || filters.confirmationNumber);

  return (
    <div className="account-orders" aria-live="polite">
      {orders?.nodes.length ? (
        <PaginatedResourceSection connection={orders}>
          {({node: order}) => <OrderItem key={order.id} order={order} />}
        </PaginatedResourceSection>
      ) : (
        <EmptyOrders hasFilters={hasFilters} />
      )}
    </div>
  );
}

function EmptyOrders({hasFilters = false}: {hasFilters?: boolean}) {
  return (
    <div>
      {hasFilters ? (
        <>
          <Txt id="account.orders.empty_filtered" as="p" />
          <br />
          <p>
            <Link prefetch="viewport" to="/account/orders">
              <Txt id="account.orders.empty_filtered_cta" />
            </Link>
          </p>
        </>
      ) : (
        <>
          <Txt id="account.orders.empty" as="p" />
          <br />
          <p>
            <Link prefetch="viewport" to="/collections/all">
              <Txt id="account.orders.empty_cta" />
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function OrderSearchForm({
  currentFilters,
}: {
  currentFilters: OrderFilterParams;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSearching =
    navigation.state !== 'idle' &&
    navigation.location?.pathname?.includes('orders');
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    const name = formData.get(ORDER_FILTER_FIELDS.NAME)?.toString().trim();
    const confirmationNumber = formData
      .get(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER)
      ?.toString()
      .trim();

    if (name) params.set(ORDER_FILTER_FIELDS.NAME, name);
    if (confirmationNumber)
      params.set(ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER, confirmationNumber);

    setSearchParams(params);
  };

  const hasFilters = currentFilters.name || currentFilters.confirmationNumber;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="order-search-form"
      aria-label={copyText('account.orders.search_aria') ?? 'Search orders'}
    >
      <fieldset className="order-search-fieldset">
        <Txt
          id="account.orders.filter_legend"
          as="legend"
          className="order-search-legend"
        />

        <div className="order-search-inputs">
          <input
            type="search"
            name={ORDER_FILTER_FIELDS.NAME}
            placeholder={copyText('account.orders.filter_number_placeholder')}
            aria-label={
              copyText('account.orders.filter_number_aria') ?? 'Order number'
            }
            defaultValue={currentFilters.name || ''}
            className="order-search-input"
          />
          <input
            type="search"
            name={ORDER_FILTER_FIELDS.CONFIRMATION_NUMBER}
            placeholder={copyText(
              'account.orders.filter_confirmation_placeholder',
            )}
            aria-label={
              copyText('account.orders.filter_confirmation_aria') ??
              'Confirmation number'
            }
            defaultValue={currentFilters.confirmationNumber || ''}
            className="order-search-input"
          />
        </div>

        <div className="order-search-buttons">
          <button type="submit" disabled={isSearching}>
            <Txt
              id={
                isSearching
                  ? 'account.orders.search_busy'
                  : 'account.orders.search'
              }
            />
          </button>
          {hasFilters && (
            <button
              type="button"
              disabled={isSearching}
              onClick={() => {
                setSearchParams(new URLSearchParams());
                formRef.current?.reset();
              }}
            >
              <Txt id="account.orders.clear" />
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  return (
    <article className="order-card">
      <div>
        <Link prefetch="viewport" to={`/account/orders/${btoa(order.id)}`}>
          <strong>#{order.number}</strong>
        </Link>
        <p>{new Date(order.processedAt).toDateString()}</p>
        {order.confirmationNumber && (
          <p>
            {(
              copyText('account.orders.confirmation') ?? 'Confirmation: {number}'
            ).replace('{number}', order.confirmationNumber)}
          </p>
        )}
        <p>{order.financialStatus}</p>
        {fulfillmentStatus && <p>{fulfillmentStatus}</p>}
        <Money data={order.totalPrice} />
        <Link prefetch="viewport" to={`/account/orders/${btoa(order.id)}`}>
          <Txt id="account.orders.view_order" />
        </Link>
      </div>
    </article>
  );
}
