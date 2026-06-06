import {Fragment} from 'react';

/**
 * Wraps OpenDrone product/brand name tokens in a `.brand` span so they
 * render in the Tokio brand face (italic) wherever a product is named —
 * cards, the PDP hero, the cart, search, order history, bundles.
 *
 * A "token" is `Open` followed by a CamelCase or all-caps suffix:
 * OpenStack, OpenFC, OpenESC, OpenFrame, OpenRadio. The company name
 * "OpenDrone" is deliberately excluded — it always stays in the normal
 * site font, matching the OpenDrone logo. Only the token leans;
 * surrounding tagline copy keeps the normal font. When a string contains
 * no token the component is a transparent no-op, so it's safe to apply
 * liberally.
 *
 * Input is a plain string (Shopify `product.title`, a content label, …).
 * Non-string children pass through untouched.
 */
const BRAND_TOKEN = /\b(Open(?!Drone\b)[A-Z][A-Za-z0-9]*)\b/g;

export function BrandName({children}: {children: string | null | undefined}) {
  if (typeof children !== 'string' || !children) return <>{children}</>;

  // String.split with a capturing group interleaves the captured tokens
  // into the result: ["", "OpenStack", " — FC + ", "OpenESC", ""]. Odd
  // indices are the tokens, even indices the plain text between them.
  const parts = children.split(BRAND_TOKEN);
  if (parts.length === 1) return <>{children}</>;

  // Collapse to non-empty segments, keyed by their start offset in the
  // original string — unique and stable across renders (offset strictly
  // increases for every non-empty part).
  const segments: Array<{text: string; brand: boolean; start: number}> = [];
  let pos = 0;
  parts.forEach((part, i) => {
    if (part) segments.push({text: part, brand: i % 2 === 1, start: pos});
    pos += part.length;
  });

  return (
    <>
      {segments.map((s) =>
        s.brand ? (
          <span className="brand" key={s.start}>
            {s.text}
          </span>
        ) : (
          <Fragment key={s.start}>{s.text}</Fragment>
        ),
      )}
    </>
  );
}
