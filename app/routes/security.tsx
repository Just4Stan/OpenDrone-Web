import {useLoaderData} from 'react-router';
import type {Route} from './+types/security';
import {LegalPage} from '~/components/LegalPage';
import {legalLabels, resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = ({data}) => {
  const locale = data?.locale ?? 'en';
  const labels = legalLabels('security', locale);
  return buildSeoMeta({
    title: labels.title,
    description: labels.description,
    locale: locale === 'nl' ? 'nl_BE' : 'en_US',
    alternateLocales: [locale === 'nl' ? 'en_US' : 'nl_BE'],
  });
};

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(
    request,
    'vulnerability-handling-policy',
    'security',
  );
}

export default function SecurityRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  const labels = legalLabels('security', locale);
  const isNl = locale === 'nl';
  return (
    <LegalPage
      eyebrow={labels.eyebrow}
      title={labels.title}
      html={html}
      locale={locale}
    >
      <p>
        {isNl ? 'Meld beveiligingsproblemen aan ' : 'Report security issues to '}
        <a href="mailto:stan@incutec.eu">stan@incutec.eu</a>.{' '}
        {isNl ? 'Zie ' : 'See '}
        <a href="/.well-known/security.txt">/.well-known/security.txt</a>{' '}
        {isNl
          ? 'voor de machine-leesbare contactinformatie.'
          : 'for the machine-readable contact record.'}
      </p>
    </LegalPage>
  );
}
