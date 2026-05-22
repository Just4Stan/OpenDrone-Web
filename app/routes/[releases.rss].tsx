import {redirect} from 'react-router';

// Feed moved to /blog.rss. Permanent redirect keeps existing subscribers.
export function loader() {
  return redirect('/blog.rss', 301);
}
