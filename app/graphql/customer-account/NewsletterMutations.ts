// Email-marketing consent toggles for the signed-in customer, used by the
// account dashboard's newsletter card. Both mutations act on the authenticated
// customer (no input) and return the updated marketing state.
// https://shopify.dev/docs/api/customer/latest/mutations/customerEmailMarketingSubscribe
export const CUSTOMER_EMAIL_MARKETING_SUBSCRIBE_MUTATION = `#graphql
  mutation CustomerEmailMarketingSubscribe {
    customerEmailMarketingSubscribe {
      emailAddress {
        emailAddress
        marketingState
      }
      userErrors {
        field
        message
        code
      }
    }
  }
` as const;

// https://shopify.dev/docs/api/customer/latest/mutations/customerEmailMarketingUnsubscribe
export const CUSTOMER_EMAIL_MARKETING_UNSUBSCRIBE_MUTATION = `#graphql
  mutation CustomerEmailMarketingUnsubscribe {
    customerEmailMarketingUnsubscribe {
      emailAddress {
        emailAddress
        marketingState
      }
      userErrors {
        field
        message
        code
      }
    }
  }
` as const;
