import {data} from 'react-router';
import type {Route} from './+types/api.support.cleanup';
import {deleteThread} from '~/lib/support/discord';
import {listAllTickets, removeTicket} from '~/lib/support/ticket-index';

// Stale-ticket sweeper. Triggered on a daily cron (GitHub Actions →
// curl POST). Walks every ticket meta and deletes the Discord thread +
// index entry for tickets that:
//   - are already closed (the close handler also deletes inline; this
//     catches anything that slipped through), OR
//   - have had no activity for STALE_DAYS days.
//
// Auth: bearer token matching SUPPORT_CLEANUP_SECRET. Without that env
// var set, the endpoint is disabled (503).

const STALE_DAYS = 7;
const STALE_SECONDS = STALE_DAYS * 24 * 60 * 60;

type CleanupResult =
  | {
      ok: true;
      scanned: number;
      removed: Array<{tid: string; pid: string; reason: 'closed' | 'stale'}>;
    }
  | {ok: false; message: string};

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data<CleanupResult>(
      {ok: false, message: 'Method not allowed.'},
      {status: 405},
    );
  }
  const env = context.env;
  const secret = env.SUPPORT_CLEANUP_SECRET;
  if (!secret) {
    return data<CleanupResult>(
      {ok: false, message: 'Cleanup endpoint not configured.'},
      {status: 503},
    );
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${secret}`) {
    return data<CleanupResult>(
      {ok: false, message: 'Unauthorized.'},
      {status: 401},
    );
  }

  const tickets = await listAllTickets(env);
  const nowSec = Math.floor(Date.now() / 1000);
  const removed: Array<{tid: string; pid: string; reason: 'closed' | 'stale'}> = [];

  for (const meta of tickets) {
    let reason: 'closed' | 'stale' | null = null;
    if (meta.status === 'closed') {
      reason = 'closed';
    } else if (
      meta.lastActivityAt > 0 &&
      nowSec - meta.lastActivityAt > STALE_SECONDS
    ) {
      reason = 'stale';
    }
    if (!reason) continue;

    const del = await deleteThread(env, meta.tid).catch((err) => {
      console.warn('[support/cleanup] delete failed', meta.tid, err);
      return {ok: false, status: 0};
    });
    // Even if Discord refuses (rate limit, transient), still drop our
    // index entry so the customer doesn't see a phantom row. The next
    // run will retry the Discord delete with the meta gone (no-op).
    await removeTicket(env, meta.tid).catch((err) =>
      console.warn('[support/cleanup] index remove failed', meta.tid, err),
    );
    removed.push({tid: meta.tid, pid: meta.pid, reason});
    void del;
  }

  return data<CleanupResult>(
    {ok: true, scanned: tickets.length, removed},
    {headers: {'Cache-Control': 'no-store'}},
  );
}

export function loader() {
  return new Response(null, {status: 404});
}
