import {describe, it, mock} from 'node:test';
import assert from 'node:assert/strict';
import {
  OpenBrainError,
  createTicket,
  listTickets,
  supportBackend,
} from './openbrain.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/support/openbrain.test.ts

const CONFIGURED = {
  OPENBRAIN_URL: 'https://brain.example/',
  OPENBRAIN_API_KEY: 'secret',
  SUPPORT_BACKEND: 'openbrain',
};

describe('supportBackend', () => {
  it('defaults to discord (live routes unchanged)', () => {
    assert.equal(supportBackend({}), 'discord');
    assert.equal(supportBackend({SUPPORT_BACKEND: 'openbrain'}), 'discord'); // not configured
  });

  it('returns openbrain only when flagged AND configured', () => {
    assert.equal(supportBackend(CONFIGURED), 'openbrain');
    assert.equal(
      supportBackend({...CONFIGURED, SUPPORT_BACKEND: 'discord'}),
      'discord',
    );
  });
});

describe('openbrain client', () => {
  it('throws 503 when the backend is unconfigured', async () => {
    await assert.rejects(
      () => listTickets({}, 'cust-1'),
      (e: unknown) => e instanceof OpenBrainError && e.status === 503,
    );
  });

  it('sends the key header, strips the trailing slash, and posts JSON', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
      seenUrl = url;
      seenInit = init;
      return new Response(
        JSON.stringify({
          id: 't1',
          pid: '1234567890',
          status: 'open',
          subject: 's',
          opened_at: '2026-06-20T00:00:00Z',
          last_activity_at: '2026-06-20T00:00:00Z',
        }),
        {status: 200, headers: {'content-type': 'application/json'}},
      );
    });
    const t = await createTicket(CONFIGURED, {
      customerId: 'cust-1',
      email: 'a@b.c',
      message: 'help',
    });
    assert.equal(t.pid, '1234567890');
    assert.equal(seenUrl, 'https://brain.example/tickets'); // no double slash
    assert.equal((seenInit?.headers as Record<string, string>)['X-OpenBrain-Key'], 'secret');
    const body = JSON.parse(String(seenInit?.body)) as {
      customer_id: string;
      message: string;
    };
    assert.equal(body.customer_id, 'cust-1');
    assert.equal(body.message, 'help');
    mock.restoreAll();
  });

  it('surfaces a non-2xx as OpenBrainError with the status', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('nope', {status: 501}));
    await assert.rejects(
      () => listTickets(CONFIGURED, 'cust-1'),
      (e: unknown) => e instanceof OpenBrainError && e.status === 501,
    );
    mock.restoreAll();
  });
});
