import {useLoaderData} from 'react-router';
import type {Route} from './+types/contact';
import {LegalPage} from '~/components/LegalPage';
import {legalLabels, resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const locale = data?.locale ?? 'en';
  const labels = legalLabels('contact', locale);
  return buildSeoMeta({
    title: labels.title,
    description: labels.description,
    locale: locale === 'nl' ? 'nl_BE' : 'en_US',
    alternateLocales: [locale === 'nl' ? 'en_US' : 'nl_BE'],
  });
};

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(request, 'contact', 'contact');
}

export default function ContactRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  const labels = legalLabels('contact', locale);
  return (
    <LegalPage
      eyebrow={labels.eyebrow}
      title={labels.title}
      html={html}
      locale={locale}
    />
  );
}
