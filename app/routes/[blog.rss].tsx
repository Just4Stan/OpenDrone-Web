import {redirect} from 'react-router';

// Feed moved to /newsletter.rss. Permanent redirect.
export function loader() {
  return redirect('/newsletter.rss', 301);
}
