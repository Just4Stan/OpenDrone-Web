import type {CustomerAddressInput} from '@shopify/hydrogen/customer-account-api-types';
import type {
  AddressFragment,
  CustomerFragment,
} from 'customer-accountapi.generated';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
  type Fetcher,
  type HeadersFunction,
} from 'react-router';
import type {Route} from './+types/account.addresses';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';

// Customer addresses — block intermediate + bfcache.
export const headers: HeadersFunction = () => ({
  'Cache-Control': 'private, no-store',
});
import {buildSeoMeta} from '~/lib/seo';
import {Txt} from '~/components/Txt';
import {copyText} from '~/lib/copy';

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: copyText('account.addresses.meta_title') ?? 'Addresses',
    description:
      copyText('account.addresses.meta_description') ??
      'Manage saved shipping addresses for your OpenDrone account.',
    robots: 'noindex,nofollow',
  });

export async function loader({context}: Route.LoaderArgs) {
  await context.customerAccount.handleAuthStatus();

  return {};
}

export async function action({request, context}: Route.ActionArgs) {
  const {customerAccount} = context;

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    // this will ensure redirecting to login never happen for mutatation
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) {
      return data(
        {
          error: {
            [addressId]:
              copyText('account.addresses.error_unauthorized') ?? 'Unauthorized',
          },
        },
        {
          status: 401,
        },
      );
    }

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : false;
    const address: CustomerAddressInput = {};
    const keys: (keyof CustomerAddressInput)[] = [
      'address1',
      'address2',
      'city',
      'company',
      'territoryCode',
      'firstName',
      'lastName',
      'phoneNumber',
      'zoneCode',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {data, errors} = await customerAccount.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressCreate?.userErrors?.length) {
            throw new Error(data?.customerAddressCreate?.userErrors[0].message);
          }

          if (!data?.customerAddressCreate?.customerAddress) {
            throw new Error(
              copyText('account.addresses.error_create') ??
                'Customer address create failed.',
            );
          }

          return {
            error: null,
            createdAddress: data?.customerAddressCreate?.customerAddress,
            defaultAddress,
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {data, errors} = await customerAccount.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                addressId: decodeURIComponent(addressId),
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressUpdate?.userErrors?.length) {
            throw new Error(data?.customerAddressUpdate?.userErrors[0].message);
          }

          if (!data?.customerAddressUpdate?.customerAddress) {
            throw new Error(
              copyText('account.addresses.error_update') ??
                'Customer address update failed.',
            );
          }

          return {
            error: null,
            updatedAddress: address,
            defaultAddress,
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {data, errors} = await customerAccount.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {
                addressId: decodeURIComponent(addressId),
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressDelete?.userErrors?.length) {
            throw new Error(data?.customerAddressDelete?.userErrors[0].message);
          }

          if (!data?.customerAddressDelete?.deletedAddressId) {
            throw new Error(
              copyText('account.addresses.error_delete') ??
                'Customer address delete failed.',
            );
          }

          return {error: null, deletedAddress: addressId};
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      default: {
        return data(
          {
            error: {
              [addressId]:
                copyText('account.addresses.error_method') ??
                  'Method not allowed',
            },
          },
          {
            status: 405,
          },
        );
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return data(
        {error: error.message},
        {
          status: 400,
        },
      );
    }
    return data(
      {error},
      {
        status: 400,
      },
    );
  }
}

