import {useLoaderData} from 'react-router';
import type {Route} from './+types/privacy';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Privacy Policy',
    description:
      'How Incutec BV processes personal data for the OpenDrone webshop — GDPR compliant.',
    locale: 'en_US',
    alternateLocales: ['nl_BE'],
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(request, 'privacy-policy', 'privacy');
}

export default function PrivacyRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage
      eyebrow="Legal · GDPR"
      title="Privacy Policy"
      html={html}
      locale={locale}
    />
  );
}
