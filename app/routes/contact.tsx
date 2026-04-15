import {useLoaderData} from 'react-router';
import type {Route} from './+types/contact';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Contact',
    description: 'How to reach Incutec BV / OpenDrone.',
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(request, 'contact', 'contact');
}

export default function ContactRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage eyebrow="Company" title="Contact" html={html} locale={locale} />
  );
}
