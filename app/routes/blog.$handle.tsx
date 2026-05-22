import {redirect, type LoaderFunctionArgs} from 'react-router';

// /blog/<handle> → /newsletter/<handle>. Permanent redirect.
export function loader({params}: LoaderFunctionArgs) {
  return redirect(`/newsletter/${params.handle ?? ''}`, 301);
}
