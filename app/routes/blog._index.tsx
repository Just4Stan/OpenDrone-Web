import {redirect} from 'react-router';

// The newsletter/blog now lives at /newsletter. Permanent redirect.
export function loader() {
  return redirect('/newsletter', 301);
}
