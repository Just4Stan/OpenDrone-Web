/**
 * One-click unsubscribe tokens for newsletter emails.
 *
 * Signed HMAC, opaque base64url. Payload binds the customer id + email
 * so a leaked token only unsubscribes one address. Token is multi-use
 * within TTL; idempotent on the server side (already-unsubscribed = no-op).
 *
 * Separate `aud` from the support resume tokens so the two schemes can
 * never be cross-replayed even though they share a key derivation
 * pattern. Secret comes from NEWSLETTER_DISPATCH_SECRET — rotating that
 * env var invalidates every previously-issued unsubscribe link, so
 * rotate sparingly.
 */

const enc = new TextEncoder();
const UNSUB_AUD = 'newsletter-unsub-v1';
// 2-year TTL balances "old email archive can still unsubscribe" against
// "leaked token shouldn't be valid forever". Rotating the dispatch secret
// is the hard-stop kill-switch.
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;

export type UnsubscribeTokenPayload = {
  v: 1;
  aud: typeof UNSUB_AUD;
  cid: string; // Shopify customer GID
  email: string;
  iat: number;
  exp: number;
};

type Env = {NEWSLETTER_DISPATCH_SECRET?: string};

function secret(env: Env): string {
  const s = env.NEWSLETTER_DISPATCH_SECRET;
  if (!s) throw new Error('NEWSLETTER_DISPATCH_SECRET required');
  return s;
}

function b64urlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return b64urlEncode(sig);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signUnsubscribeToken(
  env: Env,
  input: {cid: string; email: string; ttlSeconds?: number},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: UnsubscribeTokenPayload = {
    v: 1,
    aud: UNSUB_AUD,
    cid: input.cid,
    email: input.email.toLowerCase(),
    iat: now,
    exp: now + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(secret(env), body);
  return `${body}.${sig}`;
}

export async function verifyUnsubscribeToken(
  env: Env,
  token: string | null | undefined,
): Promise<UnsubscribeTokenPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  let expected: string;
  try {
    expected = await hmac(secret(env), body);
  } catch {
    return null;
  }
  if (!constantTimeEqual(expected, sig)) return null;
  try {
    const json = new TextDecoder().decode(b64urlDecode(body));
    const payload = JSON.parse(json) as UnsubscribeTokenPayload;
    if (payload.v !== 1 || payload.aud !== UNSUB_AUD) return null;
    if (!payload.cid || !payload.email) return null;
    if (
      typeof payload.exp === 'number' &&
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(baseUrl: string, token: string): string {
  const url = new URL('/api/newsletter/unsubscribe', baseUrl);
  url.searchParams.set('t', token);
  return url.toString();
}
