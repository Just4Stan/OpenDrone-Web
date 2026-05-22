import {redirect, type LoaderFunctionArgs} from 'react-router';

// /releases/<handle> → /blog/<handle> (consolidated blog). Permanent.
export function loader({params}: LoaderFunctionArgs) {
  return redirect(`/blog/${params.handle ?? ''}`, 301);
}
