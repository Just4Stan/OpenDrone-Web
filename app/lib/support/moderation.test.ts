import {describe, it, before, after, mock} from 'node:test';
import assert from 'node:assert/strict';
import {
  _resetModCache,
  approveEmoji,
  decideApproval,
  filterByApproval,
  getModeratorIds,
  resolveMode,
} from './moderation.ts';
import type {DiscordMessage} from './discord.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/support/moderation.test.ts
//
// Uses node:test's built-in mock to stub globalThis.fetch, so Discord's
// REST API is never actually hit.

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function stubFetch(impl: FetchStub) {
  mock.method(globalThis, 'fetch', impl);
}

function msg(partial: Partial<DiscordMessage> & {id: string}): DiscordMessage {
  return {
    id: partial.id,
    content: partial.content ?? 'hello',
    createdAt: partial.createdAt ?? new Date().toISOString(),
    author: partial.author ?? {
      id: 'user-1',
      username: 'someone',
      globalName: null,
      bot: false,
    },
    attachments: partial.attachments ?? [],
    reactions: partial.reactions ?? [],
  };
}

describe('resolveMode', () => {
  it('defaults to enforce when role id is set', () => {
    assert.equal(
      resolveMode({SUPPORT_MOD_ROLE_ID: 'r1'}),
      'enforce',
    );
  });

  it('falls back to log when role id is missing', () => {
    assert.equal(resolveMode({}), 'log');
  });

  it('honours explicit off', () => {
    assert.equal(
      resolveMode({SUPPORT_MOD_ROLE_ID: 'r1', SUPPORT_MODERATION_MODE: 'off'}),
      'off',
    );
  });

  it('honours explicit log', () => {
    assert.equal(
      resolveMode({SUPPORT_MOD_ROLE_ID: 'r1', SUPPORT_MODERATION_MODE: 'log'}),
      'log',
    );
  });

  it('ignores unknown values and defaults to enforce when role set', () => {
    assert.equal(
      resolveMode({
        SUPPORT_MOD_ROLE_ID: 'r1',
        SUPPORT_MODERATION_MODE: 'bogus',
      }),
      'enforce',
    );
  });
});

describe('approveEmoji', () => {
  it('defaults to check mark', () => {
    assert.equal(approveEmoji({}), '✅');
  });

  it('respects override when trimmed', () => {
    assert.equal(approveEmoji({SUPPORT_APPROVE_EMOJI: '  👍  '}), '👍');
  });

  it('empty string falls back to default', () => {
    assert.equal(approveEmoji({SUPPORT_APPROVE_EMOJI: '   '}), '✅');
  });
});

describe('getModeratorIds', () => {
  before(() => _resetModCache());
  after(() => mock.restoreAll());

  it('returns empty set when env is unconfigured', async () => {
    const ids = await getModeratorIds({});
    assert.equal(ids.size, 0);
  });

  it('fetches and caches guild role members', async () => {
    _resetModCache();
    let calls = 0;
    stubFetch(async (input) => {
      calls++;
      const url = String(input);
      assert.match(url, /\/guilds\/g1\/members/);
      return new Response(
        JSON.stringify([
          {user: {id: 'mod-a'}, roles: ['r1']},
          {user: {id: 'user-1'}, roles: ['r2']},
          {user: {id: 'mod-b'}, roles: ['r1', 'r2']},
        ]),
        {status: 200},
      );
    });
    const env = {
      DISCORD_BOT_TOKEN: 't',
      DISCORD_GUILD_ID: 'g1',
      SUPPORT_MOD_ROLE_ID: 'r1',
    };
    const first = await getModeratorIds(env);
    assert.deepEqual([...first].sort(), ['mod-a', 'mod-b']);
    // Second call within TTL shouldn't re-fetch.
    const second = await getModeratorIds(env);
    assert.deepEqual([...second].sort(), ['mod-a', 'mod-b']);
    assert.equal(calls, 1, 'expected only one guild-members fetch');
  });
});

