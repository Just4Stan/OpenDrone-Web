/**
 * Transactional email for the support bridge — sent via Resend.
 *
 * Two senders:
 *  - sendResumeLink:    one ticket → one resume URL. Fired on ticket creation.
 *  - sendTicketIndex:   list of resume URLs for a given email. Fired by the
 *                       lookup endpoint when a returning user wants every
 *                       ticket they've ever opened from this address.
 *
 * If RESEND_API_KEY is unset (local dev or staging without the secret) the
 * functions log and no-op so the rest of the system still works end-to-end
 * with the cookie path. The bridge is designed to degrade gracefully.
 */

const RESEND_API = 'https://api.resend.com/emails';

type Env = {
  RESEND_API_KEY?: string;
  SUPPORT_FROM_EMAIL?: string;
  PUBLIC_COMPANY_NAME?: string;
};

type SendOpts = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

async function send(env: Env, opts: SendOpts): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn('[support/email] RESEND_API_KEY not set — would have sent', {
      to: redactEmail(opts.to),
      subject: opts.subject,
    });
    return false;
  }
  const from = env.SUPPORT_FROM_EMAIL || 'support@opendrone.be';
  const fromDisplay = env.PUBLIC_COMPANY_NAME
    ? `${env.PUBLIC_COMPANY_NAME} Support <${from}>`
    : `OpenDrone Support <${from}>`;

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        from: fromDisplay,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        reply_to: opts.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[support/email] resend', res.status, body.slice(0, 240));
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[support/email] send failed', err);
    return false;
  }
}

export async function sendResumeLink(
  env: Env,
  opts: {to: string; name: string; subject: string; resumeUrl: string},
): Promise<boolean> {
  const text = [
    `Hi ${opts.name || 'there'},`,
    '',
    `Thanks for opening a support ticket with us. Save this email — the link below restores your chat from any device, even if you clear cookies or switch browsers.`,
    '',
    `Your ticket: ${opts.subject}`,
    `Resume: ${opts.resumeUrl}`,
    '',
    `If you didn't open this ticket, just ignore this message — the link only works if you actually started the chat.`,
    '',
    `— OpenDrone`,
  ].join('\n');

  const html = renderEmail({
    heading: 'Your support ticket',
    body: `
      <p>Hi ${escapeHtml(opts.name || 'there')},</p>
      <p>Thanks for opening a support ticket with us. Save this email — the link below restores your chat from any device, even if you clear cookies or switch browsers.</p>
      <p style="margin-top:24px">
        <strong>${escapeHtml(opts.subject)}</strong>
      </p>
      <p style="margin:16px 0 32px">
        <a href="${escapeAttr(opts.resumeUrl)}" style="display:inline-block;background:#b8922e;color:#0a0a0a;text-decoration:none;font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;padding:12px 18px;border-radius:2px">Resume chat →</a>
      </p>
      <p style="color:#737373;font-size:13px;line-height:1.6">If you didn't open this ticket, just ignore this message — the link only works if you actually started the chat.</p>
    `,
  });

  return send(env, {
    to: opts.to,
    subject: `Your support ticket: ${opts.subject}`,
    text,
    html,
  });
}

export async function sendTicketIndex(
  env: Env,
  opts: {
    to: string;
    tickets: Array<{subject: string; openedAt: string; resumeUrl: string}>;
  },
): Promise<boolean> {
  if (!opts.tickets.length) return false;
  const lines = opts.tickets.map(
    (t) => `• ${t.subject} (opened ${t.openedAt})\n  ${t.resumeUrl}`,
  );
  const text = [
    `Hi,`,
    '',
    `Here are the support tickets you've opened with us. Click any link to resume the chat from this device.`,
    '',
    ...lines,
    '',
    `Each link is one-way — only the chat it points to gets restored.`,
    '',
    `— OpenDrone`,
  ].join('\n');

  const htmlList = opts.tickets
    .map(
      (t) =>
        `<li style="margin:12px 0">
          <div style="font-weight:600">${escapeHtml(t.subject)}</div>
          <div style="color:#737373;font-size:13px;margin:2px 0 6px">opened ${escapeHtml(t.openedAt)}</div>
          <a href="${escapeAttr(t.resumeUrl)}" style="color:#b8922e;text-decoration:underline;font-family:'JetBrains Mono',monospace;font-size:12px">Resume chat →</a>
        </li>`,
    )
    .join('');
  const html = renderEmail({
    heading: 'Your OpenDrone support tickets',
    body: `
      <p>Here are the support tickets you've opened with us. Click any link to resume the chat from this device.</p>
      <ul style="list-style:none;padding:0;margin:24px 0">${htmlList}</ul>
      <p style="color:#737373;font-size:13px;line-height:1.6">Each link is one-way — only the chat it points to gets restored.</p>
    `,
  });
  return send(env, {
    to: opts.to,
    subject: `Your OpenDrone support tickets`,
    text,
    html,
  });
}

function renderEmail({heading, body}: {heading: string; body: string}): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;color:#e5e5e5;font-family:Helvetica,Arial,sans-serif;line-height:1.55">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141417;border:1px solid #1a241a;border-radius:3px">
        <tr><td style="padding:28px 28px 0">
          <p style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#b8922e;margin:0 0 6px">OpenDrone</p>
          <h1 style="font-family:Helvetica,Arial,sans-serif;font-size:22px;letter-spacing:-0.01em;margin:0;color:#e5e5e5">${escapeHtml(heading)}</h1>
        </td></tr>
        <tr><td style="padding:18px 28px 28px;color:#e5e5e5;font-size:15px">${body}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function redactEmail(s: string): string {
  const at = s.indexOf('@');
  if (at < 1) return '***';
  return `${s[0]}***@${s.slice(at + 1)}`;
}
