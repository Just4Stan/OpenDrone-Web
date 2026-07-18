import {data, useLoaderData} from 'react-router';
import type {Route} from './+types/newsletter._index';
import {buildSeoMeta} from '~/lib/seo';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';
import {verifyTurnstile} from '~/lib/support/turnstile';
import {tagCustomerNotify} from '~/lib/shopify-admin';
import {signSurveyToken} from '~/lib/growth/survey-token';
import {signUnsubscribeToken} from '~/lib/growth/unsubscribe-token';
import {recordSignup} from '~/lib/growth/ledger';
import {upsertContact, sendWelcome} from '~/lib/growth/resend';
import {getLocaleFromRequest} from '~/lib/i18n';
import {
  ReleaseRow,
  type ReleaseRowArticle,
} from '~/components/release-notes/ReleaseRow';

// Newsletter — the single hub. It's all newsletter: posts written locally and
// published to the Shopify `news` blog show up here as the newsletter archive,
// at /newsletter (posts at /newsletter/<handle>). Old /blog, /releases, and
// /blogs URLs redirect in.
//
// GET  → renders the post archive (this is the newsletter).
// POST → enrols an email into Shopify's customer list with marketing consent
//        so posts can be emailed from Shopify admin (Marketing → Shopify Email)
//        to the "Subscribed" segment.
//
// The signup FORM lives in the site footer (present on every page), so this
// page intentionally has no in-body form — it would just duplicate the footer.
//
// Abuse controls on the action: honeypot + Cloudflare Turnstile + per-IP and
// per-email rate limits. Turnstile is soft — if TURNSTILE_SITE_KEY is unset
// (dev) the verifier no-ops; in production it fails closed.

const BLOG_HANDLE_FALLBACK = 'news';

export const meta: Route.MetaFunction = () => {
  const base = buildSeoMeta({
    title: 'Newsletter',
    description:
      'Engineering Essentials: build notes, hardware releases, and write-ups from OpenDrone. Subscribe to get each post by email.',
  });
  return [
    ...base,
    {
      tagName: 'link',
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'OpenDrone · Newsletter',
      href: '/newsletter.rss',
    },
  ];
};

export async function loader({context}: Route.LoaderArgs) {
  const blogHandle = context.env.NEWSLETTER_BLOG_HANDLE || BLOG_HANDLE_FALLBACK;

  const {blog} = await context.storefront.query(ARCHIVE_QUERY, {
    variables: {blogHandle, first: 100},
    cache: context.storefront.CacheLong(),
  });

  const all: ReleaseRowArticle[] = (blog?.articles?.nodes ?? []).map(
    (n: any) => ({
      id: n.id,
      handle: n.handle,
      title: n.title,
      publishedAt: n.publishedAt,
      excerpt: n.excerpt ?? null,
      tags: (n.tags ?? []).filter(Boolean),
      image: n.image ?? null,
    }),
  );

  // `no-archive` tag keeps a post out of the public list (rare).
  const visible = all.filter((a) => !a.tags.includes('no-archive'));

  // Group by year, descending — articles already reverse-chronological.
  const grouped = new Map<string, ReleaseRowArticle[]>();
  for (const a of visible) {
    const year = a.publishedAt.slice(0, 4);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(a);
  }

  return {groups: Array.from(grouped.entries())};
}

