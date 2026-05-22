import {redirect} from 'react-router';

// Per-blog index collapsed into the single /blog feed. Permanent redirect.
export function loader() {
  return redirect('/blog', 301);
}
