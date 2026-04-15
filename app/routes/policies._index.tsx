import {redirect} from 'react-router';
import type {Route} from './+types/policies._index';

/**
 * Legal content is owned by the storefront under dedicated routes. Anything
 * hitting `/policies` is forwarded to the imprint/legal overview.
 */
export async function loader(_args: Route.LoaderArgs) {
  throw redirect('/legal', 308);
}

export default function Policies() {
  return null;
}
