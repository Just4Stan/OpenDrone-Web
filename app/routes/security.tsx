import {useLoaderData} from 'react-router';
import type {Route} from './+types/security';
import {LegalPage} from '~/components/LegalPage';
import {resolveLegalLoader} from '~/lib/i18n';
import {buildSeoMeta} from '~/lib/seo';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Security — Vulnerability Disclosure',
    description:
      'Coordinated vulnerability disclosure policy for OpenDrone hardware and firmware (CRA).',
  });

export async function loader({request}: Route.LoaderArgs) {
  return resolveLegalLoader(
    request,
    'vulnerability-handling-policy',
    'security',
  );
}

export default function SecurityRoute() {
  const {html, locale} = useLoaderData<typeof loader>();
  return (
    <LegalPage
      eyebrow="Security · CRA"
      title="Vulnerability Disclosure"
      html={html}
      locale={locale}
    >
      <p>
        Report security issues to{' '}
        <a href="mailto:security@incutec.com">security@incutec.com</a>. See{' '}
        <a href="/.well-known/security.txt">/.well-known/security.txt</a> for
        the machine-readable contact record.
      </p>
    </LegalPage>
  );
}
