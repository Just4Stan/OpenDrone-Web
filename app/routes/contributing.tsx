import {redirect} from 'react-router';
import type {Route} from './+types/contributing';
import {CONTRIBUTING_URL} from '~/lib/company';

// The how-to lives once, in the org's CONTRIBUTING.md (maintainer, 2026-08-15).
// The site page it replaced is in git history; old links keep working.
export async function loader(_args: Route.LoaderArgs) {
  return redirect(CONTRIBUTING_URL, 301);
}

export default function ContributingRoute() {
  return null;
}
