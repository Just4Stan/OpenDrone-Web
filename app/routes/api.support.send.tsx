import {data} from 'react-router';
import type {Route} from './+types/api.support.send';
import {postToThread} from '~/lib/support/discord';
import {readSupportCookie, verifyTicket} from '~/lib/support/session';
import {extractAttachments} from '~/lib/support/uploads';
import {checkRateLimit} from '~/lib/rate-limit';

type SendResult =
  | {
      ok: true;
      id: string;
      attachments: Array<{url: string; filename: string}>;
    }
  | {
      ok: false;
      message: string;
      code?: 'no-ticket' | 'too-long' | 'files' | 'rate-limited';
    };

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<SendResult>({ok: false, message: 'Method not allowed.'}, {status: 405});
  }
  const env = context.env;
  const cookie = readSupportCookie(request);
  const ticket = await verifyTicket(env, cookie);
  if (!ticket) {
    return data<SendResult>(
      {ok: false, message: 'No active ticket.', code: 'no-ticket'},
      {status: 401},
    );
  }

  // Per-ticket flood cap: at most 10 messages per minute. Genuine users
  // type far slower; this only bites automation scripted against a
  // captured cookie.
  const limit = checkRateLimit(`support-send:${ticket.uid}`, 10, 60 * 1000);
  if (!limit.allowed) {
    return data<SendResult>(
      {
        ok: false,
        message: 'Slow down — wait a moment before sending again.',
        code: 'rate-limited',
      },
      {
        status: 429,
        headers: {'Retry-After': String(limit.resetInSeconds)},
      },
    );
  }

  const form = await request.formData();
  const content = String(form.get('content') ?? '').trim();
  const attachments = await extractAttachments(form);
  if (!attachments.ok) {
    return data<SendResult>(
      {ok: false, message: attachments.message, code: 'files'},
      {status: 400},
    );
  }
  if (!content && !attachments.files.length) {
    return data<SendResult>({ok: false, message: 'Empty message.'}, {status: 400});
  }
  if (content.length > 1800) {
    return data<SendResult>(
      {ok: false, message: 'Message too long (max 1800 chars).', code: 'too-long'},
      {status: 400},
    );
  }

  const prefix = `**${ticket.name}:**`;
  const body = content ? `${prefix} ${content}` : prefix;
  const posted = await postToThread(env, ticket.tid, body, attachments.files);
  if (!posted) {
    return data<SendResult>(
      {ok: false, message: 'Message did not reach support. Try again.'},
      {status: 502},
    );
  }
  return data<SendResult>({
    ok: true,
    id: posted.id,
    attachments: posted.attachments.map((a) => ({
      url: a.url,
      filename: a.filename,
    })),
  });
}

export function loader() {
  return new Response(null, {status: 404});
}
