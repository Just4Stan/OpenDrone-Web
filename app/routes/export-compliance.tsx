import {useLoaderData} from 'react-router';
import type {Route} from './+types/export-compliance';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Export Compliance',
    description:
      'Export control self-classification memo for OpenDrone products (EU Reg 2021/821 + sanctions).',
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(
    request,
    'export-control-memo',
    'export-compliance',
  );
}

export default function ExportComplianceRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage
      eyebrow="Legal · Trade"
      title="Export Compliance"
      html={html}
      locale={locale}
    />
  );
}
