import {useLoaderData} from 'react-router';
import type {Route} from './+types/shipping';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Shipping & Delivery',
    description:
      'Shipping zones, delivery times and responsibility for OpenDrone orders (Incutec BV).',
    locale: 'en_US',
    alternateLocales: ['nl_BE'],
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(request, 'shipping', 'shipping');
}

export default function ShippingRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage
      eyebrow="Legal"
      title="Shipping & Delivery"
      html={html}
      locale={locale}
    />
  );
}
