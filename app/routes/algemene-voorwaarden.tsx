import {useLoaderData} from 'react-router';
import type {Route} from './+types/algemene-voorwaarden';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Algemene Voorwaarden',
    description:
      'Verkoopvoorwaarden voor de OpenDrone webshop, exploitatie door Incutec BV.',
    locale: 'nl_BE',
    alternateLocales: ['en_US'],
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(
    request,
    'algemene-voorwaarden',
    'algemene-voorwaarden',
  );
}

export default function AlgemeneVoorwaardenRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage
      eyebrow="Legal · T&C"
      title="Algemene Voorwaarden"
      html={html}
      locale={locale}
    />
  );
}
