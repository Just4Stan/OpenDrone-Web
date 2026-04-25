import {describe, it, mock, after} from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_DRAFT_PREFIX,
  AI_SUMMARY_PREFIX,
  aiDraftsEnabled,
  formatDraftForDiscord,
  formatSummaryForDiscord,
  generateDraft,
  generateSummary,
  parseSummaryCursor,
} from './ai-draft.ts';

// Run with:
//   node --experimental-strip-types --test app/lib/support/ai-draft.test.ts
//
// Stubs globalThis.fetch so we don't hit the real Anthropic API.

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function stubFetch(impl: FetchStub) {
  mock.method(globalThis, 'fetch', impl);
}

describe('aiDraftsEnabled', () => {
  it('off when flag unset', () => {
    assert.equal(aiDraftsEnabled({ANTHROPIC_API_KEY: 'k'}), false);
  });

  it('off when api key unset', () => {
    assert.equal(aiDraftsEnabled({SUPPORT_AI_DRAFTS_ENABLED: '1'}), false);
  });

  it('on when both set', () => {
    assert.equal(
      aiDraftsEnabled({
        SUPPORT_AI_DRAFTS_ENABLED: '1',
        ANTHROPIC_API_KEY: 'k',
      }),
      true,
    );
  });

  it('any value other than "1" is off', () => {
    assert.equal(
      aiDraftsEnabled({
        SUPPORT_AI_DRAFTS_ENABLED: 'true',
        ANTHROPIC_API_KEY: 'k',
      }),
      false,
    );
  });
});

describe('formatDraftForDiscord', () => {
  it('prefixes the AI_DRAFT marker', () => {
    const out = formatDraftForDiscord('hello');
    assert.ok(out.startsWith(AI_DRAFT_PREFIX));
    assert.ok(out.endsWith('hello'));
  });

  it('truncates over 1800 chars with ellipsis', () => {
    const long = 'x'.repeat(2500);
    const out = formatDraftForDiscord(long);
    assert.ok(out.length <= AI_DRAFT_PREFIX.length + 1 + 1801);
    assert.ok(out.endsWith('…'));
  });
});

describe('generateDraft', () => {
  after(() => mock.restoreAll());

  it('returns reason=disabled when the feature flag is off', async () => {
    const r = await generateDraft(
      {ANTHROPIC_API_KEY: 'k'},
      {subject: 's', message: 'm', customerFirstName: 'Jan'},
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'disabled');
  });

  it('returns the text on a successful API call', async () => {
    stubFetch(async (input) => {
      assert.equal(String(input), 'https://api.anthropic.com/v1/messages');
      return new Response(
        JSON.stringify({
          content: [{type: 'text', text: 'Short helpful reply.'}],
          model: 'claude-haiku-4-5',
        }),
        {status: 200},
      );
    });
    const r = await generateDraft(
      {SUPPORT_AI_DRAFTS_ENABLED: '1', ANTHROPIC_API_KEY: 'test-key'},
      {subject: 'help', message: 'my ESC beeps', customerFirstName: 'Jan'},
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.text, 'Short helpful reply.');
      assert.equal(r.modelUsed, 'claude-haiku-4-5');
    }
  });

  it('returns anthropic-<code> on upstream error', async () => {
    stubFetch(async () => new Response('rate limited', {status: 429}));
    const r = await generateDraft(
      {SUPPORT_AI_DRAFTS_ENABLED: '1', ANTHROPIC_API_KEY: 'test-key'},
      {subject: 's', message: 'm', customerFirstName: 'Jan'},
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'anthropic-429');
  });

  it('returns empty-response if Claude returns no text blocks', async () => {
    stubFetch(async () =>
      new Response(JSON.stringify({content: []}), {status: 200}),
    );
    const r = await generateDraft(
      {SUPPORT_AI_DRAFTS_ENABLED: '1', ANTHROPIC_API_KEY: 'test-key'},
      {subject: 's', message: 'm', customerFirstName: 'Jan'},
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'empty-response');
  });

  it('returns network-exception when fetch throws', async () => {
    stubFetch(async () => {
      throw new TypeError('offline');
    });
    const r = await generateDraft(
      {SUPPORT_AI_DRAFTS_ENABLED: '1', ANTHROPIC_API_KEY: 'test-key'},
      {subject: 's', message: 'm', customerFirstName: 'Jan'},
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'network-exception');
  });

  it('uses SUPPORT_AI_MODEL override when set', async () => {
    let seenBody: string | null = null;
    stubFetch(async (_input, init) => {
      seenBody = String(init?.body ?? '');
      return new Response(
        JSON.stringify({content: [{type: 'text', text: 'ok'}]}),
        {status: 200},
      );
    });
    await generateDraft(
      {
        SUPPORT_AI_DRAFTS_ENABLED: '1',
        ANTHROPIC_API_KEY: 'k',
        SUPPORT_AI_MODEL: 'claude-sonnet-4-6',
      },
      {subject: 's', message: 'm', customerFirstName: 'Jan'},
    );
    assert.ok(seenBody);
    const parsed = JSON.parse(seenBody as string) as {model: string};
    assert.equal(parsed.model, 'claude-sonnet-4-6');
  });

  it('sets prompt-caching on the system prompt', async () => {
    let seenBody: unknown = null;
    stubFetch(async (_input, init) => {
      seenBody = JSON.parse(String(init?.body ?? ''));
      return new Response(
        JSON.stringify({content: [{type: 'text', text: 'ok'}]}),
        {status: 200},
      );
    });
    await generateDraft(
      {SUPPORT_AI_DRAFTS_ENABLED: '1', ANTHROPIC_API_KEY: 'k'},
      {subject: 's', message: 'm', customerFirstName: 'Jan'},
    );
    const body = seenBody as {system?: Array<{cache_control?: unknown}>};
    assert.ok(body.system?.[0]?.cache_control);
  });
});

