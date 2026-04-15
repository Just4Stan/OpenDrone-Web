import type {CompanyIdentity} from '~/lib/company';

/**
 * Legal identity block for the selling entity. Used in Footer and on the
 * /legal imprint page. Product branding (OpenDrone/OpenFC/OpenESC) is
 * intentionally absent — this block is the seller, not the product.
 */
export function CompanyFooterBlock({company}: {company: CompanyIdentity}) {
  return (
    <address className="not-italic flex flex-col gap-1.5 font-mono text-xs text-[var(--color-text-muted)] leading-relaxed">
      <p className="text-[var(--color-text)] font-bold">{company.name}</p>
      <p>{company.address}</p>
      <p>KBO/BCE: {company.kbo}</p>
      <p>BTW/VAT: {company.vat}</p>
      <p>
        <a
          href={`mailto:${company.email}`}
          className="hover:text-[var(--color-text)] transition-colors"
        >
          {company.email}
        </a>
      </p>
      {company.tel && company.tel !== '[pending]' ? <p>{company.tel}</p> : null}
    </address>
  );
}
