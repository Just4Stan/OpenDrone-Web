import {Link, useLoaderData} from 'react-router';
import type {Route} from './+types/newsletter_.unsubscribed';
import {buildSeoMeta} from '~/lib/seo';
import {verifyUnsubscribeToken} from '~/lib/newsletter/unsubscribe-token';

export const meta: Route.MetaFunction = () =>
  buildSeoMeta({
    title: 'Unsubscribed',
    description: 'You have been unsubscribed from the OpenDrone newsletter.',
    robots: 'noindex',
  });

/**
 * Confirmation page for one-click unsubscribe. Optional `?t=<token>` is
 * decoded server-side so we can show the email + timestamp the user
 * landed here from — context confirms which address was removed without
 * requiring a login. Token is the same one the email link carried; if
 * absent or invalid, the page still renders (the unsub itself happened
 * on the api route, this page is just a confirmation surface).
 */
export async function loader({context, request}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const payload = token
    ? await verifyUnsubscribeToken(context.env, token).catch(() => null)
    : null;
  return {
    email: payload?.email ?? null,
    removedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
}

export default function NewsletterUnsubscribed() {
  const {email, removedAt} = useLoaderData<typeof loader>();
  return (
    <div className="page-shell rn-unsub-page">
      <div className="rn-unsub-card">
        <div className="rn-unsub-mark" aria-hidden>
          ✓
        </div>
        <h1>You&apos;re unsubscribed.</h1>
        <p>We won&apos;t email you again. No survey, no upsell, no follow-up.</p>
        <Link to="/releases#subscribe" className="rn-unsub-resub">
          Resubscribe
        </Link>
        {email ? (
          <div className="rn-unsub-id">
            {email} · removed {removedAt} UTC
          </div>
        ) : null}
      </div>
    </div>
  );
}
