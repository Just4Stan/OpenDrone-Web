import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {useRef} from 'react';
import {motion} from 'motion/react';
import {DURATION, EASE} from '~/lib/motion';

/**
 * A short odometer-style roll on the figure, keyed on the amount so it replays
 * on a variant switch — but suppressed on first mount (`animate=false`) so a
 * freshly-loaded PDP shows a settled price, not a spin. Wraps <Money> so
 * Shopify keeps owning currency formatting/locale; motion only translates the
 * already-formatted figure. Reduced motion (global MotionConfig) collapses it.
 */
function PriceRoll({price, animate}: {price: MoneyV2; animate: boolean}) {
  return (
    <motion.span
      key={price.amount}
      className="product-price-roll"
      initial={animate ? {y: '0.5em', opacity: 0} : false}
      animate={{y: 0, opacity: 1}}
      transition={{duration: DURATION.base, ease: EASE.reveal}}
    >
      <Money data={price} />
    </motion.span>
  );
}

export function ProductPrice({
  price,
  compareAtPrice,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
}) {
  // Roll only on updates, never the first paint. This node stays mounted across
  // variant switches (same tree position), so the ref persists — the keyed
  // PriceRoll remounts + plays its initial roll on each amount change once the
  // first render is behind us.
  const firstRef = useRef(true);
  const animate = !firstRef.current;
  firstRef.current = false;
  return (
    <span className="product-price">
      {compareAtPrice ? (
        <span className="product-price-row">
          {price ? (
            <span className="product-price-sale">
              <PriceRoll price={price} animate={animate} />
            </span>
          ) : null}
          <s className="product-price-compare">
            <Money data={compareAtPrice} />
          </s>
        </span>
      ) : price ? (
        <PriceRoll price={price} animate={animate} />
      ) : (
        <span>&nbsp;</span>
      )}
    </span>
  );
}
