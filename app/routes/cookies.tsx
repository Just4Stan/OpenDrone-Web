import {useLoaderData} from 'react-router';
import type {Route} from './+types/cookies';
import {LegalPage} from '~/components/LegalPage';
import {legalLabels, resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const locale = data?.locale ?? 'en';
  const labels = legalLabels('cookies', locale);
  return buildSeoMeta({
    title: labels.title,
    description: labels.description,
    locale: locale === 'nl' ? 'nl_BE' : 'en_US',
    alternateLocales: [locale === 'nl' ? 'en_US' : 'nl_BE'],
    canonical: data?.canonicalUrl,
    hreflang: data?.hreflang,
  });
};

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(request, 'cookie-policy', 'cookies');
}

export default function CookiesRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  const labels = legalLabels('cookies', locale);
  return (
    <LegalPage
      eyebrow={labels.eyebrow}
      title={labels.title}
      html={html}
      locale={locale}
    />
  );
}
