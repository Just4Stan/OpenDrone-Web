import {data} from 'react-router';
import type {Route} from './+types/api.support.start';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {
  createSupportThread,
  firstNameOnly,
  postStaffMetadata,
  postToThread,
} from '~/lib/support/discord';
import {sendResumeLink} from '~/lib/support/email';
import {
  buildResumeUrl,
  signResumeToken,
} from '~/lib/support/resume-token';
import {
  buildSupportSetCookie,
  randomId,
  randomTicketId,
  signTicket,
  type SupportTicket,
} from '~/lib/support/session';
import {verifyTurnstile} from '~/lib/support/turnstile';
import {extractAttachments} from '~/lib/support/uploads';
import {checkRateLimit, clientIp} from '~/lib/rate-limit';
import {scrubForDiscord} from '~/lib/support/scrubber';
import {
  aiDraftsEnabled,
  formatDraftForDiscord,
  generateDraft,
} from '~/lib/support/ai-draft';
import {addTicket} from '~/lib/support/ticket-index';

type StartResult =
  | {ok: true; ticketId: string; pid?: string}
  | {
      ok: false;
      message: string;
      field?: 'message' | 'turnstile' | 'files';
      code?: 'signin-required';
    };

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<StartResult>({ok: false, message: 'Method not allowed.'}, {status: 405});
  }

  const ip = clientIp(request);
  const ipLimit = checkRateLimit(`support-start:ip:${ip}`, 3, 60 * 60 * 1000);
  if (!ipLimit.allowed) {
    return data<StartResult>(
      {
        ok: false,
        message:
          'Too many tickets from this network — try again in a bit, or join us on Discord.',
      },
      {
        status: 429,
        headers: {'Retry-After': String(ipLimit.resetInSeconds)},
      },
    );
  }

  // Opening a ticket requires a Shopify customer account session. Name +
  // email come from the authenticated customer record, not the form —
  // that way we always post to Discord with a verified identity and a
  // customerId staff can click back to the order history. The old anon
  // flow let random visitors trickle in; gating here keeps the forum
  // channel signal-heavy.
  const env = context.env;
  let customer: {id: string; name: string; email: string} | null = null;
  try {
    const {data: prefill} = await context.customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    const c = prefill?.customer;
    const emailAddr = c?.emailAddress?.emailAddress;
    if (c?.id && emailAddr) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
      customer = {
        id: c.id,
        name: name || emailAddr.split('@')[0],
        email: emailAddr.toLowerCase(),
      };
    }
  } catch {
    // not signed in / scope missing — fall through to 401 below
  }
  if (!customer) {
    return data<StartResult>(
      {
        ok: false,
        message: 'Sign in to open a support ticket.',
        code: 'signin-required',
      },
      {status: 401},
    );
  }

  const form = await request.formData();
  const message = String(form.get('message') ?? '').trim();
  const turnstileToken = String(form.get('cf-turnstile-response') ?? '');
  const subject = String(form.get('subject') ?? '').trim().slice(0, 256);
  const product = String(form.get('product') ?? '').trim().slice(0, 80);
  const firmware = String(form.get('firmware') ?? '').trim().slice(0, 80);
  const honeypot = String(form.get('website') ?? '');

  if (honeypot) {
    return data<StartResult>({ok: true, ticketId: 'drop'});
  }
  if (!subject || subject.length < 4) {
    return data<StartResult>(
      {
        ok: false,
        message: 'Add a short subject so we can find your ticket later.',
        field: 'message',
      },
      {status: 400},
    );
  }
  if (!message || message.length < 5 || message.length > 4000) {
    return data<StartResult>(
      {
        ok: false,
        message: 'Tell us a bit more (5–4000 chars).',
        field: 'message',
      },
      {status: 400},
    );
  }

  // Inbound scrub: strip credentials / cards / bidi overrides from the
  // user's message BEFORE it ever hits Discord. Narrower than the
  // outbound scrubber — users legitimately share their own email,
  // phone, order number, etc. when asking for help, so those pass
  // through. Only secrets / cards / control chars get replaced.
  const cleanMessage = scrubForDiscord(message);
  if (cleanMessage.blocked) {
    console.warn(
      '[support] inbound scrub blocked start message',
      cleanMessage.reasons.join(','),
    );
    return data<StartResult>(
      {
        ok: false,
        message:
          'Your message was rejected by our safety filter. Try rephrasing without any credentials, tokens, or card numbers.',
        field: 'message',
      },
      {status: 400},
    );
  }
  const cleanSubject = scrubForDiscord(subject).content;
  const cleanProduct = scrubForDiscord(product).content;
  const cleanFirmware = scrubForDiscord(firmware).content;
  // Prepend a metadata line into the customer's first message body so
  // staff see Product / Firmware up front in the Discord thread without
  // adding new fields to the cookie or wire schema.
  const metaLine = [
    cleanProduct ? `Product: ${cleanProduct}` : null,
    cleanFirmware ? `Firmware: ${cleanFirmware}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const messageWithMeta = metaLine
    ? `${metaLine}\n\n${cleanMessage.content}`
    : cleanMessage.content;

  const ua = request.headers.get('User-Agent') ?? undefined;

  const turnstile = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstile.ok) {
    return data<StartResult>(
      {
        ok: false,
        message: 'Could not verify you are human. Refresh and try again.',
        field: 'turnstile',
      },
      {status: 400},
    );
  }

  const attachments = await extractAttachments(form);
  if (!attachments.ok) {
    return data<StartResult>(
      {ok: false, message: attachments.message, field: 'files'},
      {status: 400},
    );
  }

  const {id: verifiedCustomerId, name, email} = customer;

  try {
    // When a private staff-metadata channel is configured, the public
    // forum thread (which any helper can read) gets a first-name-only
    // title and a redacted body. Email / Shopify GID / UA / IP go to
    // the staff channel below. Same toggle on both sides so they stay
    // consistent. The `redact` flag mirrors what createSupportThread
    // looks at internally — keeps the title and body in sync.
    const redact = !!env.DISCORD_STAFF_METADATA_CHANNEL_ID;
    const titleName = redact ? firstNameOnly(name) : name;
    // Public 10-digit reference. Goes into the thread title, the staff
    // metadata post, the cookie, and the widget header so customer +
    // staff can reference the ticket without mentioning the Discord
    // thread id.
    const pid = randomTicketId();
    const subjectFragment = cleanSubject
      ? cleanSubject
      : `${cleanMessage.content.slice(0, 50)}${
          cleanMessage.content.length > 50 ? '…' : ''
        }`;
    const thread = await createSupportThread(env, {
      title: `#${pid} [${titleName}] ${subjectFragment}`,
      userName: name,
      userEmail: email,
      firstMessage: messageWithMeta,
      userAgent: ua,
      ipHint: ip && ip !== 'unknown' ? anonymizeIp(ip) : undefined,
      files: attachments.files,
      customerId: verifiedCustomerId,
      pid,
    });

    // Staff metadata: full PII + jump-URL go to the role-restricted
    // channel only. No-op when DISCORD_STAFF_METADATA_CHANNEL_ID is
    // unset (legacy mode keeps the metadata in the public thread).
    // Fire-and-forget so a Discord hiccup here doesn't block the
    // ticket creation API response.
    if (redact) {
      const metaJob = (async () => {
        try {
          await postStaffMetadata(env, thread.id, thread.name, {
            userName: name,
            userEmail: email,
            customerId: verifiedCustomerId,
            userAgent: ua,
            ipHint: ip && ip !== 'unknown' ? anonymizeIp(ip) : undefined,
            pid,
          });
        } catch (err) {
          console.warn('[support/start] staff-metadata post failed', err);
        }
      })();
      if (context.waitUntil) context.waitUntil(metaJob);
      else void metaJob;
    }

    const ticket: SupportTicket = {
      v: 1,
      tid: thread.id,
      uid: randomId(),
      pid,
      name: name.slice(0, 80),
      email,
      createdAt: Math.floor(Date.now() / 1000),
    };
    const cookie = await signTicket(env, ticket);

    // Write ticket meta + per-customer/email index. Fire-and-forget so
    // a slow store write doesn't tail the API response. No-op when the
    // Upstash store is unbound.
    const indexJob = addTicket(env, {
      tid: thread.id,
      pid,
      subject: cleanSubject || cleanMessage.content.slice(0, 80),
      openedAt: ticket.createdAt,
      closedAt: null,
      lastActivityAt: ticket.createdAt,
      status: 'open',
      customerId: verifiedCustomerId,
      email,
      name: ticket.name,
      product: cleanProduct || undefined,
      firmware: cleanFirmware || undefined,
    }).catch((err) =>
      console.warn('[support/start] ticket-index write failed', err),
    );
    if (context.waitUntil) context.waitUntil(indexJob);
    else void indexJob;

    // Magic-link resume — fire-and-forget so the API response isn't blocked
    // by Resend latency. The email contains a link that survives cookie
    // wipes / device changes.
    const ticketSubject = cleanSubject || cleanMessage.content.slice(0, 60);
    const emailJob = (async () => {
      try {
        const token = await signResumeToken(env, {
          tid: thread.id,
          uid: ticket.uid,
          email,
          name: ticket.name,
          pid,
        });
        const baseUrl = new URL(request.url).origin;
        const resumeUrl = buildResumeUrl(baseUrl, token);
        await sendResumeLink(env, {
          to: email,
          name,
          subject: ticketSubject,
          resumeUrl,
        });
      } catch (err) {
        console.warn('[support/start] resume-email failed', err);
      }
    })();
    if (context.waitUntil) context.waitUntil(emailJob);
    else void emailJob;

    // Stage 4: AI first-responder. Best-effort and deferred — we don't
    // want a slow Anthropic call to block the API response. The draft
    // lands in the Discord thread only; the moderation gate (Stage 2)
    // decides whether it ever surfaces to the customer.
    if (aiDraftsEnabled(env)) {
      const aiJob = (async () => {
        try {
          const draft = await generateDraft(env, {
            subject: cleanSubject,
            message: cleanMessage.content,
            customerFirstName: name.split(/\s+/)[0] ?? name,
          });
          if (draft.ok) {
            await postToThread(
              env,
              thread.id,
              formatDraftForDiscord(draft.text),
            );
          } else {
            console.warn('[support/start] ai-draft skipped', draft.reason);
          }
        } catch (err) {
          console.warn(
            '[support/start] ai-draft crashed',
            err instanceof Error ? err.name : 'unknown',
          );
        }
      })();
      if (context.waitUntil) context.waitUntil(aiJob);
      else void aiJob;
    }

    return data<StartResult>(
      {ok: true, ticketId: ticket.uid, pid},
      {
        status: 200,
        headers: {'Set-Cookie': buildSupportSetCookie(cookie)},
      },
    );
  } catch (err) {
    console.error('[support/start] failed', err);
    return data<StartResult>(
      {
        ok: false,
        message:
          'Could not reach support right now. Try again in a moment or join us on Discord.',
      },
      {status: 502},
    );
  }
}

export function loader() {
  return new Response(null, {status: 404});
}

// IPv4: drop last octet. IPv6: drop last 80 bits. Keeps enough signal for
// abuse triage without storing a full address in the forum post.
function anonymizeIp(ip: string): string {
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return parts.slice(0, 3).join(':') + '::/48';
  }
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  return 'unknown';
}

