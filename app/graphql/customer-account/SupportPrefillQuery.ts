// Read by /contact loader to pre-fill the support widget when the
// visitor is signed into their Shopify customer account, and by
// /api/support/start to verify the claimed customerId before forwarding
// it to the Discord ticket post.
//
// Lives in app/graphql/customer-account/ so codegen validates it
// against the Customer Account schema (not the Storefront schema).

export const SUPPORT_CUSTOMER_PREFILL_QUERY = `#graphql
  query SupportCustomerPrefill {
    customer {
      id
      firstName
      lastName
      emailAddress { emailAddress }
    }
  }
` as const;

export const SUPPORT_CUSTOMER_ID_QUERY = `#graphql
  query SupportCustomerId {
    customer {
      id
    }
  }
` as const;
