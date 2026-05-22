import {redirect, type LoaderFunctionArgs} from 'react-router';

// /blogs/<blog>/<article> → /blog/<article> (single consolidated blog).
export function loader({params}: LoaderFunctionArgs) {
  return redirect(`/blog/${params.articleHandle ?? ''}`, 301);
}
