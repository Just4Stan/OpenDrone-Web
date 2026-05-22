import {redirect, type LoaderFunctionArgs} from 'react-router';

// /blogs/<blog>/<article> → /newsletter/<article> (consolidated feed).
export function loader({params}: LoaderFunctionArgs) {
  return redirect(`/newsletter/${params.articleHandle ?? ''}`, 301);
}