describe('decideApproval', () => {
  before(() => _resetModCache());
  after(() => mock.restoreAll());

  it('approves when reactor set intersects moderator set', async () => {
    _resetModCache();
    stubFetch(async (input) => {
      const url = String(input);
      if (url.includes('/guilds/')) {
        return new Response(
          JSON.stringify([{user: {id: 'mod-a'}, roles: ['r1']}]),
          {status: 200},
        );
      }
      if (url.includes('/reactions/')) {
        return new Response(JSON.stringify([{id: 'mod-a'}, {id: 'other'}]), {
          status: 200,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const env = {
      DISCORD_BOT_TOKEN: 't',
      DISCORD_GUILD_ID: 'g1',
      SUPPORT_MOD_ROLE_ID: 'r1',
    };
    const d = await decideApproval(
      env,
      msg({id: 'm1', reactions: [{emoji: '✅', count: 2, me: false}]}),
      'c1',
    );
    assert.equal(d.approved, true);
    assert.equal(d.reason, 'mod-reacted');
  });

  it('rejects when reactors are all non-mods', async () => {
    _resetModCache();
    stubFetch(async (input) => {
      const url = String(input);
      if (url.includes('/guilds/')) {
        return new Response(
          JSON.stringify([{user: {id: 'mod-a'}, roles: ['r1']}]),
          {status: 200},
        );
      }
      if (url.includes('/reactions/')) {
        return new Response(JSON.stringify([{id: 'someone-else'}]), {
          status: 200,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const env = {
      DISCORD_BOT_TOKEN: 't',
      DISCORD_GUILD_ID: 'g1',
      SUPPORT_MOD_ROLE_ID: 'r1',
    };
    const d = await decideApproval(
      env,
      msg({id: 'm1', reactions: [{emoji: '✅', count: 1, me: false}]}),
      'c1',
    );
    assert.equal(d.approved, false);
    assert.equal(d.reason, 'no-mod-reacted');
  });

  it('returns no-reaction without any API calls when emoji not on message', async () => {
    _resetModCache();
    let fetches = 0;
    stubFetch(async () => {
      fetches++;
      return new Response('[]', {status: 200});
    });
    const env = {
      DISCORD_BOT_TOKEN: 't',
      DISCORD_GUILD_ID: 'g1',
      SUPPORT_MOD_ROLE_ID: 'r1',
    };
    const d = await decideApproval(env, msg({id: 'm1'}), 'c1');
    assert.equal(d.approved, false);
    assert.equal(d.reason, 'no-reaction');
    assert.equal(fetches, 0);
  });

  it('bypasses when moderation mode is off', async () => {
    _resetModCache();
    const d = await decideApproval(
      {SUPPORT_MODERATION_MODE: 'off', SUPPORT_MOD_ROLE_ID: 'r1'},
      msg({id: 'm1'}),
      'c1',
    );
    assert.equal(d.approved, true);
    assert.equal(d.reason, 'bypass-off');
  });

  it('bypasses with unconfigured reason when mod set is empty', async () => {
    _resetModCache();
    stubFetch(async (input) => {
      const url = String(input);
      if (url.includes('/guilds/')) return new Response('[]', {status: 200});
      throw new Error(`unexpected fetch: ${url}`);
    });
    const env = {
      DISCORD_BOT_TOKEN: 't',
      DISCORD_GUILD_ID: 'g1',
      SUPPORT_MOD_ROLE_ID: 'r1',
    };
    const d = await decideApproval(
      env,
      msg({id: 'm1', reactions: [{emoji: '✅', count: 1, me: false}]}),
      'c1',
    );
    assert.equal(d.approved, true);
    assert.equal(d.reason, 'bypass-unconfigured');
  });
});

describe('filterByApproval', () => {
  before(() => _resetModCache());
  after(() => mock.restoreAll());

  it('in enforce mode, only approved messages survive', async () => {
    _resetModCache();
    stubFetch(async (input) => {
      const url = String(input);
      if (url.includes('/guilds/')) {
        return new Response(
          JSON.stringify([{user: {id: 'mod-a'}, roles: ['r1']}]),
          {status: 200},
        );
      }
      if (url.includes('/messages/m2/reactions/')) {
        return new Response(JSON.stringify([{id: 'mod-a'}]), {status: 200});
      }
      return new Response('[]', {status: 200});
    });
    const env = {
      DISCORD_BOT_TOKEN: 't',
      DISCORD_GUILD_ID: 'g1',
      SUPPORT_MOD_ROLE_ID: 'r1',
      SUPPORT_MODERATION_MODE: 'enforce',
    };
    const messages = [
      msg({id: 'm1'}),
      msg({id: 'm2', reactions: [{emoji: '✅', count: 1, me: false}]}),
      msg({id: 'm3', reactions: [{emoji: '👀', count: 1, me: false}]}),
    ];
    const res = await filterByApproval(env, messages, 'c1');
    assert.equal(res.mode, 'enforce');
    assert.deepEqual(res.approved.map((m) => m.id), ['m2']);
    assert.deepEqual(
      res.dropped.map((d) => `${d.message.id}:${d.reason}`).sort(),
      ['m1:no-reaction', 'm3:no-reaction'],
    );
  });

  it('in log mode, everything is delivered but drops are still reported', async () => {
    _resetModCache();
    stubFetch(async () => new Response('[]', {status: 200}));
    const env = {SUPPORT_MODERATION_MODE: 'log'};
    const messages = [msg({id: 'm1'}), msg({id: 'm2'})];
    const res = await filterByApproval(env, messages, 'c1');
    assert.equal(res.mode, 'log');
    assert.deepEqual(res.approved.map((m) => m.id), ['m1', 'm2']);
    assert.equal(res.dropped.length, 2);
  });

  it('in off mode, no decisions are computed', async () => {
    _resetModCache();
    let fetches = 0;
    stubFetch(async () => {
      fetches++;
      return new Response('[]', {status: 200});
    });
    const env = {SUPPORT_MODERATION_MODE: 'off', SUPPORT_MOD_ROLE_ID: 'r1'};
    const messages = [msg({id: 'm1'}), msg({id: 'm2'})];
    const res = await filterByApproval(env, messages, 'c1');
    assert.equal(res.mode, 'off');
    assert.deepEqual(res.approved.map((m) => m.id), ['m1', 'm2']);
    assert.equal(res.dropped.length, 0);
    assert.equal(fetches, 0);
  });
});
