import {redirect} from 'react-router';

// Single consolidated feed now lives at /newsletter. Permanent redirect.
export function loader() {
  return redirect('/newsletter', 301);
}
