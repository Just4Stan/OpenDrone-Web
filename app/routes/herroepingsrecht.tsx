import {useLoaderData} from 'react-router';
import type {Route} from './+types/herroepingsrecht';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Right of Withdrawal',
    description:
      '14-day withdrawal right and model withdrawal form for OpenDrone consumers (Incutec BV).',
    locale: 'en_US',
    alternateLocales: ['nl_BE'],
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(
    request,
    'herroepingsformulier',
    'herroepingsrecht',
  );
}

export default function HerroepingsrechtRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage
      eyebrow="Legal · Withdrawal"
      title="Right of Withdrawal"
      html={html}
      locale={locale}
    />
  );
}
