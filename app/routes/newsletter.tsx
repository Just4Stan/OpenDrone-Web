import {data} from 'react-router';
import type {Route} from './+types/newsletter';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';
import {verifyTurnstile} from '~/lib/support/turnstile';

// Engineering Essentials — newsletter signup handler.
//
// Writes subscribers into Shopify's customer list with marketing consent so
// Stan can compose product-release emails from Shopify admin (Marketing →
// Shopify Email) and target the "Subscribed" customer segment. No custom
// email sender, no third-party ESP.
//
// Implementation: Storefront API `customerCreate` mutation. Uses the same
// `PRIVATE_STOREFRONT_API_TOKEN` the rest of the Hydrogen app already uses,
// so there's no new credential to provision. The customer record gets a
// randomly-generated password they never use (no account-login flow on the
// site), `acceptsMarketing: true`, and a `newsletter` tag.
//
// Abuse controls: honeypot + Turnstile + per-IP + per-email rate limits.
// Turnstile is soft — if TURNSTILE_SITE_KEY is unset (dev) the verifier
// no-ops; in production the site key is required and the verifier fails
// closed.
//
// Note: Shopify has marked the Storefront API customer mutations deprecated
// in favour of the Customer Account API, but no sunset date is published.
// When deprecation bites, swap to a dedicated ESP (Klaviyo, Beehiiv) — at
// that volume the migration is worth it anyway.

const CUSTOMER_CREATE_MUTATION = `#graphql
  mutation NewsletterCustomerCreate($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
      }
      customerUserErrors {
        field
        message
        code
      }
    }
  }
` as const;

type NewsletterResult = {
  ok: boolean;
  message: string;
  alreadySubscribed?: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateOpaquePassword(): string {
  // Shopify requires >=5 chars and caps at 40. The subscriber never uses
  // this — there is no /account login exposed for newsletter-only signups.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `Nl!${hex}`; // 3 + 32 = 35 chars, under the 40 limit
}

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<NewsletterResult>(
      {ok: false, message: 'Method not allowed.'},
      {status: 405},
    );
  }

  const ip = clientIp(request);
  const ipLimit = checkRateLimit(`newsletter:ip:${ip}`, 5, 10 * 60 * 1000);
  if (!ipLimit.allowed) {
    return data<NewsletterResult>(
      {ok: false, message: 'Too many requests — try again in a few minutes.'},
      {
        status: 429,
        headers: {'Retry-After': String(ipLimit.resetInSeconds)},
      },
    );
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const consent = formData.get('consent') === 'on';
  const honeypot = String(formData.get('website') ?? '');
  const turnstileToken = String(formData.get('cf-turnstile-response') ?? '');

  if (honeypot) {
    return data<NewsletterResult>({ok: true, message: 'Thanks.'});
  }

  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    return data<NewsletterResult>(
      {ok: false, message: 'Enter a valid email address.'},
      {status: 400},
    );
  }

  if (!consent) {
    return data<NewsletterResult>(
      {ok: false, message: 'Please confirm you want to receive updates.'},
      {status: 400},
    );
  }

  const emailLimit = checkRateLimit(
    `newsletter:email:${email}`,
    3,
    24 * 60 * 60 * 1000,
  );
  if (!emailLimit.allowed) {
    // Be generic to avoid confirming which addresses have already signed up.
    return data<NewsletterResult>({
      ok: true,
      message: "You're already on the list.",
      alreadySubscribed: true,
    });
  }

  const turnstile = await verifyTurnstile(context.env, turnstileToken, ip);
  if (!turnstile.ok) {
    return data<NewsletterResult>(
      {ok: false, message: 'Could not verify you are human. Refresh and try again.'},
      {status: 400},
    );
  }

  try {
    const result = await context.storefront.mutate(CUSTOMER_CREATE_MUTATION, {
      variables: {
        input: {
          email,
          password: generateOpaquePassword(),
          acceptsMarketing: true,
        },
      },
    });

    const payload = result?.customerCreate;
    const userErrors = payload?.customerUserErrors ?? [];

    const taken = userErrors.find(
      (e: {code?: string | null; message: string}) =>
        e.code === 'TAKEN' ||
        e.code === 'CUSTOMER_DISABLED' ||
        /taken|already/i.test(e.message),
    );
    if (taken) {
      return data<NewsletterResult>({
        ok: true,
        message: "You're already on the list.",
        alreadySubscribed: true,
      });
    }

    if (userErrors.length) {
      // Shopify user-error messages can reference the internal fields we
      // use (password, etc.) that aren't visible in the UI. Log the raw
      // errors for debugging, surface a clean message to the subscriber.
      console.error('[newsletter] customerUserErrors', userErrors);
      const firstError = userErrors[0];
      const field = firstError.field?.join('.') ?? '';
      const userFacing = /email/i.test(field)
        ? 'That email address was rejected. Double-check it and try again.'
        : "Couldn't subscribe right now. Try again in a moment.";
      return data<NewsletterResult>(
        {ok: false, message: userFacing},
        {status: 400},
      );
    }

    return data<NewsletterResult>({
      ok: true,
      message: "You're in. Welcome aboard.",
    });
  } catch (err) {
    console.error('[newsletter] customerCreate failed', err);
    return data<NewsletterResult>(
      {ok: false, message: 'Signup temporarily unavailable. Try again later.'},
      {status: 502},
    );
  }
}

export function loader() {
  return new Response(null, {status: 404});
}
