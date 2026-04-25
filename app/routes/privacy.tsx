import {useLoaderData} from 'react-router';
import type {Route} from './+types/privacy';
import {LegalPage} from '~/components/LegalPage';
import {alternateLocaleTags, legalLabels, resolveLegalLoader, seoLocaleTag} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const locale = data?.locale ?? 'en';
  const labels = legalLabels('privacy', locale);
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
  return resolveLegalLoader(request, 'privacy-policy', 'privacy');
}

export default function PrivacyRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  const labels = legalLabels('privacy', locale);
  return (
    <LegalPage
      eyebrow={labels.eyebrow}
      title={labels.title}
      html={html}
      locale={locale}
    />
  );
}
