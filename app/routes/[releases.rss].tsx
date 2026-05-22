import {redirect} from 'react-router';

// Feed moved to /newsletter.rss. Permanent redirect keeps old subscribers.
export function loader() {
  return redirect('/newsletter.rss', 301);
}
