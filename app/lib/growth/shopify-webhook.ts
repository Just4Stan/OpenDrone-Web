/**
 * Shopify webhook signature verification.
 *
 * Shopify signs every webhook delivery with
 * `X-Shopify-Hmac-Sha256: base64(HMAC-SHA256(secret, raw_body))`.
 * Verification MUST run over the raw request body bytes, before any
 * JSON parsing. WebCrypto only — this runs on Oxygen/workerd.
 *
 * Uses a length-leaking but content-constant comparison (mirrors
 * constantTimeEqual in app/lib/support/session.ts; duplicated here so
 * this module stays dependency-free for `node --test`). Length leakage
 * is harmless: a SHA-256 base64 digest is always 44 chars.
 */

export async function verifyShopifyHmac(
  rawBody: string,
  hmacHeader: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!hmacHeader || !secret) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const expected = btoa(bin);
  return constantTimeEqualLocal(expected, hmacHeader);
}

function constantTimeEqualLocal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
