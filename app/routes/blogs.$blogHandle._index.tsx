import {redirect} from 'react-router';

// Per-blog index collapsed into the single /newsletter feed. Permanent.
export function loader() {
  return redirect('/newsletter', 301);
}
