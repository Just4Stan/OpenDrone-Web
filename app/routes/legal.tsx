import {Link, redirect, useLoaderData} from 'react-router';
import type {Route} from './+types/legal';
import {getCompanyIdentity} from '~/lib/company';
import {CompanyFooterBlock} from '~/components/CompanyFooterBlock';
import {buildSeoMeta} from '~/lib/seo';
import {
  getLocaleFromRequest,
  langCookieHeader,
  localeFromPathname,
  type Locale,
} from '~/lib/i18n';

export const meta: Route.MetaFunction = ({data}) => {
  const isNl = data?.locale === 'nl';
  return buildSeoMeta({
    title: isNl ? 'Juridisch / Colofon' : 'Legal / Imprint',
    description: isNl
      ? 'Juridische identificatie van de verkoper achter de OpenDrone-webshop en overzicht van alle juridische pagina\u2019s.'
      : 'Legal identification of the seller behind the OpenDrone webshop and an overview of all legal pages.',
    locale: isNl ? 'nl_BE' : 'en_US',
    alternateLocales: [isNl ? 'en_US' : 'nl_BE'],
  });
};

export async function loader({context, request}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const existing = localeFromPathname(url.pathname);
  if (!existing) {
    const locale = getLocaleFromRequest(request);
    throw redirect(`/${locale}/legal`, {
      status: 302,
      headers: {'Set-Cookie': langCookieHeader(locale)},
    });
  }
  const company = getCompanyIdentity(
    context.env as unknown as Record<string, string | undefined>,
  );
  return {company, locale: existing as Locale};
}

type PageEntry = {
  slug: string;
  labelEn: string;
  labelNl: string;
  descEn: string;
  descNl: string;
};

const PAGES: PageEntry[] = [
  {
    slug: 'algemene-voorwaarden',
    labelEn: 'Terms & Conditions',
    labelNl: 'Algemene Voorwaarden',
    descEn: 'B2C sale terms, ordering, delivery, warranty, complaints.',
    descNl: 'Verkoopvoorwaarden B2C, bestelproces, levering, garantie, klachten.',
  },
  {
    slug: 'privacy',
    labelEn: 'Privacy Policy',
    labelNl: 'Privacybeleid',
    descEn: 'GDPR — which personal data we process and why.',
    descNl: 'GDPR — welke persoonsgegevens wij verwerken en waarom.',
  },
  {
    slug: 'cookies',
    labelEn: 'Cookie Policy',
    labelNl: 'Cookiebeleid',
    descEn: 'List of cookies the webshop sets.',
    descNl: 'Lijst van cookies die de webshop plaatst.',
  },
  {
    slug: 'herroepingsrecht',
    labelEn: 'Right of Withdrawal',
    labelNl: 'Herroepingsrecht',
    descEn: '14-day cooling-off period and model withdrawal form.',
    descNl: '14-dagen bedenktijd + modelformulier voor herroeping.',
  },
  {
    slug: 'shipping',
    labelEn: 'Shipping & Delivery',
    labelNl: 'Verzending & Levering',
    descEn: 'Shipping zones, times and responsibility.',
    descNl: 'Verzendzones, leveringstermijnen en risico.',
  },
  {
    slug: 'warranty',
    labelEn: 'Warranty',
    labelNl: 'Garantie',
    descEn: '2-year legal guarantee of conformity.',
    descNl: '2-jarige wettelijke conformiteitsgarantie.',
  },
  {
    slug: 'export-compliance',
    labelEn: 'Export Compliance',
    labelNl: 'Exportnaleving',
    descEn: 'Export control and sanctions policy.',
    descNl: 'Exportcontrole en sanctiebeleid.',
  },
  {
    slug: 'contact',
    labelEn: 'Contact',
    labelNl: 'Contact',
    descEn: 'How to reach us.',
    descNl: 'Hoe ons bereiken.',
  },
  {
    slug: 'security',
    labelEn: 'Security',
    labelNl: 'Beveiliging',
    descEn: 'Coordinated vulnerability disclosure (CRA).',
    descNl: 'Gecoördineerde kwetsbaarheidsmelding (CRA).',
  },
  {
    slug: 'cookie-settings',
    labelEn: 'Cookie settings',
    labelNl: 'Cookie-instellingen',
    descEn: 'Overview and reset of session cookies.',
    descNl: 'Overzicht en reset van sessie cookies.',
  },
];

export default function LegalIndex() {
  const {company, locale} = useLoaderData<typeof loader>();
  const isNl = locale === 'nl';
  const pageTitle = isNl ? 'Juridisch' : 'Legal';
  const intro = isNl
    ? `OpenDrone is een merk uitgebaat door ${company.name}. Alle bestellingen worden verkocht door onderstaande juridische entiteit.`
    : `OpenDrone is a product brand operated by ${company.name}. All orders are sold by the legal entity below.`;
  return (
    <div className="legal-index page-shell">
      <header className="page-header">
        <p className="page-eyebrow">
          {isNl ? 'Juridisch · Colofon' : 'Legal · Imprint'}
        </p>
        <h1 className="page-title">{pageTitle}</h1>
        <p className="page-description">{intro}</p>
      </header>

      <section className="legal-identity" style={{marginBottom: '2.5rem'}}>
        <h2 className="section-heading">{isNl ? 'Verkoper' : 'Seller'}</h2>
        <CompanyFooterBlock company={company} />
      </section>

      <section>
        <h2 className="section-heading">{isNl ? 'Pagina\u2019s' : 'Pages'}</h2>
        <div className="policies-grid">
          {PAGES.map((p) => (
            <article className="policy-card" key={p.slug}>
              <Link to={`/${locale}/${p.slug}`}>
                <strong>{isNl ? p.labelNl : p.labelEn}</strong>
              </Link>
              <p style={{marginTop: '0.35rem', fontSize: '0.75rem'}}>
                {isNl ? p.descNl : p.descEn}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
