import {redirect} from 'react-router';
import type {Route} from './+types/contribute';

// /contribute was merged into /roadmap on 2026-08-08. Keep old links alive.
export async function loader(_args: Route.LoaderArgs) {
  return redirect('/roadmap', 301);
}

export default function ContributeRoute() {
  return null;
}
