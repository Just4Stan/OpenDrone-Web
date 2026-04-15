import {redirect} from 'react-router';
import type {Route} from './+types/terms';
import {getLocaleFromRequest, localeFromPathname} from '~/lib/i18n';

export async function loader({request}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const existing = localeFromPathname(url.pathname);
  const locale = existing ?? getLocaleFromRequest(request);
  throw redirect(`/${locale}/algemene-voorwaarden`, 308);
}

export default function Terms() {
  return null;
}
