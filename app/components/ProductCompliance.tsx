import type {CompanyIdentity} from '~/lib/company';

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
  datasheetUrl?: Metafield;
  manualUrl?: Metafield;
  docUrl?: Metafield;
  sbomUrl?: Metafield;
  githubRepo?: Metafield;
  modelNumber?: Metafield;
  batchId?: Metafield;
};

function val(m: Metafield): string | null {
  const v = m?.value;
  if (!v) return null;
  return v;
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

/**
 * GPSR pre-sale info block. Renders manufacturer identity, product
 * identifier, safety warnings and downloadable documentation. Each section
 * is conditionally rendered so a freshly seeded product without metafields
 * still has a minimal, legally-valid block (manufacturer identity + product
 * identifier from the Shopify product itself).
 */
export function ProductCompliance({
  product,
  company,
}: {
  product: ProductLike;
  company: CompanyIdentity;
}) {
  const safety = val(product.safetyWarningsNl);
  const datasheet = val(product.datasheetUrl);
  const manual = val(product.manualUrl);
  const doc = val(product.docUrl);
  const sbom = val(product.sbomUrl);
  const github = val(product.githubRepo);
  const modelNumber = val(product.modelNumber);
  const batchId = val(product.batchId);

  const hasDownloads = datasheet || manual || doc || sbom;

  return (
    <section
      className="product-compliance"
      aria-label="Manufacturer and safety information"
    >
      <h2 className="section-heading">Manufacturer · Safety · Documentation</h2>

      <dl className="product-compliance-grid">
        <div>
          <dt>Manufacturer</dt>
          <dd>
            <strong>{company.name}</strong>
            <br />
            {company.address}
            <br />
            <a href={`mailto:${company.email}`}>{company.email}</a>
          </dd>
        </div>
        <div>
          <dt>Product identifier</dt>
          <dd>
            {product.title}
            {modelNumber ? <> — Model {modelNumber}</> : null}
            {batchId ? (
              <>
                <br />
                <span className="product-compliance-muted">Batch {batchId}</span>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      {safety ? (
        <div className="product-compliance-safety" role="note">
          <strong>Veiligheidswaarschuwingen</strong>
          <p>{safety}</p>
        </div>
      ) : null}

      {hasDownloads ? (
        <div className="product-compliance-downloads">
          {datasheet ? <DownloadButton href={datasheet} label="Datasheet" /> : null}
          {manual ? <DownloadButton href={manual} label="User manual" /> : null}
          {doc ? (
            <DownloadButton href={doc} label="Declaration of Conformity" />
          ) : null}
          {sbom ? <DownloadButton href={sbom} label="SBOM" /> : null}
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
          Source &amp; design files:{' '}
          <a href={github} target="_blank" rel="noopener noreferrer">
            {github.replace(/^https?:\/\//, '')}
          </a>
        </p>
      ) : null}
    </section>
  );
}
