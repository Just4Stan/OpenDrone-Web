import {redirect, type LoaderFunctionArgs} from 'react-router';

// /releases/<handle> → /newsletter/<handle> (consolidated). Permanent.
export function loader({params}: LoaderFunctionArgs) {
  return redirect(`/newsletter/${params.handle ?? ''}`, 301);
}
