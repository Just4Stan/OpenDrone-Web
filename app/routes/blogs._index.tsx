import {redirect} from 'react-router';

// Single consolidated blog now lives at /blog. Permanent redirect.
export function loader() {
  return redirect('/blog', 301);
}
