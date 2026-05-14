import {redirect, type LoaderFunctionArgs} from 'react-router';

/**
 * /contact is the legacy URL. The contact hub is now merged into /support
 * so there's a single entry point for Discord + the ticket form. The
 * permanent redirect preserves external links and search-engine references;
 * the `LOCAL_PAGE_REWRITES` map in Header.tsx points the Shopify-admin
 * `/pages/contact` menu item directly at /support to avoid the extra hop.
 */
export async function loader({request}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return redirect(`/support${url.search}`, 301);
}

export default function ContactRedirect() {
  return null;
}
