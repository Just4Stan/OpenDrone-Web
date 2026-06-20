// Marketing-consent state for the signed-in customer, used to make the footer
// newsletter form subscription-aware (don't re-ask a subscribed user for their
// email). marketingState is SUBSCRIBED / NOT_SUBSCRIBED / PENDING / …
// NOTE: https://shopify.dev/docs/api/customer/latest/objects/CustomerEmailAddress
export const CUSTOMER_NEWSLETTER_STATE_QUERY = `#graphql
  query CustomerNewsletterState {
    customer {
      emailAddress {
        emailAddress
        marketingState
      }
    }
  }
` as const;
