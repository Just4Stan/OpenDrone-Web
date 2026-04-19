import {data} from 'react-router';
import type {Route} from './+types/api.support.lookup';
import {findThreadsByEmail} from '~/lib/support/discord';
import {sendTicketIndex} from '~/lib/support/email';
import {buildResumeUrl, signResumeToken} from '~/lib/support/resume-token';
import {randomId} from '~/lib/support/session';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LookupResult = {ok: true} | {ok: false; message: string};

/**
 * "Resume by email" — the customer enters the email they used when they
 * opened a ticket. We scan the support forum for threads whose first
 * message contains that email, build a resume link per match, and send
 * them via one consolidated email.
 *
 * Privacy: the response is *always* a generic success message regardless
 * of whether matches were found. We never confirm or deny that a given
 * email has tickets — that would let an attacker fingerprint customers.
 * The only signal is the inbox: tickets exist iff an email arrives.
 *
 * Abuse: the endpoint fans out to ~80 Discord API calls per invocation,
 * so it's a natural amplifier. Honeypot + per-IP + per-email rate
 * limits keep a script from using it to drain the Discord quota.
 * (Turnstile isn't used here because the resume form is embedded in
 * the same widget as the ticket-intake form which already carries a
 * Turnstile widget — double-rendering the challenge would reset the
 * first one on interaction.)
 */
export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<LookupResult>(
      {ok: false, message: 'Method not allowed.'},
      {status: 405},
    );
  }
  const env = context.env;
  const ip = clientIp(request);

  const ipLimit = checkRateLimit(`support-lookup:ip:${ip}`, 3, 10 * 60 * 1000);
  if (!ipLimit.allowed) {
    return data<LookupResult>(
      {ok: false, message: 'Too many requests — try again later.'},
      {
        status: 429,
        headers: {'Retry-After': String(ipLimit.resetInSeconds)},
      },
    );
  }

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const honeypot = String(form.get('website') ?? '');

  if (honeypot) return data<LookupResult>({ok: true});
  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    return data<LookupResult>(
      {ok: false, message: 'Enter a valid email address.'},
      {status: 400},
    );
  }

  const emailLimit = checkRateLimit(
    `support-lookup:email:${email}`,
    2,
    24 * 60 * 60 * 1000,
  );
  // When the email-level limit kicks in we still answer with the same
  // privacy-preserving generic success — never confirm or deny tickets.
  if (!emailLimit.allowed) return data<LookupResult>({ok: true});

  // Run the search + email send asynchronously when possible — we always
  // tell the user "check your inbox" within ~50ms regardless of how long
  // the Discord scan + Resend round-trip takes.
  const job = (async () => {
    try {
      const matches = await findThreadsByEmail(env, email, {maxCandidates: 80});
      if (!matches.length) return;

      const baseUrl = new URL(request.url).origin;
      const tickets = await Promise.all(
        matches.map(async (t) => {
          const token = await signResumeToken(env, {
            tid: t.id,
            uid: randomId(),
            email,
            // We don't have the original name in this flow — the resume
            // route uses what's in the token, so a placeholder is fine.
            // Staff already see the original name in the Discord post.
            name: 'You',
          });
          return {
            subject: t.name,
            openedAt: t.createdAt
              ? new Date(t.createdAt).toLocaleDateString('en-GB')
              : 'recently',
            resumeUrl: buildResumeUrl(baseUrl, token),
          };
        }),
      );

      await sendTicketIndex(env, {to: email, tickets});
    } catch (err) {
      console.warn('[support/lookup] failed', err);
    }
  })();
  if (context.waitUntil) context.waitUntil(job);
  else void job;

  return data<LookupResult>({ok: true});
}

export function loader() {
  return new Response(null, {status: 404});
}
