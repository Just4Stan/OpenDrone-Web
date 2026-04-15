import {useLoaderData} from 'react-router';
import type {Route} from './+types/warranty';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Warranty',
    description:
      '2-year legal guarantee of conformity on all OpenDrone hardware sold by Incutec BV.',
    locale: 'en_US',
    alternateLocales: ['nl_BE'],
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(request, 'warranty', 'warranty');
}

export default function WarrantyRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage eyebrow="Legal" title="Warranty" html={html} locale={locale} />
  );
}