export default function NewsletterPage() {
  const {groups} = useLoaderData<typeof loader>();

  return (
    <div className="page-shell">
      <header className="rn-archive-head">
        <div>
          <p className="rn-eyebrow">
            <span>Newsletter · Engineering Essentials</span>
            <a href="/newsletter.rss" className="rn-rss" rel="alternate">
              ⌁ RSS · /newsletter.rss
            </a>
          </p>
          <h1>Build notes.</h1>
        </div>
      </header>

      {groups.length > 0 ? (
        <div>
          {groups.map(([year, articles]) => (
            <section key={year}>
              <div className="rn-year">
                <span className="rn-year-n">{year}</span>
                <span className="rn-year-rule" aria-hidden />
                <span className="rn-year-count">
                  {articles.length} post{articles.length === 1 ? '' : 's'}
                </span>
              </div>
              <ol className="rn-list">
                {articles.map((a) => (
                  <ReleaseRow key={a.id} article={a} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="rn-empty">
          <div className="rn-empty-icon" aria-hidden>
            ·
          </div>
          <h3>No posts yet.</h3>
          <p>First post coming soon. Subscribe below to get it in your inbox.</p>
        </div>
      )}
    </div>
  );
}

const ARCHIVE_QUERY = `#graphql
  query NewsletterArchive(
    $language: LanguageCode
    $blogHandle: String!
    $first: Int!
  ) @inContext(language: $language) {
    blog(handle: $blogHandle) {
      title
      handle
      articles(first: $first, sortKey: PUBLISHED_AT, reverse: true) {
        nodes {
          id
          handle
          title
          publishedAt
          excerpt
          tags
          image {
            id
            altText
            url
            width
            height
          }
        }
      }
    }
  }
` as const;

// --- Signup action ---------------------------------------------------------

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
  /**
   * Notify mode only: short-lived HMAC token (app/lib/growth/survey-token.ts)
   * that lets the success panel POST micro-survey answers to /api/survey
   * without a second Turnstile round. Absent in plain-newsletter mode.
   */
  surveyToken?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Optional `product` form field: a Shopify product handle from the
// coming-soon "Notify me at launch" signup. Strict slug shape — it becomes
// a customer tag (`notify-<handle>`), so nothing free-form gets through.
const PRODUCT_HANDLE_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Optional `channel` form field: client-side first-touch attribution
// (NewsletterSignup.tsx fills it from sessionStorage). Same strictness —
// it becomes a ledger dimension and a Resend contact property, so
// anything free-form collapses to 'direct'.
const CHANNEL_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

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
      {ok: false, message: 'Too many requests. Try again in a few minutes.'},
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
  const productRaw = String(formData.get('product') ?? '')
    .trim()
    .toLowerCase();
  const notifyProduct = PRODUCT_HANDLE_REGEX.test(productRaw)
    ? productRaw
    : null;
  const channelRaw = String(formData.get('channel') ?? '')
    .trim()
    .toLowerCase();
  const channel = CHANNEL_REGEX.test(channelRaw) ? channelRaw : 'direct';

  // Growth pipeline (Lane B), fired via waitUntil on every verified
  // successful signup path: (a) sig:<email> ledger record (merge-don't-
  // clobber), (b) Resend marketing contact upsert (+ notify-<handle>
  // segment), (c) welcome email on the FIRST signup for the address
  // only. Everything degrades to warn+no-op without its env keys and
  // must never block or fail the response.
  //
  // `freshCustomer` is the fallback first-signup signal when the ledger
  // is unconfigured: true only on a brand-new Shopify customerCreate,
  // so an "already subscribed" resubmit can't re-trigger the welcome.
  const scheduleGrowth = (freshCustomer: boolean) => {
    const env = context.env;
    const locale = getLocaleFromRequest(request);
    const consentAt = new Date().toISOString();
    const job = (async () => {
      const ledger = await recordSignup(env, {
        email,
        consentAt,
        product: notifyProduct,
        locale,
        channel,
      });
      await upsertContact(env, {
        email,
        locale,
        channel,
        product: notifyProduct ?? undefined,
      });
      const firstSignup = ledger ? ledger.created : freshCustomer;
      if (firstSignup) {
        // One-click opt-out link for the welcome footer; falls back to
        // the plain /newsletter/unsubscribe form when no secret is set.
        const unsubToken = await signUnsubscribeToken(env, email);
        await sendWelcome(env, {
          email,
          product: notifyProduct ?? undefined,
          unsubscribeUrl: unsubToken
            ? `https://opendrone.store/newsletter/unsubscribe?t=${encodeURIComponent(unsubToken)}`
            : null,
        });
      }
    })().catch((err) => console.warn('[newsletter] growth job failed', err));
    if (context.waitUntil) {
      context.waitUntil(job);
    }
  };

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

  // Verify Turnstile BEFORE the per-email rate-limit branch: that branch can
  // still tag a customer (tagCustomerNotify below), and a mutation must never
  // run on an unverified request — otherwise a bot hammering a known email
  // past the limit could tag arbitrary customers without ever solving a
  // challenge.
  const turnstile = await verifyTurnstile(context.env, turnstileToken, ip);
  if (!turnstile.ok) {
    return data<NewsletterResult>(
      {ok: false, message: 'Could not verify you are human. Refresh and try again.'},
      {status: 400},
    );
  }

  // Micro-survey gate (Lane C): notify signups get a short-lived token so
  // the success panel can submit the 2-question survey to /api/survey.
  // Minted only AFTER Turnstile verification — the token is the survey
  // endpoint's entire bot defence. Null when SESSION_SECRET is unset
  // (degrade-soft: the survey simply doesn't render).
  const surveyToken = notifyProduct
    ? await signSurveyToken(context.env, email)
    : null;

  const emailLimit = checkRateLimit(
    `newsletter:email:${email}`,
    3,
    24 * 60 * 60 * 1000,
  );
  if (!emailLimit.allowed) {
    // Rate-limited, but a notify-at-launch click still carries signal: the
    // tag is idempotent, so apply it before returning the generic success —
    // otherwise the 4th product someone asks about in a day is silently
    // dropped. (Token-gated: Turnstile already verified above.)
    if (notifyProduct) {
      await tagCustomerNotify(context.env, {
        email,
        productHandle: notifyProduct,
      });
      scheduleGrowth(false);
      return data<NewsletterResult>({
        ok: true,
        message: "You're on the list. We'll email you at launch.",
        alreadySubscribed: true,
        ...(surveyToken ? {surveyToken} : {}),
      });
    }
    // Be generic to avoid confirming which addresses have already signed up.
    return data<NewsletterResult>({
      ok: true,
      message: "You're already on the list.",
      alreadySubscribed: true,
    });
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
      // Existing Shopify customer, but possibly no ledger record yet
      // (signed up before the growth pipeline existed) — recording here
      // backfills the profile. freshCustomer=false: no ledger → no welcome.
      scheduleGrowth(false);
      // Existing subscriber asking to be notified about a SKU: still tag
      // them (lookup by email — customerCreate returned no id). Best-effort.
      if (notifyProduct) {
        await tagCustomerNotify(context.env, {
          email,
          productHandle: notifyProduct,
        });
        return data<NewsletterResult>({
          ok: true,
          message: "You're on the list. We'll email you at launch.",
          alreadySubscribed: true,
        });
      }
      return data<NewsletterResult>({
        ok: true,
        message: "You're already on the list.",
        alreadySubscribed: true,
      });
    }

    if (userErrors.length) {
      // Log only error codes — messages can reference internal fields
      // (password, etc.) or the subscriber email; keep those out of logs.
      const codes = userErrors
        .map((e: {code?: string | null}) => e.code ?? 'unknown')
        .join(',');
      console.error('[newsletter] customerUserErrors', codes);
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

    // Fresh signup — full growth pipeline including the welcome email
    // (unless the ledger says this address already signed up before).
    scheduleGrowth(true);

    // Per-product launch interest: tag the fresh customer so the SKU is
    // segmentable in Shopify admin. The Storefront customer gid is the same
    // gid the Admin API uses, so no lookup round-trip is needed here.
    if (notifyProduct) {
      await tagCustomerNotify(context.env, {
        customerId: payload?.customer?.id ?? null,
        email,
        productHandle: notifyProduct,
      });
      return data<NewsletterResult>({
        ok: true,
        message: "You're on the list. We'll email you at launch.",
        ...(surveyToken ? {surveyToken} : {}),
      });
    }

    return data<NewsletterResult>({
      ok: true,
      message: 'Subscribed. The next post goes to your inbox.',
    });
  } catch (err) {
    console.error('[newsletter] customerCreate failed', err);
    return data<NewsletterResult>(
      {ok: false, message: 'Signup temporarily unavailable. Try again later.'},
      {status: 502},
    );
  }
}
