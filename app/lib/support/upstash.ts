/**
 * Tiny Upstash Redis REST client.
 *
 * Oxygen does not expose Cloudflare Workers KV bindings, so the support
 * ticket index uses Upstash (https://upstash.com) as a serverless KV
 * over HTTPS. We hit the REST API directly — no SDK — to keep the bundle
 * small and avoid pulling in a Node-shimmed dependency on the edge.
 *
 * Auth: Bearer token. Requests are JSON-array form, e.g.
 *   ["GET", "tk:1234"]
 *   ["SET", "tk:1234", "{...}", "EX", "63072000"]
 *
 * The client returns `null` from get() on missing keys (matching the
 * KVNamespace contract the index module was built against), so the
 * surrounding code didn't need to learn a new shape.
 */

export type UpstashEnv = {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

export type TicketStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: {expirationTtl?: number}): Promise<void>;
  // Iterate keys matching `pattern` (Redis glob — e.g. "tk:*"). Returns
  // every match in one batch; suitable for bounded indexes (we cap each
  // per-customer list at 200 and don't expect more than a few thousand
  // tickets globally). Wraps SCAN so we don't depend on the cursor
  // being exposed to callers.
  scan(pattern: string): Promise<string[]>;
};

export function getTicketStore(env: UpstashEnv): TicketStore | null {
  const url = env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return {
    async get(key) {
      const r = await call(url, token, ['GET', key]);
      if (r === null || r === undefined) return null;
      return typeof r === 'string' ? r : String(r);
    },
    async put(key, value, opts) {
      const ttl = opts?.expirationTtl;
      const cmd =
        ttl && ttl > 0
          ? ['SET', key, value, 'EX', String(ttl)]
          : ['SET', key, value];
      await call(url, token, cmd);
    },
    async scan(pattern) {
      const out = new Set<string>();
      let cursor = '0';
      // Hard cap to avoid runaway SCAN loops if a misconfigured pattern
      // somehow hits a huge keyspace. 50 iterations × 100 ≈ 5k keys.
      for (let i = 0; i < 50; i++) {
        const r = (await call(url, token, [
          'SCAN',
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '100',
        ])) as [string, string[]] | unknown;
        if (!Array.isArray(r) || r.length < 2) break;
        cursor = String(r[0]);
        const batch = Array.isArray(r[1]) ? (r[1] as string[]) : [];
        for (const k of batch) out.add(k);
        if (cursor === '0') break;
      }
      return Array.from(out);
    },
  };
}

async function call(
  url: string,
  token: string,
  command: string[],
): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`upstash ${command[0]} ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {result?: unknown; error?: string};
  if (json.error) throw new Error(`upstash ${command[0]}: ${json.error}`);
  return json.result ?? null;
}
