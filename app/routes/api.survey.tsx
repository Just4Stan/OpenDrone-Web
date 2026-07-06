import {data} from 'react-router';
import type {Route} from './+types/api.survey';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';
import {verifySurveyToken} from '~/lib/growth/survey-token';
import {
  EU_PREMIUM_ANSWERS,
  recordSurveyAnswers,
  type EuPremiumAnswer,
} from '~/lib/growth/ledger';

/**
 * Notify micro-survey intake (Lane C). POST-only; the loader 404s like
 * the other api.* routes.
 *
 * Auth model: NO Turnstile here — the only way to obtain a valid
 * `token` is a fully verified notify signup (consent + Turnstile +
 * rate limits in the newsletter action), which returns a 15-minute
 * HMAC token bound to the signed-up email (app/lib/growth/survey-token.ts).
 * The answers are merged into that email's `sig:<email>` ledger record;
 * the client can never pick the target address.
 *
 * This is RESEARCH ONLY — answers carry no pre-order/reserve semantics,
 * no quantities, no purchase commitment (decision #2, 2026-07-06).
 *
 * GDPR: opinions tied to an email; stored IP-free in the ledger and
 * erased by the same RtbF DEL as the signup record (see ledger.ts docs).
 * The per-IP rate limit below is in-memory only — nothing about the IP
 * is persisted.
 */

type SurveyResult = {ok: boolean; message?: string};

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<SurveyResult>(
      {ok: false, message: 'Method not allowed.'},
      {status: 405},
    );
  }

  const ip = clientIp(request);
  // Two questions per signup — 10/10min per IP is generous for humans
  // (several signups behind one NAT) and stingy for scripts.
  const ipLimit = checkRateLimit(`survey:ip:${ip}`, 10, 10 * 60 * 1000);
  if (!ipLimit.allowed) {
    return data<SurveyResult>(
      {ok: false, message: 'Too many requests.'},
      {
        status: 429,
        headers: {'Retry-After': String(ipLimit.resetInSeconds)},
      },
    );
  }

  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const euPremiumRaw = form.get('euPremium');
  const interviewRaw = form.get('interviewOptIn');

  const verified = await verifySurveyToken(context.env, token);
  if (!verified) {
    return data<SurveyResult>(
      {ok: false, message: 'Survey link expired. Answers not saved.'},
      {status: 401},
    );
  }

  const euPremium =
    typeof euPremiumRaw === 'string' &&
    (EU_PREMIUM_ANSWERS as readonly string[]).includes(euPremiumRaw)
      ? (euPremiumRaw as EuPremiumAnswer)
      : undefined;
  const interviewOptIn =
    interviewRaw === 'true' ? true : interviewRaw === 'false' ? false : undefined;

  if (euPremium === undefined && interviewOptIn === undefined) {
    return data<SurveyResult>(
      {ok: false, message: 'No valid answer submitted.'},
      {status: 400},
    );
  }

  await recordSurveyAnswers(context.env, {
    email: verified.email,
    euPremium,
    interviewOptIn,
  });

  // Plausible events are fired client-side (aggregate, cookieless) —
  // nothing analytics-shaped happens on the server on purpose.
  return data<SurveyResult>({ok: true});
}

export function loader() {
  return new Response(null, {status: 404});
}
