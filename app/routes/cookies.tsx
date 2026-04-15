import {useLoaderData} from 'react-router';
import type {Route} from './+types/cookies';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Cookie Policy',
    description:
      'Which cookies the OpenDrone webshop uses and how to manage them.',
    locale: 'en_US',
    alternateLocales: ['nl_BE'],
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(request, 'cookie-policy', 'cookies');
}

export default function CookiesRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage
      eyebrow="Legal · Cookies"
      title="Cookie Policy"
      html={html}
      locale={locale}
    />
  );
}
