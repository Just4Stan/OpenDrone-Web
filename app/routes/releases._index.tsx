import {redirect} from 'react-router';

// The blog was consolidated to a single feed at /blog (Shopify `news` blog).
// Keep the old /releases URL working with a permanent redirect.
export function loader() {
  return redirect('/blog', 301);
}
