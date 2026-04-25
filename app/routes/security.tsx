import {useLoaderData} from 'react-router';
import type {Route} from './+types/security';
import {LegalPage} from '~/components/LegalPage';
import {alternateLocaleTags, legalLabels, resolveLegalLoader, seoLocaleTag, type Locale} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const locale = data?.locale ?? 'en';
  const labels = legalLabels('security', locale);
  return buildSeoMeta({
    title: labels.title,
    description: labels.description,
    locale: seoLocaleTag(locale),
    alternateLocales: alternateLocaleTags(locale),
    canonical: data?.canonicalUrl,
    hreflang: data?.hreflang,
  });
};

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(
    request,
    'vulnerability-handling-policy',
    'security',
  );
}

const FOOTER_COPY: Record<
  Locale,
  {prefix: string; middle: string; suffix: string}
> = {
  en: {
    prefix: 'Report security issues to ',
    middle: 'See ',
    suffix: 'for the machine-readable contact record.',
  },
  nl: {
    prefix: 'Meld beveiligingsproblemen aan ',
    middle: 'Zie ',
    suffix: 'voor de machine-leesbare contactinformatie.',
  },
  fr: {
    prefix: 'Signalez les problèmes de sécurité à ',
    middle: 'Voir ',
    suffix: 'pour les coordonnées au format machine.',
  },
};

export default function SecurityRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  const labels = legalLabels('security', locale);
  const t = FOOTER_COPY[locale];
  return (
    <LegalPage
      eyebrow={labels.eyebrow}
      title={labels.title}
      html={html}
      locale={locale}
    >
      <p>
        {t.prefix}
        <a href="mailto:security@opendrone.be">security@opendrone.be</a>.{' '}
        {t.middle}
        <a href="/.well-known/security.txt">/.well-known/security.txt</a>{' '}
        {t.suffix}
      </p>
    </LegalPage>
  );
}