export default function Addresses() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {defaultAddress, addresses} = customer;

  return (
    <div className="account-addresses">
      <header className="account-section-header">
        <Txt id="account.addresses.title" as="h2" />
        <Txt id="account.addresses.lede" as="p" />
      </header>
      <div className="address-sections">
        <section className="account-form-section">
          <Txt
            id="account.addresses.create_heading"
            as="h3"
            className="section-heading"
          />
          <NewAddressForm key={addresses.nodes.length} />
        </section>
        {!addresses.nodes.length ? (
          <Txt id="account.addresses.empty" as="p" />
        ) : (
          <ExistingAddresses
            addresses={addresses}
            defaultAddress={defaultAddress}
          />
        )}
      </div>
    </div>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  } as CustomerAddressInput;

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
    >
      {({stateForMethod}) => (
        <div>
          <button
            className="account-button"
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
          >
            <Txt
              id={
                stateForMethod('POST') !== 'idle'
                  ? 'account.addresses.create_busy'
                  : 'account.addresses.create'
              }
            />
          </button>
        </div>
      )}
    </AddressForm>
  );
}

function ExistingAddresses({
  addresses,
  defaultAddress,
}: Pick<CustomerFragment, 'addresses' | 'defaultAddress'>) {
  return (
    <section className="account-form-section">
      <Txt
        id="account.addresses.existing_heading"
        as="h3"
        className="section-heading"
      />
      <div className="address-list">
        {addresses.nodes.map((address) => (
          <AddressForm
            key={address.id}
            addressId={address.id}
            address={address}
            defaultAddress={defaultAddress}
          >
            {({stateForMethod}) => (
              <div className="account-form-actions">
                <button
                  className="account-button"
                  disabled={stateForMethod('PUT') !== 'idle'}
                  formMethod="PUT"
                  type="submit"
                >
                  <Txt
                    id={
                      stateForMethod('PUT') !== 'idle'
                        ? 'account.addresses.save_busy'
                        : 'account.addresses.save'
                    }
                  />
                </button>
                <button
                  className="account-button account-button-secondary"
                  disabled={stateForMethod('DELETE') !== 'idle'}
                  formMethod="DELETE"
                  type="submit"
                >
                  <Txt
                    id={
                      stateForMethod('DELETE') !== 'idle'
                        ? 'account.addresses.delete_busy'
                        : 'account.addresses.delete'
                    }
                  />
                </button>
              </div>
            )}
          </AddressForm>
        ))}
      </div>
    </section>
  );
}

