/**
 * Mint a reviewer/creator attribution discount code.
 *
 *   node scripts/shopify-infra/04-reviewer-code.mjs <CODE> [percent]
 *   node scripts/shopify-infra/04-reviewer-code.mjs REVIEWER-BARDWELL 10
 *
 * The code doubles as the attribution key: Shopify Discounts → the code's
 * usage report shows orders + revenue driven by that reviewer. Pair the code
 * with a UTM landing link (see the Notion "Content / Video Calendar").
 *
 * Defaults: 10% off, all products, one use per customer, starts now, no end.
 * Idempotent-ish: re-running with an existing code returns a userError (skip).
 */
import {admin} from './_client.mjs';

const code = process.argv[2];
const percent = Number(process.argv[3] || 10);
if (!code) {
  console.error('usage: node 04-reviewer-code.mjs <CODE> [percent]');
  process.exit(1);
}

const data = await admin(
  `#graphql
  mutation Create($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message code }
    }
  }`,
  {
    basicCodeDiscount: {
      title: `Reviewer — ${code}`,
      code,
      startsAt: new Date().toISOString(),
      customerSelection: {all: true},
      appliesOncePerCustomer: true,
      customerGets: {
        value: {percentage: percent / 100},
        items: {all: true},
      },
    },
  },
);

const {codeDiscountNode, userErrors} = data.discountCodeBasicCreate;
if (codeDiscountNode) {
  console.log(`✓ created discount code "${code}" (${percent}% off) → ${codeDiscountNode.id}`);
} else {
  console.error(`✗ "${code}": ${JSON.stringify(userErrors)}`);
  process.exit(1);
}
