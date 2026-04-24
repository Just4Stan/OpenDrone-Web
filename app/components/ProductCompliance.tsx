import type {CompanyIdentity} from '~/lib/company';
import type {Locale} from '~/lib/i18n';

type Metafield =
  | {
      key?: string | null;
      namespace?: string | null;
      value?: string | null;
      type?: string | null;
    }
  | null
  | undefined;

type ProductLike = {
  title?: string | null;
  vendor?: string | null;
  handle?: string | null;
  safetyWarningsNl?: Metafield;
  safetyWarningsFr?: Metafield;
  safetyWarningsEn?: Metafield;
  datasheetUrl?: Metafield;
  manualUrl?: Metafield;
  docUrl?: Metafield;
  sbomUrl?: Metafield;
  githubRepo?: Metafield;
  modelNumber?: Metafield;
  batchId?: Metafield;
  firmwareVersion?: Metafield;
  supportEndDate?: Metafield;
  vulnContactEmail?: Metafield;
  batteryWh?: Metafield;
  batteryUnNumber?: Metafield;
};

const UI: Record<
  Locale,
  {
    heading: string;
    manufacturer: string;
    productIdentifier: string;
    modelLabel: string;
    batchLabel: string;
    safetyHeading: string;
    downloadDatasheet: string;
    downloadManual: string;
    downloadDoc: string;
    downloadSbom: string;
    sourceLabel: string;
    firmwareLabel: string;
    supportUntilLabel: string;
    vulnContactLabel: string;
    batteryLabel: string;
    ariaLabel: string;
  }
> = {
  en: {
    heading: 'Manufacturer · Safety · Documentation',
    manufacturer: 'Manufacturer',
    productIdentifier: 'Product identifier',
    modelLabel: 'Model',
    batchLabel: 'Batch',
    safetyHeading: 'Safety warnings',
    downloadDatasheet: 'Datasheet',
    downloadManual: 'User manual',
    downloadDoc: 'Declaration of Conformity',
    downloadSbom: 'SBOM',
    sourceLabel: 'Source & design files',
    firmwareLabel: 'Firmware',
    supportUntilLabel: 'Security updates until',
    vulnContactLabel: 'Security contact',
    batteryLabel: 'Battery',
    ariaLabel: 'Manufacturer and safety information',
  },
  nl: {
    heading: 'Fabrikant · Veiligheid · Documentatie',
    manufacturer: 'Fabrikant',
    productIdentifier: 'Productidentificatie',
    modelLabel: 'Model',
    batchLabel: 'Batch',
    safetyHeading: 'Veiligheidswaarschuwingen',
    downloadDatasheet: 'Datasheet',
    downloadManual: 'Gebruikershandleiding',
    downloadDoc: 'Conformiteitsverklaring',
    downloadSbom: 'SBOM',
    sourceLabel: 'Broncode & ontwerpbestanden',
    firmwareLabel: 'Firmware',
    supportUntilLabel: 'Beveiligingsupdates tot',
    vulnContactLabel: 'Beveiligingscontact',
    batteryLabel: 'Batterij',
    ariaLabel: 'Fabrikant- en veiligheidsinformatie',
  },
  fr: {
    heading: 'Fabricant · Sécurité · Documentation',
    manufacturer: 'Fabricant',
    productIdentifier: 'Identifiant du produit',
    modelLabel: 'Modèle',
    batchLabel: 'Lot',
    safetyHeading: 'Avertissements de sécurité',
    downloadDatasheet: 'Fiche technique',
    downloadManual: 'Manuel d’utilisation',
    downloadDoc: 'Déclaration de conformité',
    downloadSbom: 'SBOM',
    sourceLabel: 'Sources & fichiers de conception',
    firmwareLabel: 'Firmware',
    supportUntilLabel: 'Mises à jour de sécurité jusqu’au',
    vulnContactLabel: 'Contact sécurité',
    batteryLabel: 'Batterie',
    ariaLabel: 'Informations sur le fabricant et la sécurité',
  },
};

function val(m: Metafield): string | null {
  const v = m?.value;
  if (!v) return null;
  return v;
}

// Only http(s) URLs are ever rendered into href=. Metafield values
// come from Shopify admin, and a mis-configured admin entry like
// `javascript:alert(1)` would otherwise execute on click — React does
// not block non-http schemes in anchor hrefs.
function safeUrl(m: Metafield): string | null {
  const v = val(m);
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : null;
}

// Constrain mailto: values to a simple RFC-5321-ish shape so a stray
// metafield entry can't smuggle extra headers via CRLF or redirect
// to a non-mailto scheme.
function safeEmail(m: Metafield): string | null {
  const v = val(m);
  if (!v) return null;
  return /^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(v) ? v : null;
}

