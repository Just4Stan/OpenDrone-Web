import {data} from 'react-router';
import type {Route} from './+types/api.support.poll';
import {fetchThreadMessages, postToThread} from '~/lib/support/discord';
import {
  buildSupportSetCookie,
  readSupportCookie,
  signTicket,
  verifyTicket,
} from '~/lib/support/session';
import {sendReplyNotification} from '~/lib/support/email';
import {buildResumeUrl, signResumeToken} from '~/lib/support/resume-token';
import {checkRateLimit} from '~/lib/rate-limit';
import {
  extractFirstName,
  scrubForPublic,
  type PublicMessage,
} from '~/lib/support/scrubber';
import {filterByApproval} from '~/lib/support/moderation';
import {
  AI_DRAFT_PREFIX,
  AI_SUMMARY_PREFIX,
  aiDraftsEnabled,
  formatSummaryForDiscord,
  generateSummary,
  parseSummaryCursor,
} from '~/lib/support/ai-draft';

// Trust boundary between Discord and the customer's browser.
//
// Every Discord message passes through scrubForPublic() before it lands
// in the response. The browser only sees:
//   - a first name (safe because Discord display names are public),
//   - a role flag (helper | ai),
//   - scrubbed content,
//   - attachments already filtered at upload time.
//
// Everything else in the raw Discord payload (author.id, avatar hash,
// discriminator, global_name, guild_id, roles, embeds, components, …)
// is dropped here and never reaches JSON.stringify.

type PollResult =
  | {ok: true; messages: PublicMessage[]; closed: boolean}
  | {ok: false; message: string; code?: 'no-ticket' | 'thread-gone'};

// Stage 5 summariser threshold: once a thread has grown by this many
// non-bot messages past the last summary cursor, kick off a new recap.
// Tunable — 8 felt right in dry runs: short enough to keep the recap
// timely, long enough that we're not firing the AI on trivial 2-reply
// threads.
const SUMMARY_THRESHOLD_NEW_MESSAGES = 8;