describe('formatSummaryForDiscord + parseSummaryCursor', () => {
  it('round-trips the up-to cursor', () => {
    const formatted = formatSummaryForDiscord('recap text', '12345');
    assert.ok(formatted.startsWith(AI_SUMMARY_PREFIX));
    assert.equal(parseSummaryCursor(formatted), '12345');
  });

  it('truncates long summaries', () => {
    const out = formatSummaryForDiscord('x'.repeat(2500), 'abc');
    assert.ok(out.length < 2100);
    assert.ok(out.includes('…'));
  });

  it('parseSummaryCursor returns null for non-summary content', () => {
    assert.equal(parseSummaryCursor('some other message'), null);
  });

  it('parseSummaryCursor returns null when marker is malformed', () => {
    assert.equal(
      parseSummaryCursor(`${AI_SUMMARY_PREFIX} but no cursor here`),
      null,
    );
  });
});

describe('generateSummary', () => {
  after(() => mock.restoreAll());

  it('returns reason=disabled when the feature flag is off', async () => {
    const r = await generateSummary(
      {ANTHROPIC_API_KEY: 'k'},
      {subject: 's', customerFirstName: 'Jan', messages: []},
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'disabled');
  });

  it('flattens the thread into the user-prompt with role labels', async () => {
    let seenBody: unknown = null;
    stubFetch(async (_input, init) => {
      seenBody = JSON.parse(String(init?.body ?? ''));
      return new Response(
        JSON.stringify({content: [{type: 'text', text: 'recap'}]}),
        {status: 200},
      );
    });
    await generateSummary(
      {SUPPORT_AI_DRAFTS_ENABLED: '1', ANTHROPIC_API_KEY: 'k'},
      {
        subject: 'ESC beeps',
        customerFirstName: 'Jan',
        messages: [
          {author: 'Jan', isCustomer: true, content: 'my ESC beeps'},
          {author: 'Sarah', isCustomer: false, content: 'what firmware?'},
        ],
      },
    );
    const body = seenBody as {messages: Array<{content: string}>};
    const prompt = body.messages[0].content;
    assert.match(prompt, /<ticket_subject>ESC beeps<\/ticket_subject>/);
    assert.match(prompt, /\[Customer \(Jan\)\] my ESC beeps/);
    assert.match(prompt, /\[Sarah\] what firmware\?/);
    // Injection-resistance bookend: thread tags + reminder are present.
    assert.match(prompt, /<thread>/);
    assert.match(prompt, /<\/thread>/);
    assert.match(prompt, /untrusted data/i);
  });

  it('returns network-exception when fetch throws', async () => {
    stubFetch(async () => {
      throw new TypeError('offline');
    });
    const r = await generateSummary(
      {SUPPORT_AI_DRAFTS_ENABLED: '1', ANTHROPIC_API_KEY: 'k'},
      {
        subject: 's',
        customerFirstName: 'Jan',
        messages: [{author: 'Jan', isCustomer: true, content: 'hi'}],
      },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'network-exception');
  });
});
