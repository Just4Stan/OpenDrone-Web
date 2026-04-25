import {data} from 'react-router';
import type {Route} from './+types/api.support.thread.$pid';
import {fetchThreadMessages} from '~/lib/support/discord';
import {SUPPORT_CUSTOMER_PREFILL_QUERY} from '~/graphql/customer-account/SupportPrefillQuery';
import {listByCustomer, getMeta} from '~/lib/support/ticket-index';
import {checkRateLimit} from '~/lib/rate-limit';
import {
  extractFirstName,
  scrubForPublic,
  type PublicMessage,
} from '~/lib/support/scrubber';
import {filterByApproval} from '~/lib/support/moderation';
import {AI_DRAFT_PREFIX, AI_SUMMARY_PREFIX} from '~/lib/support/ai-draft';

type ThreadResult =
  | {
      ok: true;
      ticket: {
        pid: string;
        tid: string;
        subject: string;
        status: 'open' | 'closed';
        openedAt: number;
        closedAt: number | null;
      };
      messages: PublicMessage[];
    }
  | {
      ok: false;
      message: string;
      code?: 'signin-required' | 'not-found' | 'no-kv';
    };

const SELF_PREFIX_RE = /^\*\*([^*]{1,80}?):\*\*(?:\s+([\s\S]*))?$/;

// Read-only fetch of a specific ticket the signed-in customer owns.
// Used by /account/support to show closed/non-current threads without
// needing the support cookie. Auth: customer ID must match the ticket
// in the KV index. Without TICKETS_KV bound we can't verify ownership
// safely, so we 404 in that case rather than risk leaking a thread.
export async function loader({request, context, params}: Route.LoaderArgs) {
  const env = context.env;
  const pid = String(params.pid ?? '').trim();
  if (!/^\d{4,12}$/.test(pid)) {
    return data<ThreadResult>(
      {ok: false, message: 'Invalid ticket id.', code: 'not-found'},
      {status: 400},
    );
  }

  let customerId: string | null = null;
  try {
    const {data: prefill} = await context.customerAccount.query(
      SUPPORT_CUSTOMER_PREFILL_QUERY,
    );
    customerId = prefill?.customer?.id ?? null;
  } catch {
    /* anon */
  }
  if (!customerId) {
    return data<ThreadResult>(
      {ok: false, message: 'Sign in to view this ticket.', code: 'signin-required'},
      {status: 401},
    );
  }

  if (!env.TICKETS_KV) {
    return data<ThreadResult>(
      {ok: false, message: 'Ticket history unavailable.', code: 'no-kv'},
      {status: 503},
    );
  }

  const limit = checkRateLimit(`support-thread:${customerId}:${pid}`, 30, 60 * 1000);
  if (!limit.allowed) {
    return data<ThreadResult>(
      {ok: false, message: 'Too many requests.'},
      {status: 429, headers: {'Retry-After': String(limit.resetInSeconds)}},
    );
  }

  // Resolve pid -> tid via the customer's index list. Bounded: index
  // is capped at 200 entries so this is a single KV read + linear scan.
  const list = await listByCustomer(env, customerId, {status: 'all', limit: 200});
  const indexEntry = list.find((e) => e.pid === pid);
  if (!indexEntry) {
    return data<ThreadResult>(
      {ok: false, message: 'Ticket not found.', code: 'not-found'},
      {status: 404},
    );
  }

  const meta = await getMeta(env, indexEntry.tid);

  const {messages, thread} = await fetchThreadMessages(env, indexEntry.tid, {
    limit: 100,
  });
  if (!thread) {
    return data<ThreadResult>(
      {ok: false, message: 'Ticket archived or removed.', code: 'not-found'},
      {status: 410},
    );
  }

  // Same projection rules as /api/support/poll. Customer-relayed
  // bot messages surface as role:'self'. Staff/AI surface as helper/ai.
  const candidates = messages.filter(
    (m) =>
      !m.author.bot ||
      m.content.startsWith(AI_DRAFT_PREFIX) ||
      m.content.startsWith(AI_SUMMARY_PREFIX) ||
      SELF_PREFIX_RE.test(m.content),
  );
  const filtered = await filterByApproval(env, candidates, indexEntry.tid);
  const projected: PublicMessage[] = [];
  for (const m of filtered.approved) {
    const isAiDraft = m.author.bot && m.content.startsWith(AI_DRAFT_PREFIX);
    const isAiSummary = m.author.bot && m.content.startsWith(AI_SUMMARY_PREFIX);
    const isSelf =
      m.author.bot && !isAiDraft && !isAiSummary && SELF_PREFIX_RE.test(m.content);
    if (m.author.bot && !isAiDraft && !isAiSummary && !isSelf) continue;
    let raw = m.content;
    let firstName = extractFirstName([m.author.globalName, m.author.username]);
    if (isAiDraft) raw = m.content.slice(AI_DRAFT_PREFIX.length).trim();
    else if (isAiSummary) {
      const nl = m.content.indexOf('\n');
      raw = nl >= 0 ? m.content.slice(nl + 1).trim() : '';
    } else if (isSelf) {
      const match = SELF_PREFIX_RE.exec(m.content);
      raw = (match?.[2] ?? '').trim();
      firstName = match?.[1]?.trim() || meta?.name || 'You';
    }
    const scrubbed = scrubForPublic(raw);
    if (scrubbed.blocked) continue;
    if (!scrubbed.content && !m.attachments.length) continue;
    projected.push({
      id: m.id,
      role: isAiDraft || isAiSummary ? 'ai' : isSelf ? 'self' : 'helper',
      firstName: isAiDraft || isAiSummary ? 'OpenDrone' : firstName,
      content: scrubbed.content,
      createdAt: m.createdAt,
      attachments: m.attachments.map((a) => ({
        url: a.url,
        filename: a.filename,
      })),
    });
  }

  void request; // satisfy unused-arg lint without changing signature
  return data<ThreadResult>(
    {
      ok: true,
      ticket: {
        pid: indexEntry.pid,
        tid: indexEntry.tid,
        subject: indexEntry.subject,
        status: indexEntry.status,
        openedAt: indexEntry.openedAt,
        closedAt: indexEntry.closedAt,
      },
      messages: projected,
    },
    {headers: {'Cache-Control': 'private, no-store'}},
  );
}