export async function loader({request, context}: Route.LoaderArgs) {
  const env = context.env;
  const cookie = readSupportCookie(request);
  const ticket = await verifyTicket(env, cookie);

  if (!ticket) {
    return data<PollResult>(
      {ok: false, message: 'No active ticket.', code: 'no-ticket'},
      {status: 401},
    );
  }

  // Per-ticket poll cap. Widget polls every 4s active / 15s hidden, so
  // 30/min leaves a large margin; anything more is automation.
  const limit = checkRateLimit(`support-poll:${ticket.uid}`, 30, 60 * 1000);
  if (!limit.allowed) {
    return data<PollResult>(
      {ok: false, message: 'Polling too fast.'},
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.resetInSeconds),
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const url = new URL(request.url);
  // `?initial=1` ignores the cookie cursor so a returning/refreshed user
  // gets the recent thread history instead of just messages newer than
  // whatever the previous session last delivered.
  //
  // We intentionally do NOT honour an `?after=` query param: the cookie
  // cursor is the only authoritative forward-only position. Accepting a
  // client-supplied cursor would let a ticket holder rewind to re-read
  // older messages (e.g. contents they hoped were ephemeral) and replay
  // staff replies, so the cursor stays server-side.
  const initial = url.searchParams.get('initial') === '1';
  const after = initial ? undefined : ticket.lastCursor || undefined;

  const {messages, thread} = await fetchThreadMessages(env, ticket.tid, {
    afterId: after,
    limit: 50,
  });

  if (!thread) {
    return data<PollResult>(
      {ok: false, message: 'Ticket thread not found.', code: 'thread-gone'},
      {status: 410},
    );
  }

  // Moderation gate (Stage 2). Filter to approved messages before we
  // project into the public shape. Dropped messages are logged (reason
  // only, never content) so staff can watch the gate when tuning it.
  //
  // Bot authorship rules:
  //   - Bot messages that start with AI_DRAFT_PREFIX (Stage 4) or
  //     AI_SUMMARY_PREFIX (Stage 5) are eligible to surface, pending ✅.
  //   - Bot messages that start with `**<Name>:**` are customer-relayed
  //     messages from /api/support/send. Project as role:'self' so the
  //     customer sees their own history on refresh — without these the
  //     log appears empty until staff replies.
  //   - Every other bot message is the thread-starter or a system
  //     message and must not surface.
  const candidates = messages.filter(
    (m) =>
      !m.author.bot ||
      m.content.startsWith(AI_DRAFT_PREFIX) ||
      m.content.startsWith(AI_SUMMARY_PREFIX) ||
      isSelfRelayedMessage(m.content),
  );
  const filtered = await filterByApproval(env, candidates, ticket.tid);
  if (filtered.dropped.length > 0) {
    console.warn(
      '[support] moderation',
      filtered.mode,
      'dropped',
      filtered.dropped.length,
      filtered.dropped.map((d) => `${d.message.id}:${d.reason}`).join(','),
    );
  }

  // Project each raw Discord message into the public shape. A projection
  // that returns null (blocked by the scrubber, or empty after redaction)
  // is dropped from the response but still advances the cursor — otherwise
  // a single always-blocked message would loop forever.
  const projected: PublicMessage[] = [];
  for (const m of filtered.approved) {
    const isAiDraft =
      m.author.bot && m.content.startsWith(AI_DRAFT_PREFIX);
    const isAiSummary =
      m.author.bot && m.content.startsWith(AI_SUMMARY_PREFIX);
    const isSelfRelayed =
      m.author.bot && !isAiDraft && !isAiSummary && isSelfRelayedMessage(m.content);
    if (m.author.bot && !isAiDraft && !isAiSummary && !isSelfRelayed) continue;
    // Strip the bot marker from content before scrubbing/projecting —
    // the `role` field replaces the inline prefix in the widget.
    let rawContent = m.content;
    let projectedFirstName = extractFirstName([
      m.author.globalName,
      m.author.username,
    ]);
    if (isAiDraft) rawContent = m.content.slice(AI_DRAFT_PREFIX.length).trim();
    else if (isAiSummary) {
      // Summary header looks like `🤖 **Recap so far up to msg_id=X:**\n<body>`.
      // Drop the first line entirely — the customer doesn't care about
      // the internal cursor.
      const nl = m.content.indexOf('\n');
      rawContent = nl >= 0 ? m.content.slice(nl + 1).trim() : '';
    } else if (isSelfRelayed) {
      const stripped = stripSelfPrefix(m.content);
      rawContent = stripped.body;
      projectedFirstName = stripped.firstName || ticket.name;
    }
    const scrubbed = scrubForPublic(rawContent);
    if (scrubbed.blocked) {
      // Log the redaction reasons at warn level so staff can see the
      // Stage-2 moderation UI (once built) surface "this draft was
      // blocked by the scrubber" cleanly. Never log the raw content.
      console.warn(
        '[support] scrubber blocked message',
        m.id,
        scrubbed.reasons.join(','),
      );
      continue;
    }
    if (!scrubbed.content && !m.attachments.length) continue;
    projected.push({
      id: m.id,
      role: isAiDraft || isAiSummary ? 'ai' : isSelfRelayed ? 'self' : 'helper',
      firstName:
        isAiDraft || isAiSummary ? 'OpenDrone' : projectedFirstName,
      content: scrubbed.content,
      createdAt: m.createdAt,
      attachments: m.attachments.map((a) => ({
        url: a.url,
        filename: a.filename,
      })),
    });
  }

  const newestId = messages.length ? messages[messages.length - 1].id : null;

  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
  };

  // Reply notification email. Fires only when staff has explicitly
  // marked a message as the final/conclusive answer by reacting with
  // SUPPORT_EMAIL_EMOJI (default 📧). This avoids spamming the
  // customer's inbox on every back-and-forth — the live web widget
  // surfaces every message regardless. The 5-min debounce is a
  // belt-and-braces guard against double-sends if the same message
  // gets toggled on/off, or if multiple tabs poll at once.
  const REPLY_EMAIL_DEBOUNCE_S = 5 * 60;
  const EMAIL_EMOJI = env.SUPPORT_EMAIL_EMOJI?.trim() || '📧';
  const nowSec = Math.floor(Date.now() / 1000);
  // The new-helper match works against the raw filtered set rather
  // than the projected one because we need the original `reactions`
  // array, which the public scrubber strips.
  const flaggedHelper = filtered.approved.find(
    (m) =>
      !m.author.bot &&
      m.reactions.some(
        (r) => r.emoji === EMAIL_EMOJI && r.count > (r.me ? 1 : 0),
      ),
  );
  // Match the flagged Discord message back to its public projection so
  // the email contains the scrubbed body, not the raw Discord content.
  const newHelper = flaggedHelper
    ? projected.find((p) => p.id === flaggedHelper.id) ?? null
    : null;
  let cookieReplyEmailAt = ticket.lastReplyEmailAt ?? 0;
  if (
    newHelper &&
    ticket.email &&
    nowSec - cookieReplyEmailAt > REPLY_EMAIL_DEBOUNCE_S
  ) {
    cookieReplyEmailAt = nowSec;
    const job = (async () => {
      try {
        const token = await signResumeToken(env, {
          tid: ticket.tid,
          uid: ticket.uid,
          email: ticket.email,
          name: ticket.name,
          pid: ticket.pid,
        });
        const baseUrl = new URL(request.url).origin;
        const resumeUrl = buildResumeUrl(baseUrl, token);
        await sendReplyNotification(env, {
          to: ticket.email,
          name: ticket.name,
          subject:
            thread.name?.replace(/^#\d+\s*\[[^\]]+\]\s*/, '') ||
            'Your support ticket',
          resumeUrl,
          preview: newHelper.content,
          staffFirstName: newHelper.firstName || 'OpenDrone',
        });
      } catch (err) {
        console.warn('[support/poll] reply-email failed', err);
      }
    })();
    if (context.waitUntil) context.waitUntil(job);
    else void job;
  }

  // Roll the cursor forward into the signed cookie so the next poll asks
  // only for what's newer than what we just delivered.
  const cursorChanged = newestId && newestId !== ticket.lastCursor;
  const replyAtChanged = cookieReplyEmailAt !== (ticket.lastReplyEmailAt ?? 0);
  if (cursorChanged || replyAtChanged) {
    const rolled = {
      ...ticket,
      lastCursor: cursorChanged ? newestId : ticket.lastCursor,
      lastReplyEmailAt: cookieReplyEmailAt,
    };
    headers['Set-Cookie'] = buildSupportSetCookie(await signTicket(env, rolled));
  }

  // Stage 5 summariser. After the customer's response is ready, we
  // check whether the thread has drifted far enough past the last
  // summary cursor to warrant a new recap, and fire the summary in the
  // background so the poll itself stays snappy. The generated summary
  // is posted into the Discord thread with AI_SUMMARY_PREFIX and will
  // surface to the customer only if a moderator ✅'s it (Stage 2 gate).
  if (aiDraftsEnabled(env) && messages.length > 0) {
    // Pull the whole thread for the summary context, not just the
    // post-cursor slice we answered this poll with.
    const latestNonBotId = [...messages]
      .reverse()
      .find((m) => !m.author.bot)?.id;
    const latestSummary = [...messages]
      .reverse()
      .find(
        (m) => m.author.bot && m.content.startsWith(AI_SUMMARY_PREFIX),
      );
    const lastCursor = latestSummary
      ? parseSummaryCursor(latestSummary.content)
      : null;
    const newCount = countMessagesSinceCursor(messages, lastCursor);
    const hasFreshMessages =
      latestNonBotId && latestNonBotId !== lastCursor;
    if (
      hasFreshMessages &&
      newCount >= SUMMARY_THRESHOLD_NEW_MESSAGES
    ) {
      const job = (async () => {
        try {
          const whole = await fetchThreadMessages(env, ticket.tid, {
            limit: 100,
          });
          if (!whole.thread) return;
          const flat = whole.messages
            .filter(
              (m) =>
                !m.author.bot ||
                m.content.startsWith(AI_DRAFT_PREFIX) ||
                m.content.startsWith(AI_SUMMARY_PREFIX),
            )
            .map((m) => {
              const isCustomer = !m.author.bot && m.author.id === '';
              // We don't have a reliable "is-customer" flag on the
              // Discord side — the customer's messages are posted by
              // the bot on their behalf, prefixed `**<name>:**`. Flag
              // any message that starts with `**` and a colon as
              // customer-authored so the summariser labels it right.
              const looksLikeCustomer = /^\*\*[^*]{1,80}:\*\*/.test(
                m.content,
              );
              return {
                author: looksLikeCustomer
                  ? ticket.name
                  : extractFirstName([m.author.globalName, m.author.username]),
                isCustomer: isCustomer || looksLikeCustomer,
                content: m.content,
              };
            });
          const summary = await generateSummary(env, {
            subject: whole.thread.name,
            customerFirstName: ticket.name.split(/\s+/)[0] ?? ticket.name,
            messages: flat,
          });
          if (!summary.ok) {
            console.warn('[support/poll] summary skipped', summary.reason);
            return;
          }
          await postToThread(
            env,
            ticket.tid,
            formatSummaryForDiscord(summary.text, latestNonBotId ?? ''),
          );
        } catch (err) {
          console.warn(
            '[support/poll] summary crashed',
            err instanceof Error ? err.name : 'unknown',
          );
        }
      })();
      if (context.waitUntil) context.waitUntil(job);
      else void job;
    }
  }

  return data<PollResult>(
    {ok: true, messages: projected, closed: thread.archived || thread.locked},
    {headers},
  );
}

// Recognises a customer-relayed message posted by the bot on behalf of
// the customer. Format from /api/support/send: `**<First>:**` optionally
// followed by a space + body. Conservative — caps the captured name at
// 80 chars and disallows asterisks in the name to avoid matching bold
// runs in arbitrary helper replies.
const SELF_PREFIX_RE = /^\*\*([^*]{1,80}?):\*\*(?:\s+([\s\S]*))?$/;

function isSelfRelayedMessage(content: string): boolean {
  return SELF_PREFIX_RE.test(content);
}

function stripSelfPrefix(content: string): {
  firstName: string;
  body: string;
} {
  const match = SELF_PREFIX_RE.exec(content);
  if (!match) return {firstName: '', body: content};
  return {firstName: match[1].trim(), body: (match[2] ?? '').trim()};
}

// Counts non-bot messages in `messages` that come after `cursor`. If
// cursor is null, counts all non-bot messages. Used to decide whether
// the summariser should fire this poll.
function countMessagesSinceCursor(
  messages: Array<{id: string; author: {bot: boolean}; content: string}>,
  cursor: string | null,
): number {
  if (!cursor) return messages.filter((m) => !m.author.bot).length;
  const idx = messages.findIndex((m) => m.id === cursor);
  if (idx < 0) return messages.filter((m) => !m.author.bot).length;
  return messages.slice(idx + 1).filter((m) => !m.author.bot).length;
}