export function AddressForm({
  addressId,
  address,
  defaultAddress,
  children,
}: {
  addressId: AddressFragment['id'];
  address: CustomerAddressInput;
  defaultAddress: CustomerFragment['defaultAddress'];
  children: (props: {
    stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
  }) => React.ReactNode;
}) {
  const {state, formMethod} = useNavigation();
  const action = useActionData<ActionResponse>();
  const error = action?.error?.[addressId];
  const isDefaultAddress = defaultAddress?.id === addressId;
  const idPrefix = String(addressId).replace(/[^a-zA-Z0-9_-]/g, '-');
  return (
    <Form className="account-form address-form" id={addressId}>
      <fieldset className="account-form-grid">
        <input type="hidden" name="addressId" defaultValue={addressId} />
        <Txt
          id="account.addresses.first_name_label"
          as="label"
          htmlFor={`${idPrefix}-firstName`}
        />
        <input
          aria-label={copyText('account.addresses.first_name_aria')}
          autoComplete="given-name"
          defaultValue={address?.firstName ?? ''}
          id={`${idPrefix}-firstName`}
          name="firstName"
          placeholder={copyText('account.addresses.first_name_placeholder')}
          required
          type="text"
        />
        <Txt
          id="account.addresses.last_name_label"
          as="label"
          htmlFor={`${idPrefix}-lastName`}
        />
        <input
          aria-label={copyText('account.addresses.last_name_aria')}
          autoComplete="family-name"
          defaultValue={address?.lastName ?? ''}
          id={`${idPrefix}-lastName`}
          name="lastName"
          placeholder={copyText('account.addresses.last_name_placeholder')}
          required
          type="text"
        />
        <Txt
          id="account.addresses.company_label"
          as="label"
          htmlFor={`${idPrefix}-company`}
        />
        <input
          aria-label={copyText('account.addresses.company_aria')}
          autoComplete="organization"
          defaultValue={address?.company ?? ''}
          id={`${idPrefix}-company`}
          name="company"
          placeholder={copyText('account.addresses.company_placeholder')}
          type="text"
        />
        <Txt
          id="account.addresses.address1_label"
          as="label"
          htmlFor={`${idPrefix}-address1`}
        />
        <input
          aria-label={copyText('account.addresses.address1_aria')}
          autoComplete="address-line1"
          defaultValue={address?.address1 ?? ''}
          id={`${idPrefix}-address1`}
          name="address1"
          placeholder={copyText('account.addresses.address1_placeholder')}
          required
          type="text"
        />
        <Txt
          id="account.addresses.address2_label"
          as="label"
          htmlFor={`${idPrefix}-address2`}
        />
        <input
          aria-label={copyText('account.addresses.address2_aria')}
          autoComplete="address-line2"
          defaultValue={address?.address2 ?? ''}
          id={`${idPrefix}-address2`}
          name="address2"
          placeholder={copyText('account.addresses.address2_placeholder')}
          type="text"
        />
        <Txt
          id="account.addresses.city_label"
          as="label"
          htmlFor={`${idPrefix}-city`}
        />
        <input
          aria-label={copyText('account.addresses.city_aria')}
          autoComplete="address-level2"
          defaultValue={address?.city ?? ''}
          id={`${idPrefix}-city`}
          name="city"
          placeholder={copyText('account.addresses.city_placeholder')}
          required
          type="text"
        />
        <Txt
          id="account.addresses.zone_label"
          as="label"
          htmlFor={`${idPrefix}-zoneCode`}
        />
        <input
          aria-label={copyText('account.addresses.zone_aria')}
          autoComplete="address-level1"
          defaultValue={address?.zoneCode ?? ''}
          id={`${idPrefix}-zoneCode`}
          name="zoneCode"
          placeholder={copyText('account.addresses.zone_placeholder')}
          required
          type="text"
        />
        <Txt
          id="account.addresses.zip_label"
          as="label"
          htmlFor={`${idPrefix}-zip`}
        />
        <input
          aria-label={copyText('account.addresses.zip_aria')}
          autoComplete="postal-code"
          defaultValue={address?.zip ?? ''}
          id={`${idPrefix}-zip`}
          name="zip"
          placeholder={copyText('account.addresses.zip_placeholder')}
          required
          type="text"
        />
        <Txt
          id="account.addresses.country_label"
          as="label"
          htmlFor={`${idPrefix}-territoryCode`}
        />
        <input
          aria-label={copyText('account.addresses.country_aria')}
          autoComplete="country"
          defaultValue={address?.territoryCode ?? ''}
          id={`${idPrefix}-territoryCode`}
          name="territoryCode"
          placeholder={copyText('account.addresses.country_placeholder')}
          required
          type="text"
          maxLength={2}
        />
        <Txt
          id="account.addresses.phone_label"
          as="label"
          htmlFor={`${idPrefix}-phoneNumber`}
        />
        <input
          aria-label={copyText('account.addresses.phone_aria')}
          autoComplete="tel"
          defaultValue={address?.phoneNumber ?? ''}
          id={`${idPrefix}-phoneNumber`}
          name="phoneNumber"
          placeholder={copyText('account.addresses.phone_placeholder')}
          type="tel"
          pattern="^\+?[1-9]\d{3,14}$"
        />
        <div className="account-checkbox-row">
          <input
            defaultChecked={isDefaultAddress}
            id={`${idPrefix}-defaultAddress`}
            name="defaultAddress"
            type="checkbox"
          />
          <Txt
            id="account.addresses.default_label"
            as="label"
            htmlFor={`${idPrefix}-defaultAddress`}
          />
        </div>
        {error ? (
          <p>
            <mark>
              <small>{error}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        {children({
          stateForMethod: (method) => (formMethod === method ? state : 'idle'),
        })}
      </fieldset>
    </Form>
  );
}
