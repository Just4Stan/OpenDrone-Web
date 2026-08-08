import {Money} from '@shopify/hydrogen';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {copyText} from '~/lib/copy';

const CONTRIBUTION_EUR = 1;

const EUR_FORMATTER = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * Marketing block shown on each PDP: breaks the price into what funds
 * the hardware vs what we forward to the open-source firmware
 * maintainers. The split is a flat €1 per board regardless of variant
 * for now. Only renders when the price is above a small floor and the
 * currency is EUR.
 */
export function FirmwareSplit({
  price,
  firmwareProject,
  firmwareUrl,
}: {
  price?: Pick<MoneyV2, 'amount' | 'currencyCode'> | null;
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
  const totalData: MoneyV2 = {
    amount: amount.toFixed(2),
    currencyCode: 'EUR',
  };

  const boardAmountText = EUR_FORMATTER.format(boardAmountRaw);
  const contributionText = EUR_FORMATTER.format(CONTRIBUTION_EUR);

  // Both tagline sentences stay ONE editable string each. The money and the
  // firmware project's name are data, so the copy marks their slots with
  // `{amount}` and `{project}` and the sentence is split around them here —
  // rather than shipping "for the" and "devs." to the studio as two
  // meaningless fragments.
  const boardParts = (
    copyText('product-chrome.firmware_split_board') ?? ''
  ).split('{amount}');
  const devParts = (
    copyText('product-chrome.firmware_split_devs') ?? ''
  ).split(/\{amount\}|\{project\}/);

  return (
    <section
      className="firmware-split"
      aria-label={copyText('product-chrome.firmware_split_aria')}
    >
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
        <span className="firmware-split-eq" aria-hidden="true">
          =
        </span>
        <span className="firmware-split-total">
          <Money data={totalData} />
        </span>
      </div>
      <p className="firmware-split-tagline">
        {boardParts[0]}
        {boardAmountText}
        {boardParts[1]}
        <br />
        <strong>
          {devParts[0]}
          {contributionText}
          {devParts[1]}
          {firmwareProject && firmwareUrl ? (
            <a href={firmwareUrl} target="_blank" rel="noopener noreferrer">
              {firmwareProject} ↗
            </a>
          ) : (
            (firmwareProject ??
              copyText('product-chrome.firmware_split_project_fallback'))
          )}
          {devParts[2]}
        </strong>
      </p>
    </section>
  );
}
