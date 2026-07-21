// Decision logic for the reply-notification email sweep
// (/api/support/notify, driven by a GitHub Actions cron). Pure module,
// runnable under `node --test`: the route projects Discord messages
// into SweepMessage records and applies the returned action.
//
// Input is the slice of messages strictly newer than the ticket's
// settled cursor (the later of notifyCursor and seenCursor), oldest
// first, with moderation and scrubbing already resolved by the caller.
//
// The contract mirrors poll-cursor.ts: the cursor never advances past
// a message held by the enforce-mode moderation gate, because a later
// approval must still be able to surface (and email) it.

export type SweepMessage = {
  id: string;
  // Approved staff reply with scrubbed, non-empty content: emailable.
  staff: boolean;
  // Customer message relayed by the bot (`**Name:**` prefix). A
  // customer reply means they have seen everything before it.
  customer: boolean;
  // Non-bot message held by the enforce-mode moderation gate.
  held: boolean;
  createdAtMs: number;
  firstName: string;
  content: string;
};

export type SweepDecision =
  | {
      action: 'skip';
      reason: 'no-messages' | 'no-staff' | 'customer-replied';
      nextCursor: string | null;
    }
  | {action: 'defer'; reason: 'quiet-period' | 'held-first'}
  | {action: 'email'; include: SweepMessage[]; nextCursor: string};

// A ticket whose newest staff reply is younger than this waits for the
// next sweep, so a burst of replies settles into ONE email instead of
// one email per message.
export const QUIET_PERIOD_MS = 10 * 60 * 1000;

export function decideNotify(
  messages: SweepMessage[],
  nowMs: number,
  quietMs: number = QUIET_PERIOD_MS,
): SweepDecision {
  if (!messages.length) {
    return {action: 'skip', reason: 'no-messages', nextCursor: null};
  }

  // Window = prefix before the earliest held message, if any.
  const heldIdx = messages.findIndex((m) => m.held);
  const windowed = heldIdx < 0 ? messages : messages.slice(0, heldIdx);
  if (!windowed.length) return {action: 'defer', reason: 'held-first'};

  const staff = windowed.filter((m) => m.staff);
  const endCursor = windowed[windowed.length - 1].id;
  if (!staff.length) {
    // Customer messages and terminal bot noise only: nothing to email.
    // Settle the cursor so the sweep stops re-reading them.
    return {action: 'skip', reason: 'no-staff', nextCursor: endCursor};
  }

  const lastStaff = staff[staff.length - 1];
  const lastCustomer = [...windowed].reverse().find((m) => m.customer);
  if (lastCustomer && compareSnowflake(lastCustomer.id, lastStaff.id) > 0) {
    // The customer wrote after the last staff reply: they are in the
    // conversation and have seen it. No email needed.
    return {action: 'skip', reason: 'customer-replied', nextCursor: endCursor};
  }

  if (nowMs - lastStaff.createdAtMs < quietMs) {
    // Staff may still be typing follow-ups. No cursor advance: the
    // same batch (plus any additions) is re-evaluated next sweep.
    return {action: 'defer', reason: 'quiet-period'};
  }

  return {action: 'email', include: staff, nextCursor: endCursor};
}

// Later of two Discord snowflake ids; tolerates either being unset.
export function laterSnowflake(
  a?: string,
  b?: string,
): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareSnowflake(a, b) >= 0 ? a : b;
}

function compareSnowflake(a: string, b: string): number {
  try {
    const d = BigInt(a) - BigInt(b);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  } catch {
    // Non-numeric id (should not happen): fall back to string order.
    return a < b ? -1 : a > b ? 1 : 0;
  }
}
