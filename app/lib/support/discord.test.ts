import {describe, it, mock, after} from 'node:test';
import assert from 'node:assert/strict';
import {firstNameOnly, postStaffMetadata} from './discord.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/support/discord.test.ts

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function stubFetch(impl: FetchStub) {
  mock.method(globalThis, 'fetch', impl);
}

describe('firstNameOnly', () => {
  it('takes the first whitespace-split token', () => {
    assert.equal(firstNameOnly('Stefaan Coene'), 'Stefaan');
  });

  it('caps at 40 chars', () => {
    assert.equal(firstNameOnly('A'.repeat(80)).length, 40);
  });

  it('falls back to "Customer" on empty input', () => {
    assert.equal(firstNameOnly(''), 'Customer');
    assert.equal(firstNameOnly('   '), 'Customer');
  });

  it('handles single-word names', () => {
    assert.equal(firstNameOnly('Vitroid'), 'Vitroid');
  });
});

describe('postStaffMetadata', () => {
  after(() => mock.restoreAll());

  it('returns false (no-op) when DISCORD_STAFF_METADATA_CHANNEL_ID is unset', async () => {
    let calls = 0;
    stubFetch(async () => {
      calls++;
      return new Response('{}', {status: 200});
    });
    const ok = await postStaffMetadata(
      {DISCORD_BOT_TOKEN: 't'},
      'thread-1',
      '[Stefaan] check',
      {userName: 'Stefaan Coene', userEmail: 's@example.com'},
    );
    assert.equal(ok, false);
    assert.equal(calls, 0);
  });

  it('posts a message containing email + customer id + UA + IP + jump URL', async () => {
    let seenUrl = '';
    let seenBody = '';
    stubFetch(async (input, init) => {
      seenUrl = String(input);
      seenBody = String(init?.body ?? '');
      return new Response(JSON.stringify({id: 'm1'}), {status: 200});
    });
    const ok = await postStaffMetadata(
      {
        DISCORD_BOT_TOKEN: 't',
        DISCORD_STAFF_METADATA_CHANNEL_ID: 'staff-channel',
        DISCORD_GUILD_ID: 'g1',
      },
      'thread-42',
      '[Stefaan] check',
      {
        userName: 'Stefaan Coene',
        userEmail: 'stan.coene@gmail.com',
        customerId: 'gid://shopify/Customer/24852411842905',
        userAgent: 'Mozilla/5.0 (Macintosh)',
        ipHint: '203.0.113.x',
      },
    );
    assert.equal(ok, true);
    assert.match(seenUrl, /\/channels\/staff-channel\/messages$/);
    const payload = JSON.parse(seenBody) as {content: string};
    assert.match(payload.content, /Stefaan Coene/);
    assert.match(payload.content, /stan\.coene@gmail\.com/);
    assert.match(payload.content, /gid:\/\/shopify\/Customer\/24852411842905/);
    assert.match(payload.content, /Mozilla\/5\.0 \(Macintosh\)/);
    assert.match(payload.content, /203\.0\.113\.x/);
    assert.match(
      payload.content,
      /https:\/\/discord\.com\/channels\/g1\/thread-42/,
    );
  });

  it('returns false on upstream error', async () => {
    stubFetch(async () => new Response('forbidden', {status: 403}));
    const ok = await postStaffMetadata(
      {
        DISCORD_BOT_TOKEN: 't',
        DISCORD_STAFF_METADATA_CHANNEL_ID: 'staff-channel',
      },
      'thread-1',
      'subj',
      {userName: 'X', userEmail: 'x@y.com'},
    );
    assert.equal(ok, false);
  });

  it('falls back to @me when DISCORD_GUILD_ID is unset (jump URL still parseable)', async () => {
    let seenBody = '';
    stubFetch(async (_input, init) => {
      seenBody = String(init?.body ?? '');
      return new Response(JSON.stringify({id: 'm1'}), {status: 200});
    });
    await postStaffMetadata(
      {
        DISCORD_BOT_TOKEN: 't',
        DISCORD_STAFF_METADATA_CHANNEL_ID: 'staff-channel',
      },
      'thread-9',
      'subj',
      {userName: 'X', userEmail: 'x@y.com'},
    );
    const payload = JSON.parse(seenBody) as {content: string};
    assert.match(payload.content, /channels\/@me\/thread-9/);
  });
});
