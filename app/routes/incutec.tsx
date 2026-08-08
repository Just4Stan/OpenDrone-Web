import {redirect} from 'react-router';
import type {Route} from './+types/incutec';

// /incutec was merged into /open-source on 2026-08-08. Keep old links alive.
export async function loader(_args: Route.LoaderArgs) {
  return redirect('/open-source', 301);
}

export default function IncutecRoute() {
  return null;
}