function pickSafety(product: ProductLike, locale: Locale): string | null {
  const nl = val(product.safetyWarningsNl);
  const fr = val(product.safetyWarningsFr);
  const en = val(product.safetyWarningsEn);
  if (locale === 'nl') return nl ?? en ?? fr;
  if (locale === 'fr') return fr ?? en ?? nl;
  return en ?? nl ?? fr;
}

function DownloadButton({href, label}: {href: string; label: string}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="product-compliance-download"
    >
      {label}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </a>
  );
}

export function ProductCompliance({
  product,
  company,
  locale = 'en',
}: {
  product: ProductLike;
  company: CompanyIdentity;
  locale?: Locale;
}) {
  const ui = UI[locale];
  const safety = pickSafety(product, locale);
  const datasheet = safeUrl(product.datasheetUrl);
  const manual = safeUrl(product.manualUrl);
  const doc = safeUrl(product.docUrl);
  const sbom = safeUrl(product.sbomUrl);
  const github = safeUrl(product.githubRepo);
  const modelNumber = val(product.modelNumber);
  const batchId = val(product.batchId);
  const firmwareVersion = val(product.firmwareVersion);
  const supportEndDate = val(product.supportEndDate);
  const vulnContact = safeEmail(product.vulnContactEmail);
  const batteryWh = val(product.batteryWh);
  const batteryUn = val(product.batteryUnNumber);

  const hasDownloads = datasheet || manual || doc || sbom;
  const hasFirmwareBlock = firmwareVersion || supportEndDate || vulnContact;
  const hasBatteryBlock = batteryWh || batteryUn;

  return (
    <section className="product-compliance" aria-label={ui.ariaLabel}>
      <h2 className="section-heading">{ui.heading}</h2>

      <dl className="product-compliance-grid">
        <div>
          <dt>{ui.manufacturer}</dt>
          <dd>
            <strong>{company.name}</strong>
            <br />
            {company.address}
            <br />
            <a href={`mailto:${company.email}`}>{company.email}</a>
          </dd>
        </div>
        <div>
          <dt>{ui.productIdentifier}</dt>
          <dd>
            {product.title}
            {modelNumber ? <> — {ui.modelLabel} {modelNumber}</> : null}
            {batchId ? (
              <>
                <br />
                <span className="product-compliance-muted">
                  {ui.batchLabel} {batchId}
                </span>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      {safety ? (
        <div className="product-compliance-safety" role="note">
          <strong>{ui.safetyHeading}</strong>
          <p>{safety}</p>
        </div>
      ) : null}

      {hasBatteryBlock ? (
        <dl className="product-compliance-grid">
          <div>
            <dt>{ui.batteryLabel}</dt>
            <dd>
              {batteryUn ? <>UN {batteryUn}</> : null}
              {batteryUn && batteryWh ? ' · ' : null}
              {batteryWh ? <>{batteryWh} Wh</> : null}
            </dd>
          </div>
        </dl>
      ) : null}

      {hasFirmwareBlock ? (
        <dl className="product-compliance-grid">
          {firmwareVersion ? (
            <div>
              <dt>{ui.firmwareLabel}</dt>
              <dd>{firmwareVersion}</dd>
            </div>
          ) : null}
          {supportEndDate ? (
            <div>
              <dt>{ui.supportUntilLabel}</dt>
              <dd>{supportEndDate}</dd>
            </div>
          ) : null}
          {vulnContact ? (
            <div>
              <dt>{ui.vulnContactLabel}</dt>
              <dd>
                <a href={`mailto:${vulnContact}`}>{vulnContact}</a>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {hasDownloads ? (
        <div className="product-compliance-downloads">
          {datasheet ? (
            <DownloadButton href={datasheet} label={ui.downloadDatasheet} />
          ) : null}
          {manual ? (
            <DownloadButton href={manual} label={ui.downloadManual} />
          ) : null}
          {doc ? <DownloadButton href={doc} label={ui.downloadDoc} /> : null}
          {sbom ? (
            <DownloadButton href={sbom} label={ui.downloadSbom} />
          ) : null}
        </div>
      ) : null}

      <ul className="product-compliance-marks">
        <li>CE</li>
        <li>RoHS</li>
        <li>WEEE</li>
        <li>CERN-OHL-S</li>
        <li>Open Source Hardware</li>
      </ul>

      {github ? (
        <p className="product-compliance-repo">
          {ui.sourceLabel}:{' '}
          <a href={github} target="_blank" rel="noopener noreferrer">
            {github.replace(/^https?:\/\//, '')}
          </a>
        </p>
      ) : null}
    </section>
  );
}
