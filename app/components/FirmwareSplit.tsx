import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

const CONTRIBUTION_EUR = 1;

const EUR_FORMATTER = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * Marketing block shown on each PDP: breaks the price into what funds
 * the hardware vs what we forward to the open-source firmware
 * maintainers. The split is a flat €1 per order regardless of variant
 * for now. Only renders when the price is above a small floor and the
 * currency is EUR.
 */
export function FirmwareSplit({
  price,
  productTitle,
  firmwareProject,
  firmwareUrl,
}: {
  price?: Pick<MoneyV2, 'amount' | 'currencyCode'> | null;
  productTitle: string;
  firmwareProject?: string;
  firmwareUrl?: string;
}) {
  const amount = price ? parseFloat(price.amount) : 0;
  if (
    !price ||
    price.currencyCode !== 'EUR' ||
    !Number.isFinite(amount) ||
    amount < CONTRIBUTION_EUR + 5
  ) {
    return null;
  }

  const boardAmountRaw = amount - CONTRIBUTION_EUR;
  const boardAmountData: MoneyV2 = {
    amount: boardAmountRaw.toFixed(2),
    currencyCode: 'EUR',
  };
  const contributionData: MoneyV2 = {
    amount: CONTRIBUTION_EUR.toFixed(2),
    currencyCode: 'EUR',
  };

  const boardAmountText = EUR_FORMATTER.format(boardAmountRaw);
  const contributionText = EUR_FORMATTER.format(CONTRIBUTION_EUR);

  return (
    <section className="firmware-split" aria-label="Open-source firmware contribution">
      <p className="firmware-split-eyebrow">
        {productTitle} · <span>Open source hardware</span>
      </p>
      <div className="firmware-split-amounts">
        <span className="firmware-split-board">
          <Money data={boardAmountData} />
        </span>
        <span className="firmware-split-plus" aria-hidden="true">
          +
        </span>
        <span className="firmware-split-contrib">
          <Money data={contributionData} />
        </span>
      </div>
      <p className="firmware-split-tagline">
        {boardAmountText} for the board.{' '}
        <strong>
          {contributionText} for the {firmwareProject ?? 'firmware'} maintainers
        </strong>
        .
      </p>
      {firmwareProject && firmwareUrl ? (
        <p className="firmware-split-link">
          Funded project:{' '}
          <a href={firmwareUrl} target="_blank" rel="noopener noreferrer">
            {firmwareProject} ↗
          </a>
        </p>
      ) : null}
    </section>
  );
}
