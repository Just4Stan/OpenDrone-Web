/**
 * Company identity for legal/compliance footer, invoices, imprints.
 * Reads PUBLIC_COMPANY_* env vars from the Hydrogen/Oxygen runtime env.
 *
 * All user-visible copy referring to the selling entity must use this
 * identity — product branding (OpenDrone, OpenFC, OpenESC) is separate.
 */

export type CompanyIdentity = {
  name: string;
  address: string;
  kbo: string;
  vat: string;
  email: string;
  tel: string;
};

const DEFAULTS: CompanyIdentity = {
  name: 'Incutec BV',
  address: 'Stapelhuisstraat 15, 3000 Leuven, Belgium',
  kbo: '[pending]',
  vat: 'BE[pending]',
  email: 'contact@opendrone.be',
  tel: '[pending]',
};

type MaybeEnv = Record<string, string | undefined> | undefined;

export function getCompanyIdentity(env: MaybeEnv): CompanyIdentity {
  const e = env || {};
  return {
    name: e.PUBLIC_COMPANY_NAME || DEFAULTS.name,
    address: e.PUBLIC_COMPANY_ADDRESS || DEFAULTS.address,
    kbo: e.PUBLIC_COMPANY_KBO || DEFAULTS.kbo,
    vat: e.PUBLIC_COMPANY_VAT || DEFAULTS.vat,
    email: e.PUBLIC_COMPANY_EMAIL || DEFAULTS.email,
    tel: e.PUBLIC_COMPANY_TEL || DEFAULTS.tel,
  };
}
