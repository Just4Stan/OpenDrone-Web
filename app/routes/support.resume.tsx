import {redirect} from 'react-router';
import type {Route} from './+types/support.resume';
import {fetchThreadMessages} from '~/lib/support/discord';
import {
  buildSupportSetCookie,
  signTicket,
  type SupportTicket,
} from '~/lib/support/session';
import {verifyResumeToken} from '~/lib/support/resume-token';

/**
 * Cross-device resume endpoint. The user clicks a link from their inbox;
 * we verify the signed token and re-issue the cookie that points back at
 * their existing Discord thread. Then we 302 to /contact so the widget
 * boots into "active" phase straight away.
 *
 * If the token is malformed, expired, or its thread has been deleted on
 * the Discord side, fall back to /contact with a query flag the widget
 * uses to surface a friendly "this link no longer works" notice.
 */

export async function loader({request, context}: Route.LoaderArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');
  const env = context.env;

  const payload = await verifyResumeToken(env, token);
  if (!payload) {
    return redirect('/contact?support=invalid-link');
  }

  // Confirm the thread still exists so we don't drop the user into a
  // chat that 404s on their first poll.
  const probe = await fetchThreadMessages(env, payload.tid, {limit: 1}).catch(
    () => ({thread: null, messages: []}),
  );
  if (!probe.thread) {
    return redirect('/contact?support=ticket-gone');
  }

  const ticket: SupportTicket = {
    v: 1,
    tid: payload.tid,
    uid: payload.uid,
    name: payload.name,
    email: payload.email,
    createdAt: payload.iat,
  };
  const cookie = await signTicket(env, ticket);
  return redirect('/contact?support=resumed', {
    headers: {'Set-Cookie': buildSupportSetCookie(cookie)},
  });
}
